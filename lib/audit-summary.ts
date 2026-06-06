import type { CategorieAnomalie, Gravite, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/current-user";

const categoryLabels: Record<CategorieAnomalie, string> = {
  INTEGRITE: "Intégrité",
  BENEFICIAIRE: "Bénéficiaires",
  PRESTATAIRE: "Prestataires",
  DOUBLON: "Doublons",
  FREQUENCE: "Fréquence",
  MONTANT: "Montants",
  ACTE: "Actes",
  TEMPOREL: "Temporels",
  CONTRACTUEL: "Contractuel",
  STATISTIQUE: "Statistiques",
};

const codeLabels: Record<string, string> = {
  CHAMPS_IMPORTANTS_MANQUANTS: "Champs importants manquants",
  MONTANT_NEGATIF: "Montants négatifs",
  MONTANT_PAYE_SUPERIEUR: "Montants payés supérieurs",
  DEPASSEMENT_TARIF: "Dépassements tarifaires",
  DATE_SOINS_FUTURE: "Dates de soins futures",
  HORS_EXERCICE: "Prestations hors exercice",
  DELAI_TARDIF_DEPASSE: "Délai tardif dépassé",
  ECART_DATE_EXCESSIF: "Écarts de dates excessifs",
  DOUBLON_FONCTIONNEL: "Doublons fonctionnels",
  DOUBLON_PARTIEL: "Doublons partiels",
  DOUBLON_INTER_MOIS: "Doublons inter-mois",
  DOUBLON_INTER_GESTIONNAIRE: "Doublons inter-gestionnaires",
  REPETITION_ACTE: "Répétitions d'actes",
  BENEFICIAIRE_REFERENTIEL: "Bénéficiaires hors référentiel",
  PRESTATAIRE_REFERENTIEL: "Prestataires hors référentiel",
  ACTE_NON_COUVERT: "Actes non couverts",
};

export async function getAuditSummary(user: CurrentUser, requestedFileId?: number) {
  const scope = user.role === "super_admin" ? {} : { compagnieId: user.compagnieId };
  const files = await prisma.fichierImporte.findMany({
    where: scope,
    include: { compagnie: true, filiale: true, gestionnaire: true, exercice: true },
    orderBy: { dateImport: "desc" },
    take: 30,
  });
  const selected = files.find((file) => file.id === requestedFileId) ?? files[0] ?? null;
  if (!selected) return { files, selected: null, rows: [], finance: [], progress: [], anomalyCount: 0, duplicateCount: 0 };

  const anomalies = await prisma.anomalie.findMany({
    where: { fichierImporteId: selected.id, codeAnomalie: { not: "DOUBLON_STRICT" } },
    orderBy: [{ categorie: "asc" }, { gravite: "asc" }],
  });
  const grouped = new Map<string, { categorie: CategorieAnomalie; code: string; count: number; amount: number; gravities: Map<Gravite, number> }>();
  for (const anomaly of anomalies) {
    const key = `${anomaly.categorie}:${anomaly.codeAnomalie}`;
    const current = grouped.get(key) ?? { categorie: anomaly.categorie, code: anomaly.codeAnomalie, count: 0, amount: 0, gravities: new Map() };
    current.count += 1;
    current.amount += Number(anomaly.montantImpacte);
    current.gravities.set(anomaly.gravite, (current.gravities.get(anomaly.gravite) ?? 0) + 1);
    grouped.set(key, current);
  }
  const rows = [...grouped.values()].map((item) => ({
    category: categoryLabels[item.categorie],
    type: codeLabels[item.code] ?? humanize(item.code),
    count: item.count,
    amount: item.amount,
    severity: dominantSeverity(item.gravities),
  })).sort((left, right) => right.amount - left.amount || right.count - left.count);

  const categoryAmounts = new Map<CategorieAnomalie, number>();
  for (const anomaly of anomalies) categoryAmounts.set(anomaly.categorie, (categoryAmounts.get(anomaly.categorie) ?? 0) + Number(anomaly.montantImpacte));
  const finance = [...categoryAmounts.entries()].filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ label: categoryLabels[category], amount }));
  const auditedCategories: CategorieAnomalie[] = ["INTEGRITE", "BENEFICIAIRE", "PRESTATAIRE", "DOUBLON", "FREQUENCE", "MONTANT", "ACTE", "TEMPOREL"];
  const progress = auditedCategories.map((category) => ({ label: categoryLabels[category], value: selected.statut === "analyse" || selected.statut === "valide" ? 100 : 0 }));
  const duplicateCount = anomalies.filter((anomaly) => anomaly.categorie === "DOUBLON").length;

  return { files, selected, rows, finance, progress, anomalyCount: anomalies.length, duplicateCount };
}

function dominantSeverity(gravities: Map<Gravite, number>): Gravite {
  for (const severity of ["critique", "eleve", "moyen", "faible"] as Gravite[]) if (gravities.has(severity)) return severity;
  return "faible";
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export type AuditSummary = Prisma.PromiseReturnType<typeof getAuditSummary>;
