import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AnnualStats = {
  year: number;
  files: number;
  lines: number;
  validLines: number;
  anomalyLines: number;
  lateLines: number;
  duplicates: number;
  claimedAmount: number;
  recommendedAmount: number;
  anomalyCount: number;
  anomalyAmount: number;
};
type BranchStats = AnnualStats & { branchId: number; branchName: string };

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const url = new URL(request.url);
  const requestedCompanyId = numberParam(url.searchParams.get("compagnie"));
  const companyId = user.role === "super_admin" ? requestedCompanyId ?? undefined : Number(user.compagnieId);
  if (!companyId) return NextResponse.json({ error: "Compagnie invalide." }, { status: 400 });

  const company = await prisma.compagnie.findFirst({
    where: user.role === "super_admin" ? { id: companyId } : { id: Number(user.compagnieId) },
  });
  if (!company) return NextResponse.json({ error: "Compagnie introuvable." }, { status: 404 });

  const branches = await prisma.filiale.findMany({ where: { compagnieId: company.id }, orderBy: { nom: "asc" } });
  const branchAId = numberParam(url.searchParams.get("filialeA")) ?? numberParam(url.searchParams.get("filiale"));
  const branchBId = numberParam(url.searchParams.get("filialeB"));
  const requestedBranchA = branches.find((branch) => branch.id === branchAId);
  const requestedBranchB = branches.find((branch) => branch.id === branchBId);
  const selectedBranchA = requestedBranchA ?? requestedBranchB;
  const selectedBranchB = requestedBranchA && requestedBranchB && requestedBranchB.id !== requestedBranchA.id ? requestedBranchB : undefined;
  const selectedBranchIds = [selectedBranchA?.id, selectedBranchB?.id].filter((id): id is number => Boolean(id));
  const branchWhere = selectedBranchIds.length ? { filialeId: { in: selectedBranchIds } } : {};

  const startYear = numberParam(url.searchParams.get("debut"));
  const endYear = numberParam(url.searchParams.get("fin"));
  const yearWhere = startYear && endYear
    ? { anneeFichier: { gte: Math.min(startYear, endYear), lte: Math.max(startYear, endYear) } }
    : startYear
      ? { anneeFichier: { gte: startYear } }
      : endYear
        ? { anneeFichier: { lte: endYear } }
        : {};

  const files = await prisma.fichierImporte.findMany({
    where: { compagnieId: company.id, ...branchWhere, ...yearWhere },
    include: { filiale: true, gestionnaire: true, exercice: true },
    orderBy: [{ filiale: { nom: "asc" } }, { anneeFichier: "asc" }, { moisFichier: "asc" }, { nomFichier: "asc" }],
  });
  const fileIds = files.map((file) => file.id);
  const anomalyGroups = fileIds.length
    ? await prisma.anomalie.groupBy({
        by: ["fichierImporteId"],
        where: { fichierImporteId: { in: fileIds }, codeAnomalie: { not: "DOUBLON_STRICT" } },
        _count: { id: true },
        _sum: { montantImpacte: true },
      })
    : [];
  const anomaliesByFile = new Map(anomalyGroups.map((group) => [group.fichierImporteId, {
    count: group._count.id,
    amount: Number(group._sum.montantImpacte ?? 0),
  }]));

  const statsByYear = new Map<number, AnnualStats>();
  const statsByBranchYear = new Map<string, BranchStats>();
  const fileRows: string[] = [];
  for (const file of files) {
    const anomaly = anomaliesByFile.get(file.id);
    const yearly = statsByYear.get(file.anneeFichier) ?? emptyStats(file.anneeFichier);
    addFile(yearly, file, anomaly);
    statsByYear.set(file.anneeFichier, yearly);

    const branchKey = `${file.filialeId}:${file.anneeFichier}`;
    const branchYear = statsByBranchYear.get(branchKey) ?? { ...emptyStats(file.anneeFichier), branchId: file.filialeId, branchName: file.filiale.nom };
    addFile(branchYear, file, anomaly);
    statsByBranchYear.set(branchKey, branchYear);

    fileRows.push([
      file.filiale.nom,
      file.exercice.codeExercice,
      `${monthLabel(file.moisFichier)}/${file.anneeFichier}`,
      file.nomFichier,
      fullName(file.gestionnaire.prenoms, file.gestionnaire.nom),
      formatNumber(file.nbLignesTotal),
      formatNumber(anomaly?.count ?? 0),
      formatMoney(Number(file.montantTotalReclame)),
      `${rate(anomaly?.count ?? 0, file.nbLignesTotal).toFixed(1)}%`,
    ].join(" | "));
  }

  const yearlyStats = [...statsByYear.values()].sort((left, right) => left.year - right.year);
  const branchYearStats = [...statsByBranchYear.values()].sort((left, right) => left.branchName.localeCompare(right.branchName) || left.year - right.year);
  const totals = yearlyStats.reduce((acc, row) => ({
    files: acc.files + row.files,
    lines: acc.lines + row.lines,
    claimedAmount: acc.claimedAmount + row.claimedAmount,
    recommendedAmount: acc.recommendedAmount + row.recommendedAmount,
    anomalyCount: acc.anomalyCount + row.anomalyCount,
    anomalyAmount: acc.anomalyAmount + row.anomalyAmount,
  }), { files: 0, lines: 0, claimedAmount: 0, recommendedAmount: 0, anomalyCount: 0, anomalyAmount: 0 });

  const lines = [
    `Rapport comparatif filiales - ${company.nom}`,
    `Genere le ${new Date().toLocaleDateString("fr-FR")}`,
    `Perimetre: ${selectedBranchB ? `${selectedBranchA?.nom} vs ${selectedBranchB.nom}` : selectedBranchA ? selectedBranchA.nom : "Toutes les filiales"}`,
    `Annees: ${startYear || "debut"} - ${endYear || "fin"}`,
    "",
    "Synthese",
    `Fichiers: ${formatNumber(totals.files)} | Lignes: ${formatNumber(totals.lines)} | Montant reclame: ${formatMoney(totals.claimedAmount)} | Anomalies: ${formatNumber(totals.anomalyCount)} | Impact: ${formatMoney(totals.anomalyAmount)}`,
    "",
    "Synthese annuelle globale",
    "Annee | Fichiers | Lignes | Valides | Anomalies | Tardives | Doublons | Reclame | Recommande | Taux",
    ...yearlyStats.map((row) => [
      row.year,
      formatNumber(row.files),
      formatNumber(row.lines),
      formatNumber(row.validLines),
      formatNumber(row.anomalyCount),
      formatNumber(row.lateLines),
      formatNumber(row.duplicates),
      formatMoney(row.claimedAmount),
      formatMoney(row.recommendedAmount),
      `${anomalyRate(row).toFixed(1)}%`,
    ].join(" | ")),
    "",
  ];

  if (selectedBranchA && selectedBranchB) {
    lines.push(`Comparaison directe: ${selectedBranchA.nom} vs ${selectedBranchB.nom}`);
    lines.push("Annee | Filiale A lignes | Filiale A taux | Filiale A reclame | Filiale B lignes | Filiale B taux | Filiale B reclame | Ecart taux | Ecart montant");
    const years = [...new Set(branchYearStats.map((row) => row.year))].sort((left, right) => left - right);
    for (const year of years) {
      const left = branchYearStats.find((row) => row.branchId === selectedBranchA.id && row.year === year);
      const right = branchYearStats.find((row) => row.branchId === selectedBranchB.id && row.year === year);
      lines.push([
        year,
        formatNumber(left?.lines ?? 0),
        optionalRate(left),
        formatMoney(left?.claimedAmount ?? 0),
        formatNumber(right?.lines ?? 0),
        optionalRate(right),
        formatMoney(right?.claimedAmount ?? 0),
        rateDiffLabel(left, right),
        formatMoney((left?.claimedAmount ?? 0) - (right?.claimedAmount ?? 0)),
      ].join(" | "));
    }
    lines.push("");
  }

  lines.push("Comparatif annuel par filiale");
  lines.push("Filiale | Annee | Fichiers | Lignes | Valides | Lignes anomalie | Anomalies audit | Tardives | Doublons | Reclame | Recommande | Taux");
  for (const row of branchYearStats) {
    lines.push([
      row.branchName,
      row.year,
      formatNumber(row.files),
      formatNumber(row.lines),
      formatNumber(row.validLines),
      formatNumber(row.anomalyLines),
      formatNumber(row.anomalyCount),
      formatNumber(row.lateLines),
      formatNumber(row.duplicates),
      formatMoney(row.claimedAmount),
      formatMoney(row.recommendedAmount),
      `${anomalyRate(row).toFixed(1)}%`,
    ].join(" | "));
  }
  lines.push("", "Detail des fichiers par filiale et par annee", "Filiale | Exercice | Mois/annee | Fichier | Gestionnaire | Lignes | Anomalies audit | Reclame | Taux");
  lines.push(...fileRows.slice(0, 220));
  if (fileRows.length > 220) lines.push(`... ${fileRows.length - 220} fichier(s) supplementaire(s) non affiches dans ce PDF.`);

  const buffer = createPdf(lines);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="comparatif-filiales-${dateStamp()}.pdf"`,
    },
  });
}

function addFile(target: AnnualStats, file: { nbLignesTotal: number; nbLignesValides: number; nbLignesAnomalies: number; nbLignesTardives: number; nbDoublons: number; montantTotalReclame: unknown; montantNetRecommande: unknown }, anomaly?: { count: number; amount: number }) {
  target.files += 1;
  target.lines += file.nbLignesTotal;
  target.validLines += file.nbLignesValides;
  target.anomalyLines += file.nbLignesAnomalies;
  target.lateLines += file.nbLignesTardives;
  target.duplicates += file.nbDoublons;
  target.claimedAmount += Number(file.montantTotalReclame);
  target.recommendedAmount += Number(file.montantNetRecommande);
  target.anomalyCount += anomaly?.count ?? 0;
  target.anomalyAmount += anomaly?.amount ?? 0;
}

function emptyStats(year: number): AnnualStats {
  return { year, files: 0, lines: 0, validLines: 0, anomalyLines: 0, lateLines: 0, duplicates: 0, claimedAmount: 0, recommendedAmount: 0, anomalyCount: 0, anomalyAmount: 0 };
}

function createPdf(lines: string[]) {
  const chunks = chunkLines(lines, 42);
  const fontId = 3 + chunks.length * 2;
  const pageKids = chunks.map((_, index) => `${3 + index * 2} 0 R`);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageKids.join(" ")}] /Count ${chunks.length} >>`,
  ];
  chunks.forEach((chunk, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    const stream = textStream(chunk);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const body: string[] = ["%PDF-1.4"];
  const offsets: number[] = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body.join("\n") + "\n"));
    body.push(`${index + 1} 0 obj\n${objects[index]}\nendobj`);
  }
  const xrefOffset = Buffer.byteLength(body.join("\n") + "\n");
  body.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f `);
  for (const offset of offsets.slice(1)) body.push(`${String(offset).padStart(10, "0")} 00000 n `);
  body.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return Buffer.from(body.join("\n"), "utf8");
}

function textStream(lines: string[]) {
  return `BT\n/F1 8 Tf\n36 560 Td\n${lines.map((line, index) => `${index ? "0 -12 Td\n" : ""}(${pdfEscape(asciiPdfText(line).slice(0, 170))}) Tj`).join("\n")}\nET`;
}

function chunkLines(lines: string[], size: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += size) chunks.push(lines.slice(index, index + size));
  return chunks.length ? chunks : [["Aucune donnee."]];
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function asciiPdfText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, " ");
}

function optionalRate(row?: AnnualStats) { return row ? `${anomalyRate(row).toFixed(1)}%` : "-"; }
function anomalyRate(row: AnnualStats) { return rate(row.anomalyCount, row.lines); }
function rate(count: number, total: number) { return total ? (count / total) * 100 : 0; }
function rateDiffLabel(left?: AnnualStats, right?: AnnualStats) {
  if (!left || !right) return "-";
  const diff = anomalyRate(left) - anomalyRate(right);
  if (Math.abs(diff) < 0.05) return "Stable";
  return `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pts`;
}
function fullName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
function monthLabel(month: number) { return String(month).padStart(2, "0"); }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function numberParam(value: string | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}
function dateStamp() { return new Date().toISOString().slice(0, 10); }
