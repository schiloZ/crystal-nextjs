import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runFileAudit } from "@/lib/run-file-audit";

export const runtime = "nodejs";
export const maxDuration = 300;

const allowedFields = new Set([
  "numeroPrestation", "codeSouscripteur", "souscripteur", "dateSoins", "dateComptable", "codeAffection", "affection",
  "codeFamillePrestation", "famillePrestation", "codeActe", "acte", "codePrescripteur", "prescripteur", "codePrestataire",
  "prestataire", "matriculeAssurePrincipal", "nomAssurePrincipal", "prenomsAssurePrincipal", "matriculeBeneficiaire",
  "nomBeneficiaire", "prenomsBeneficiaire", "statutBeneficiaire", "dateNaissanceBeneficiaire", "police", "policeInterne", "numeroCollege", "college",
  "montantReclame", "montantExclu", "baseRemboursement", "ticketModerateur", "montantTicketModerateur", "montantPaye",
  "codeExercice", "debutExercice", "finExercice", "moisFichier", "codeGestionnaire", "codeFiliale",
]);
const dateFields = new Set(["dateSoins", "dateComptable", "dateNaissanceBeneficiaire", "debutExercice", "finExercice"]);
const moneyFields = new Set(["montantReclame", "montantExclu", "baseRemboursement", "ticketModerateur", "montantTicketModerateur", "montantPaye"]);
const integerFields = new Set(["moisFichier"]);

export async function POST(request: Request) {
  let createdFileId: number | null = null;
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!user?.id) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    const branchId = Number(form.get("branchId"));
    const managerId = Number(form.get("managerId"));
    const exerciseId = Number(form.get("exerciseId"));
    const month = Number(form.get("fileMonth"));
    const year = Number(form.get("fileYear"));
    const mapping = JSON.parse(String(form.get("mapping") || "{}")) as Record<string, { target?: string }>;
    if (!(file instanceof File)) return NextResponse.json({ error: "Fichier Excel manquant." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Le fichier dépasse 10 Mo." }, { status: 400 });
    if (!Number.isInteger(month) || month < 1 || month > 12) return NextResponse.json({ error: "Le mois du fichier est obligatoire." }, { status: 400 });
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return NextResponse.json({ error: "L'année du fichier est obligatoire." }, { status: 400 });

    const [branch, manager, exercise] = await Promise.all([
      prisma.filiale.findUnique({ where: { id: branchId } }),
      prisma.gestionnaire.findUnique({ where: { id: managerId } }),
      prisma.exerciceComptable.findUnique({ where: { id: exerciseId } }),
    ]);
    if (!branch || !manager || !exercise || !manager.actif || !exercise.actif) return NextResponse.json({ error: "Filiale, gestionnaire ou exercice invalide." }, { status: 400 });
    if (branch.compagnieId !== manager.compagnieId || branch.compagnieId !== exercise.compagnieId) return NextResponse.json({ error: "Le périmètre sélectionné est incohérent." }, { status: 400 });
    if (user.role !== "super_admin" && Number(user.compagnieId) !== branch.compagnieId) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellDates: true, dense: true });
    const parsed = findDataSheet(workbook);
    const mappingByNormalizedHeader = new Map(Object.entries(mapping).map(([header, value]) => [normalizeHeader(header), value?.target ?? ""]));
    const targetByIndex = parsed.headers.map((header) => mapping[header]?.target ?? mappingByNormalizedHeader.get(normalizeHeader(header)) ?? "");
    if (!targetByIndex.some((target) => allowedFields.has(target))) {
      return NextResponse.json({ error: "Aucune colonne valide n'est mappée. Revenez à l'étape de mapping et associez au moins une colonne détectée à un champ Prestation." }, { status: 400 });
    }

    const importedFile = await prisma.fichierImporte.create({
      data: {
        compagnieId: branch.compagnieId, filialeId: branch.id, gestionnaireId: manager.id, exerciceId: exercise.id,
        moisFichier: month, anneeFichier: year, nomFichier: file.name, tailleFichier: BigInt(file.size), statut: "en_analyse",
      },
    });
    createdFileId = importedFile.id;

    const base = { fichierImporteId: importedFile.id, compagnieId: branch.compagnieId, filialeId: branch.id, gestionnaireId: manager.id, exerciceId: exercise.id };
    const data = parsed.rows.filter((row) => row.some((cell) => String(cell ?? "").trim())).map((row) => {
      const item: Record<string, unknown> = { ...base };
      targetByIndex.forEach((target, index) => {
        if (!allowedFields.has(target)) return;
        const value = row[index];
        if (dateFields.has(target)) item[target] = parseDate(value);
        else if (moneyFields.has(target)) item[target] = parseMoney(value);
        else if (integerFields.has(target)) item[target] = parseInteger(value);
        else item[target] = cleanString(value);
      });
      return item as Prisma.PrestationCreateManyInput;
    });
    if (!data.length) throw new Error("Le fichier ne contient aucune ligne de prestation.");

    for (let index = 0; index < data.length; index += 500) await prisma.prestation.createMany({ data: data.slice(index, index + 500) });
    const audit = await runFileAudit(importedFile.id);
    await prisma.historiqueImportation.create({
      data: {
        compagnieId: branch.compagnieId,
        fichierImporteId: importedFile.id,
        nomFichier: file.name,
        action: "ajout",
        utilisateurId: Number(user.id),
        utilisateurNom: String(user.name || user.email || "Utilisateur"),
        utilisateurEmail: String(user.email || ""),
        nbLignesTotal: audit.prestations,
        nbAnomalies: audit.lignesImpactees,
      },
    });
    return NextResponse.json({ fileId: importedFile.id, fileName: file.name, ...audit });
  } catch (error) {
    if (createdFileId) {
      await prisma.anomalie.deleteMany({ where: { fichierImporteId: createdFileId } }).catch(() => undefined);
      await prisma.prestation.deleteMany({ where: { fichierImporteId: createdFileId } }).catch(() => undefined);
      await prisma.fichierImporte.delete({ where: { id: createdFileId } }).catch(() => undefined);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "L'importation a échoué." }, { status: 500 });
  }
}

function findDataSheet(workbook: XLSX.WorkBook) {
  const candidates = workbook.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: "", raw: false, blankrows: false });
    let index = -1; let score = 0;
    rows.slice(0, 40).forEach((row, rowIndex) => {
      const current = headerRowScore(row);
      if (current > score) { score = current; index = rowIndex; }
    });
    return { rows, index, score };
  }).sort((a, b) => b.score - a.score)[0];
  if (!candidates || candidates.index < 0) throw new Error("Aucune ligne d'en-têtes détectée.");
  const lastColumn = findLastUsedColumn(candidates.rows, candidates.index);
  const headers = uniqueHeaders(candidates.rows[candidates.index].slice(0, lastColumn + 1).map((cell, index) => cleanString(cell) || `Colonne ${index + 1}`));
  return { headers, rows: candidates.rows.slice(candidates.index + 1).map((row) => headers.map((_, index) => row[index] ?? "")) };
}
function uniqueHeaders(headers: string[]) { const counts = new Map<string, number>(); return headers.map((header) => { const count = (counts.get(header) ?? 0) + 1; counts.set(header, count); return count === 1 ? header : `${header} (${count})`; }); }
function cleanString(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
function parseInteger(value: unknown) { const number = Number(String(value ?? "").replace(/[^\d-]/g, "")); return Number.isFinite(number) ? Math.trunc(number) : null; }
function parseMoney(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = String(value ?? "").trim();
  if (!text) return 0;

  const negative = /^-/.test(text) || /^\(.*\)$/.test(text);
  text = text
    .replace(/[()]/g, "")
    .replace(/\s|\u00a0|\u202f/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/^-/, "");

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : lastDot > lastComma ? "." : "";

  if (decimalSeparator) {
    const [integerPart, decimalPart = ""] = splitLast(text, decimalSeparator);
    const integer = integerPart.replace(/[,.]/g, "");
    const decimal = decimalPart.replace(/[,.]/g, "");
    text = decimal.length > 0 && decimal.length <= 2 ? `${integer}.${decimal}` : `${integer}${decimal}`;
  } else {
    text = text.replace(/[,.]/g, "");
  }

  const number = Number(text);
  return Number.isFinite(number) ? (negative ? -number : number) : 0;
}
function splitLast(value: string, separator: string) { const index = value.lastIndexOf(separator); return index < 0 ? [value] : [value.slice(0, index), value.slice(index + 1)]; }
function parseDate(value: unknown) { if (!value) return null; if (value instanceof Date && !Number.isNaN(value.getTime())) return value; const text = String(value).trim(); const french = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); const date = french ? new Date(Date.UTC(Number(french[3].length === 2 ? `20${french[3]}` : french[3]), Number(french[2]) - 1, Number(french[1]))) : new Date(text); return Number.isNaN(date.getTime()) ? null : date; }
function normalizeHeader(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+\(\d+\)$/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function headerRowScore(row: unknown[]) {
  const values = row.map((cell) => String(cell ?? "").trim()).filter(Boolean);
  if (values.length < 2) return 0;
  const textCells = values.filter((value) => Number.isNaN(Number(value))).length;
  const knownTerms = values.reduce((score, value) => {
    const normalized = normalizeHeader(value);
    return score + [...allowedFields].reduce((best, field) => {
      const candidate = normalizeHeader(field);
      return Math.max(best, normalized === candidate ? 4 : normalized.includes(candidate) || candidate.includes(normalized) ? 2 : 0);
    }, 0);
  }, 0);
  return values.length + textCells + knownTerms;
}
function findLastUsedColumn(rows: unknown[][], headerIndex: number) {
  return rows.slice(headerIndex, headerIndex + 6).reduce((last, row) => {
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (String(row[index] ?? "").trim()) return Math.max(last, index);
    }
    return last;
  }, 0);
}
