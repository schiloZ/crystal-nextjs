import type { CurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const monthNames = ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin", "Juil", "Aout", "Sep", "Oct", "Nov", "Dec"];

export async function getBiData(user: CurrentUser) {
  const scope = user.role === "super_admin" ? {} : { compagnieId: user.compagnieId };
  const files = await prisma.fichierImporte.findMany({
    where: scope,
    include: { compagnie: true, filiale: true, gestionnaire: true },
    orderBy: [{ anneeFichier: "desc" }, { moisFichier: "desc" }],
  });
  const selectedYear = files[0]?.anneeFichier ?? new Date().getFullYear();
  const yearFiles = files.filter((file) => file.anneeFichier === selectedYear);
  const yearFileIds = yearFiles.map((file) => file.id);
  const fileIds = files.map((file) => file.id);
  const anomalyWhere = { fichierImporteId: fileIds.length ? { in: fileIds } : { in: [-1] }, codeAnomalie: { not: "DOUBLON_STRICT" } };
  const yearAnomalyWhere = { fichierImporteId: yearFileIds.length ? { in: yearFileIds } : { in: [-1] }, codeAnomalie: { not: "DOUBLON_STRICT" } };
  const yearPrestationWhere = { fichierImporteId: yearFileIds.length ? { in: yearFileIds } : { in: [-1] } };

  const [anomalyCount, anomalyAmount, categories, families, beneficiaries, amountStats, monthlyPrestations] = await Promise.all([
    prisma.anomalie.count({ where: anomalyWhere }),
    prisma.anomalie.aggregate({ where: anomalyWhere, _sum: { montantImpacte: true } }),
    prisma.anomalie.groupBy({ by: ["categorie"], where: yearAnomalyWhere, _count: { id: true }, _sum: { montantImpacte: true } }),
    prisma.prestation.groupBy({ by: ["famillePrestation"], where: yearPrestationWhere, _count: { id: true }, _sum: { montantReclame: true }, orderBy: { _sum: { montantReclame: "desc" } }, take: 8 }),
    prisma.prestation.groupBy({ by: ["matriculeBeneficiaire", "nomBeneficiaire"], where: yearPrestationWhere, _count: { id: true }, _sum: { montantReclame: true }, orderBy: { _sum: { montantReclame: "desc" } }, take: 10 }),
    prisma.prestation.aggregate({ where: yearPrestationWhere, _avg: { montantReclame: true }, _min: { montantReclame: true }, _max: { montantReclame: true } }),
    prisma.prestation.groupBy({ by: ["moisFichier"], where: yearPrestationWhere, _count: { id: true }, _sum: { montantReclame: true } }),
  ]);

  const monthly = monthNames.map((name, index) => {
    const month = index + 1;
    const monthFiles = yearFiles.filter((file) => file.moisFichier === month);
    const groupedPrestations = monthlyPrestations.find((item) => item.moisFichier === month);
    const anomalies = monthFiles.reduce((sum, file) => sum + file.nbLignesAnomalies, 0);
    const lines = groupedPrestations?._count.id ?? monthFiles.reduce((sum, file) => sum + file.nbLignesTotal, 0);
    const amount = Number(groupedPrestations?._sum.montantReclame ?? monthFiles.reduce((sum, file) => sum + Number(file.montantTotalReclame), 0));
    return { name, month, amount, amountM: Math.round(amount / 1_000_000), lines, anomalies, anomalyRate: lines ? Number(((anomalies / lines) * 100).toFixed(1)) : 0 };
  });

  const managerTotals = new Map<string, { name: string; files: number; amount: number; recommended: number; anomalies: number }>();
  for (const file of yearFiles) {
    const name = fullName(file.gestionnaire.prenoms, file.gestionnaire.nom);
    const row = managerTotals.get(name) ?? { name, files: 0, amount: 0, recommended: 0, anomalies: 0 };
    row.files += 1;
    row.amount += Number(file.montantTotalReclame);
    row.recommended += Number(file.montantNetRecommande);
    row.anomalies += file.nbLignesAnomalies;
    managerTotals.set(name, row);
  }
  const managers = [...managerTotals.values()].sort((a, b) => b.amount - a.amount);
  const totalLines = files.reduce((sum, file) => sum + file.nbLignesTotal, 0);
  const totalClaimed = files.reduce((sum, file) => sum + Number(file.montantTotalReclame), 0);
  const totalRecommended = files.reduce((sum, file) => sum + Number(file.montantNetRecommande), 0);
  const totalAnomalyLines = files.reduce((sum, file) => sum + file.nbLignesAnomalies, 0);
  const yearTotalLines = yearFiles.reduce((sum, file) => sum + file.nbLignesTotal, 0);
  const yearClaimed = yearFiles.reduce((sum, file) => sum + Number(file.montantTotalReclame), 0);
  const yearRecommended = yearFiles.reduce((sum, file) => sum + Number(file.montantNetRecommande), 0);
  const yearAnomalyLines = yearFiles.reduce((sum, file) => sum + file.nbLignesAnomalies, 0);
  const savings = totalClaimed - totalRecommended || Number(anomalyAmount._sum.montantImpacte ?? 0);

  return {
    selectedYear,
    companyLabel: user.role === "super_admin" ? "Toutes compagnies" : user.compagnieNom,
    fileCount: files.length,
    yearFileCount: yearFiles.length,
    totalLines,
    totalClaimed,
    totalRecommended,
    yearTotalLines,
    yearClaimed,
    yearRecommended,
    yearSavings: yearClaimed - yearRecommended,
    yearAnomalyRate: yearTotalLines ? (yearAnomalyLines / yearTotalLines) * 100 : 0,
    savings,
    anomalyCount,
    anomalyAmount: Number(anomalyAmount._sum.montantImpacte ?? 0),
    anomalyRate: totalLines ? (totalAnomalyLines / totalLines) * 100 : 0,
    monthly,
    managers,
    families: families.map((row) => ({ name: row.famillePrestation ?? "Sans famille", value: row._count.id, amount: Number(row._sum.montantReclame ?? 0) })),
    categories: categories.map((row) => ({ name: categoryLabel(String(row.categorie)), value: row._count.id, amount: Number(row._sum.montantImpacte ?? 0) })).sort((a, b) => b.value - a.value),
    beneficiaries: beneficiaries.map((row) => ({ matricule: row.matriculeBeneficiaire ?? "-", name: row.nomBeneficiaire ?? "Non renseigne", count: row._count.id, amount: Number(row._sum.montantReclame ?? 0) })),
    amountStats: {
      avg: Number(amountStats._avg.montantReclame ?? 0),
      min: Number(amountStats._min.montantReclame ?? 0),
      max: Number(amountStats._max.montantReclame ?? 0),
    },
  };
}

function categoryLabel(value: string) {
  const labels: Record<string, string> = {
    BENEFICIAIRE: "Benef.",
    PRESTATAIRE: "Prest.",
    DOUBLON: "Doublons",
    FREQUENCE: "Frequence",
    MONTANT: "Montants",
    ACTE: "Actes",
    TEMPOREL: "Tardifs",
  };
  return labels[value] ?? value;
}

function fullName(prenoms: string | null, nom: string) {
  return `${prenoms ?? ""} ${nom}`.trim();
}
