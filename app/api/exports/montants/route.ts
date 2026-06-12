import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const anomalyTypes = ["DEPASSEMENT_TARIF", "MONTANT_PAYE_SUPERIEUR", "MONTANT_NEGATIF"] as const;
const validTypes = [...anomalyTypes, "TICKET_MODERATEUR", "PLAFONDS"] as const;
type MontantType = typeof validTypes[number];
type DetailRow = {
  key: string;
  beneficiary: string;
  principal: string;
  codeActe: string;
  claimed: number;
  comparison: number;
  comparisonLabel: string;
  impact: number;
  ratio: number;
  severity: string;
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const url = new URL(request.url);
  const fileId = numberParam(url.searchParams.get("fichier"));
  const selectedType = typeParam(url.searchParams.get("type"));
  if (!fileId) return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });

  const file = await prisma.fichierImporte.findFirst({
    where: {
      id: fileId,
      compagnieId: user.role === "super_admin" ? undefined : Number(user.compagnieId),
    },
    include: { compagnie: true, filiale: true, gestionnaire: true, exercice: true },
  });
  if (!file) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });

  const rows = await loadRows(file.id, file.compagnieId, selectedType);
  const detailRows = rows.map((row) => ({
    "Bénéficiaire": row.beneficiary,
    "Assuré principal": row.principal,
    "Acte / règle": row.codeActe,
    "Montant réclamé": row.claimed,
    [comparisonHeader(selectedType)]: row.comparison,
    "Libellé comparaison": row.comparisonLabel,
    "Écart": row.impact,
    "Écart %": row.ratio ? Number(row.ratio.toFixed(1)) : 0,
    "Gravité": severityLabel(row.severity),
  }));
  const summary = [{
    "Fichier": file.nomFichier,
    "Compagnie": file.compagnie.nom,
    "Filiale": file.filiale.nom,
    "Gestionnaire": fullName(file.gestionnaire.prenoms, file.gestionnaire.nom),
    "Type": typeLabel(selectedType),
    "Nombre": rows.length,
    "Montant impacté": rows.reduce((sum, row) => sum + row.impact, 0),
    "Généré le": new Date().toLocaleDateString("fr-FR"),
  }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), "Montants");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Synthèse");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="montants-crystal-${selectedType.toLowerCase()}-${dateStamp()}.xlsx"`,
    },
  });
}

async function loadRows(fileId: number, companyId: number, selectedType: MontantType): Promise<DetailRow[]> {
  if (anomalyTypes.includes(selectedType as typeof anomalyTypes[number])) {
    const anomalies = await prisma.anomalie.findMany({
      where: { fichierImporteId: fileId, categorie: "MONTANT", codeAnomalie: selectedType },
      include: { prestation: true },
      orderBy: { montantImpacte: "desc" },
    });
    const actCodes = anomalies.map((item) => item.prestation?.codeActe).filter(Boolean) as string[];
    const refs = actCodes.length ? await prisma.refActe.findMany({ where: { compagnieId: companyId, codeActe: { in: actCodes } } }) : [];
    const refsByCode = new Map(refs.map((ref) => [ref.codeActe, ref]));

    return anomalies.map((anomaly) => {
      const prestation = anomaly.prestation;
      const reference = prestation?.codeActe ? refsByCode.get(prestation.codeActe) : undefined;
      const claimed = Number(prestation?.montantReclame ?? 0);
      const paid = Number(prestation?.montantPaye ?? 0);
      const comparison = selectedType === "DEPASSEMENT_TARIF" ? Number(reference?.tarifConventionne ?? 0) : paid;
      const impact = Number(anomaly.montantImpacte);
      return {
        key: anomaly.id.toString(),
        beneficiary: beneficiaryName(prestation),
        principal: prestation?.nomAssurePrincipal ?? prestation?.matriculeAssurePrincipal ?? "-",
        codeActe: prestation?.codeActe ?? prestation?.acte ?? "-",
        claimed,
        comparison,
        comparisonLabel: selectedType === "DEPASSEMENT_TARIF" ? "Tarif conv." : "Montant payé",
        impact,
        ratio: comparison ? (impact / Math.abs(comparison)) * 100 : 0,
        severity: anomaly.gravite,
      };
    });
  }

  const [prestations, plafondRules] = await Promise.all([
    prisma.prestation.findMany({ where: { fichierImporteId: fileId }, orderBy: { id: "asc" } }),
    prisma.refPlafond.findMany({ where: { compagnieId: companyId, actif: true }, orderBy: { id: "desc" } }),
  ]);
  return selectedType === "TICKET_MODERATEUR" ? buildTicketRows(prestations) : buildPlafondRows(prestations, plafondRules);
}

function buildTicketRows(prestations: Awaited<ReturnType<typeof prisma.prestation.findMany>>): DetailRow[] {
  return prestations.flatMap((prestation) => {
    const base = Number(prestation.baseRemboursement || prestation.montantReclame || 0);
    const rate = Number(prestation.ticketModerateur || 0);
    const actual = Number(prestation.montantTicketModerateur || 0);
    if (base <= 0 || rate <= 0) return [];
    const expected = rate <= 1 ? base * rate : rate <= 100 ? base * (rate / 100) : rate;
    const impact = Math.abs(actual - expected);
    if (impact <= 1) return [];
    return [{
      key: `ticket-${prestation.id.toString()}`,
      beneficiary: beneficiaryName(prestation),
      principal: prestation.nomAssurePrincipal ?? prestation.matriculeAssurePrincipal ?? "-",
      codeActe: prestation.codeActe ?? prestation.acte ?? "-",
      claimed: Number(prestation.montantReclame ?? 0),
      comparison: expected,
      comparisonLabel: `${rate}${rate <= 1 ? "" : rate <= 100 ? "%" : " F"}`,
      impact,
      ratio: expected ? (impact / Math.abs(expected)) * 100 : 0,
      severity: impact > 10_000 ? "eleve" : "moyen",
    }];
  }).sort((a, b) => b.impact - a.impact);
}

function buildPlafondRows(prestations: Awaited<ReturnType<typeof prisma.prestation.findMany>>, rules: Awaited<ReturnType<typeof prisma.refPlafond.findMany>>): DetailRow[] {
  return prestations.flatMap((prestation) => {
    const rule = bestPlafondRule(prestation, rules);
    if (!rule) return [];
    const claimed = Number(prestation.montantReclame ?? 0);
    const ceiling = Number(rule.montantPlafond ?? 0);
    const impact = claimed - ceiling;
    if (ceiling <= 0 || impact <= 0) return [];
    return [{
      key: `plafond-${prestation.id.toString()}-${rule.id}`,
      beneficiary: beneficiaryName(prestation),
      principal: prestation.nomAssurePrincipal ?? prestation.matriculeAssurePrincipal ?? "-",
      codeActe: `${prestation.codeActe ?? prestation.acte ?? "-"} · ${rule.libelle}`,
      claimed,
      comparison: ceiling,
      comparisonLabel: rule.typePlafond,
      impact,
      ratio: ceiling ? (impact / Math.abs(ceiling)) * 100 : 0,
      severity: impact > 25_000 ? "critique" : "eleve",
    }];
  }).sort((a, b) => b.impact - a.impact);
}

function bestPlafondRule(prestation: Awaited<ReturnType<typeof prisma.prestation.findMany>>[number], rules: Awaited<ReturnType<typeof prisma.refPlafond.findMany>>) {
  let best: typeof rules[number] | null = null;
  let bestScore = -1;
  for (const rule of rules) {
    let score = 0;
    if (rule.police) {
      if (![prestation.police, prestation.policeInterne].includes(rule.police)) continue;
      score += 3;
    }
    if (rule.numeroCollege) {
      if (rule.numeroCollege !== prestation.numeroCollege) continue;
      score += 2;
    }
    if (rule.codeActe) {
      if (rule.codeActe !== prestation.codeActe) continue;
      score += 5;
    }
    if (rule.famille) {
      if (!sameText(rule.famille, prestation.codeFamillePrestation) && !sameText(rule.famille, prestation.famillePrestation)) continue;
      score += 4;
    }
    if (!rule.police && !rule.numeroCollege && !rule.codeActe && !rule.famille) score = 1;
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best;
}

function typeParam(value: string | null): MontantType {
  return validTypes.includes(value as MontantType) ? value as MontantType : "DEPASSEMENT_TARIF";
}

function numberParam(value: string | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function typeLabel(type: string) {
  return type === "DEPASSEMENT_TARIF" ? "Dépassements de tarifs conventionnés" : type === "MONTANT_PAYE_SUPERIEUR" ? "Montants payés supérieurs aux montants réclamés" : type === "MONTANT_NEGATIF" ? "Montants négatifs" : type === "TICKET_MODERATEUR" ? "Écarts sur ticket modérateur" : "Dépassements de plafonds";
}

function comparisonHeader(type: string) {
  return type === "TICKET_MODERATEUR" ? "Ticket attendu" : type === "PLAFONDS" ? "Plafond" : "Montant payé / Tarif";
}

function severityLabel(value: string) {
  return value === "critique" ? "Critique" : value === "eleve" ? "Élevée" : value === "moyen" ? "Moyenne" : "Faible";
}

function beneficiaryName(prestation: { nomBeneficiaire?: string | null; prenomsBeneficiaire?: string | null; matriculeBeneficiaire?: string | null } | null | undefined) {
  return `${prestation?.nomBeneficiaire ?? ""} ${prestation?.prenomsBeneficiaire ?? ""}`.trim() || prestation?.matriculeBeneficiaire || "-";
}

function fullName(prenoms: string | null, nom: string) {
  return `${prenoms ?? ""} ${nom}`.trim();
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return normalize(left) === normalize(right);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
