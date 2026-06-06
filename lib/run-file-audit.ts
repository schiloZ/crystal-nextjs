import { CategorieAnomalie, Gravite, Prisma } from "@prisma/client";
import { functionalDuplicateKey } from "@/lib/duplicate-detection";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  prestationId: bigint;
  fichierImporteId: number;
  compagnieId: number;
  filialeId: number;
  categorie: CategorieAnomalie;
  codeAnomalie: string;
  description: string;
  gravite: Gravite;
  montantImpacte: number;
  matriculeBenef?: string | null;
  nomBenef?: string | null;
};

export async function runFileAudit(fileId: number) {
  const file = await prisma.fichierImporte.findUnique({
    where: { id: fileId },
    include: { exercice: true },
  });
  if (!file) throw new Error("Fichier importé introuvable.");

  const prestations = await prisma.prestation.findMany({ where: { fichierImporteId: fileId } });
  const anomalies: AuditInput[] = [];
  const push = (prestation: (typeof prestations)[number], categorie: CategorieAnomalie, codeAnomalie: string, description: string, gravite: Gravite = "eleve", montantImpacte = Number(prestation.montantPaye)) => {
    anomalies.push({
      prestationId: prestation.id,
      fichierImporteId: fileId,
      compagnieId: prestation.compagnieId,
      filialeId: prestation.filialeId,
      categorie,
      codeAnomalie,
      description,
      gravite,
      montantImpacte,
      matriculeBenef: prestation.matriculeBeneficiaire,
      nomBenef: prestation.nomBeneficiaire,
    });
  };

  const beneficiaryRefs = await prisma.refAssure.findMany({ where: { compagnieId: file.compagnieId } });
  const providerRefs = await prisma.refPrestataire.findMany({ where: { compagnieId: file.compagnieId } });
  const actRefs = await prisma.refActe.findMany({ where: { compagnieId: file.compagnieId } });
  const beneficiaries = new Map(beneficiaryRefs.map((ref) => [ref.matricule, ref]));
  const providers = new Map(providerRefs.map((ref) => [ref.code, ref]));
  const providersByName = new Map(providerRefs.map((ref) => [normalize(ref.nom), ref]));
  const acts = new Map(actRefs.map((ref) => [ref.codeActe, ref]));
  const actsByLabel = new Map(actRefs.map((ref) => [normalize(ref.libelle), ref]));
  const frequencies = new Map<string, number>();
  const functionalGroups = new Map<string, typeof prestations>();
  const partialGroups = new Map<string, typeof prestations>();
  const externalPrestations = await prisma.prestation.findMany({
    where: { compagnieId: file.compagnieId, fichierImporteId: { not: fileId } },
    include: { fichier: true },
  });
  const externalBySignature = new Map<string, typeof externalPrestations>();

  for (const prestation of prestations) {
    const paid = Number(prestation.montantPaye);
    const claimed = Number(prestation.montantReclame);

    const hasAct = Boolean(prestation.codeActe || prestation.acte);
    const hasProvider = Boolean(prestation.codePrestataire || prestation.prestataire);
    const hasBeneficiary = Boolean(prestation.matriculeBeneficiaire || prestation.nomBeneficiaire || prestation.prenomsBeneficiaire || prestation.statutBeneficiaire);

    if (!prestation.dateSoins || !hasAct || !hasProvider || !hasBeneficiary) {
      push(prestation, "INTEGRITE", "CHAMPS_IMPORTANTS_MANQUANTS", "Une ou plusieurs informations importantes sont absentes.");
    }
    if (claimed < 0 || paid < 0) push(prestation, "MONTANT", "MONTANT_NEGATIF", "Un montant négatif a été détecté.", "critique", Math.abs(Math.min(claimed, paid)));
    if (paid > claimed && claimed >= 0) push(prestation, "MONTANT", "MONTANT_PAYE_SUPERIEUR", "Le montant payé dépasse le montant réclamé.", "eleve", paid - claimed);

    if (prestation.dateSoins) {
      if (prestation.dateSoins > new Date()) push(prestation, "TEMPOREL", "DATE_SOINS_FUTURE", "La date des soins est dans le futur.", "critique");
      if (prestation.dateSoins < file.exercice.dateDebut || prestation.dateSoins > file.exercice.dateFin) {
        push(prestation, "TEMPOREL", "HORS_EXERCICE", "La date des soins est hors de l'exercice comptable sélectionné.", "critique");
      }
    }
    if (prestation.dateSoins && prestation.dateComptable) {
      const days = Math.abs(prestation.dateComptable.getTime() - prestation.dateSoins.getTime()) / 86_400_000;
      if (days > 90) push(prestation, "TEMPOREL", "ECART_DATE_EXCESSIF", `L'écart entre les dates est de ${Math.round(days)} jours.`);
    }
    const toleranceStart = file.exercice.dateDebutToleranceTardif ? startOfDay(file.exercice.dateDebutToleranceTardif) : null;
    const toleranceEnd = file.exercice.dateFinToleranceTardif ? endOfDay(file.exercice.dateFinToleranceTardif) : null;
    if (prestation.dateComptable && toleranceStart && prestation.dateComptable < toleranceStart) {
      const days = Math.ceil((toleranceStart.getTime() - prestation.dateComptable.getTime()) / 86_400_000);
      push(prestation, "TEMPOREL", "DELAI_TARDIF_DEPASSE", `La date comptable est avant le début de tolérance de ${days} jours.`, "critique");
    }
    if (prestation.dateComptable && toleranceEnd && prestation.dateComptable > toleranceEnd) {
      const days = Math.ceil((prestation.dateComptable.getTime() - toleranceEnd.getTime()) / 86_400_000);
      push(prestation, "TEMPOREL", "DELAI_TARDIF_DEPASSE", `La date comptable dépasse la fin de tolérance de ${days} jours.`, "critique");
    }

    const duplicateKey = functionalDuplicateKey(prestation);
    if (duplicateKey) {
      const matches = functionalGroups.get(duplicateKey) ?? [];
      matches.push(prestation);
      functionalGroups.set(duplicateKey, matches);
    }
    const partialKey = partialDuplicateKey(prestation);
    if (partialKey) {
      const matches = partialGroups.get(partialKey) ?? [];
      matches.push(prestation);
      partialGroups.set(partialKey, matches);
    }
    const frequencyBeneficiary = normalize(prestation.matriculeBeneficiaire) || normalize(`${prestation.nomBeneficiaire ?? ""} ${prestation.prenomsBeneficiaire ?? ""} ${prestation.statutBeneficiaire ?? ""}`);
    const frequencyAct = normalize(prestation.codeActe) || normalize(prestation.acte);
    if (frequencyBeneficiary && frequencyAct) {
      const key = `${frequencyBeneficiary}:${frequencyAct}`;
      frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
    }

    if (prestation.matriculeBeneficiaire) {
      const ref = beneficiaries.get(prestation.matriculeBeneficiaire);
      if (!ref || !ref.actif) push(prestation, "BENEFICIAIRE", "BENEFICIAIRE_REFERENTIEL", "Bénéficiaire absent ou inactif dans le référentiel.", "critique");
    }
    if (prestation.codePrestataire || prestation.prestataire) {
      const ref = prestation.codePrestataire ? providers.get(prestation.codePrestataire) : providersByName.get(normalize(prestation.prestataire));
      if (!ref || !ref.actif || ["radie", "suspendu"].includes(ref.statut)) push(prestation, "PRESTATAIRE", "PRESTATAIRE_REFERENTIEL", "Prestataire absent, radié ou suspendu.", "critique");
    }
    if (prestation.codeActe || prestation.acte) {
      const ref = prestation.codeActe ? acts.get(prestation.codeActe) : actsByLabel.get(normalize(prestation.acte));
      if (!ref || !ref.actif || !ref.couvert) push(prestation, "ACTE", "ACTE_NON_COUVERT", "Acte absent, inactif ou non couvert.", "eleve");
      if (ref && Number(ref.tarifConventionne) > 0 && claimed > Number(ref.tarifConventionne)) {
        push(prestation, "MONTANT", "DEPASSEMENT_TARIF", "Le montant réclamé dépasse le tarif conventionné.", "eleve", claimed - Number(ref.tarifConventionne));
      }
    }
  }

  for (const external of externalPrestations) {
    const duplicateKey = functionalDuplicateKey(external);
    if (!duplicateKey) continue;
    const matches = externalBySignature.get(duplicateKey) ?? [];
    matches.push(external);
    externalBySignature.set(duplicateKey, matches);
  }

  const partialDuplicateIds = new Set<string>();
  for (const matches of partialGroups.values()) {
    const distinctAmounts = new Set(matches.map(amountOf).map((amount) => amount.toFixed(2)));
    if (matches.length < 2 || distinctAmounts.size < 2) continue;
    const ordered = [...matches].sort((left, right) => amountOf(left) - amountOf(right) || Number(left.id - right.id));
    const observed = [...distinctAmounts].sort((left, right) => Number(left) - Number(right)).map((amount) => `${Math.round(Number(amount)).toLocaleString("fr-FR")} F`).join(" / ");
    for (const duplicate of ordered.slice(1)) {
      partialDuplicateIds.add(duplicate.id.toString());
      push(
        duplicate,
        "DOUBLON",
        "DOUBLON_PARTIEL",
        `Même soin facturé ${matches.length} fois avec des montants différents (${observed}).`,
        "eleve",
        amountOf(duplicate),
      );
    }
  }

  for (const matches of functionalGroups.values()) {
    if (matches.length < 2) continue;
    const ordered = [...matches].sort((left, right) => Number(left.id - right.id));
    const gravite: Gravite = ordered.length >= 4 ? "critique" : "eleve";
    for (const duplicate of ordered.slice(1)) {
      if (partialDuplicateIds.has(duplicate.id.toString())) continue;
      push(
        duplicate,
        "DOUBLON",
        "DOUBLON_FONCTIONNEL",
        `Prestation facturée ${ordered.length} fois avec la même clé métier.`,
        gravite,
        amountOf(duplicate),
      );
    }
  }

  for (const prestation of prestations) {
    const duplicateKey = functionalDuplicateKey(prestation);
    if (duplicateKey) {
      const externalMatches = externalBySignature.get(duplicateKey) ?? [];
      if (externalMatches.some((item) => item.fichier.moisFichier !== file.moisFichier || item.fichier.anneeFichier !== file.anneeFichier)) {
        push(prestation, "DOUBLON", "DOUBLON_INTER_MOIS", "Prestation similaire détectée dans un autre mois.", "critique", amountOf(prestation));
      }
      if (externalMatches.some((item) => item.gestionnaireId !== file.gestionnaireId)) {
        push(prestation, "DOUBLON", "DOUBLON_INTER_GESTIONNAIRE", "Prestation similaire détectée chez un autre gestionnaire.", "critique", amountOf(prestation));
      }
    }
    const frequencyBeneficiary = normalize(prestation.matriculeBeneficiaire) || normalize(`${prestation.nomBeneficiaire ?? ""} ${prestation.prenomsBeneficiaire ?? ""} ${prestation.statutBeneficiaire ?? ""}`);
    const frequencyAct = normalize(prestation.codeActe) || normalize(prestation.acte);
    if (frequencyBeneficiary && frequencyAct && (frequencies.get(`${frequencyBeneficiary}:${frequencyAct}`) ?? 0) > 5) {
      push(prestation, "FREQUENCE", "REPETITION_ACTE", "Le même acte est répété plus de cinq fois pour ce bénéficiaire.");
    }
  }

  const anomalyCounts = new Map<bigint, number>();
  for (const anomaly of anomalies) anomalyCounts.set(anomaly.prestationId, (anomalyCounts.get(anomaly.prestationId) ?? 0) + 1);
  const impacted = new Set(anomalies.map((anomaly) => anomaly.prestationId.toString())).size;
  const tardifs = anomalies.filter((anomaly) => ["HORS_EXERCICE", "DELAI_TARDIF_DEPASSE"].includes(anomaly.codeAnomalie)).length;
  const duplicates = anomalies.filter((anomaly) => anomaly.categorie === "DOUBLON").length;
  const totalClaimed = prestations.reduce((sum, prestation) => sum + Number(prestation.montantReclame), 0);
  const totalImpact = anomalies.reduce((sum, anomaly) => sum + anomaly.montantImpacte, 0);

  await prisma.$transaction(async (tx) => {
    await tx.anomalie.deleteMany({ where: { fichierImporteId: fileId } });
    await tx.prestation.updateMany({ where: { fichierImporteId: fileId }, data: { nbAnomalies: 0, estValide: true, estRejetee: false } });
    for (let index = 0; index < anomalies.length; index += 500) {
      await tx.anomalie.createMany({ data: anomalies.slice(index, index + 500) });
    }
    for (const [prestationId, count] of anomalyCounts) {
      await tx.prestation.update({ where: { id: prestationId }, data: { nbAnomalies: count, estValide: false } });
    }
    await tx.fichierImporte.update({
      where: { id: fileId },
      data: {
        nbLignesTotal: prestations.length,
        nbLignesValides: prestations.length - impacted,
        nbLignesAnomalies: impacted,
        nbLignesTardives: tardifs,
        nbDoublons: duplicates,
        montantTotalReclame: totalClaimed,
        montantNetRecommande: Math.max(0, totalClaimed - totalImpact),
        tauxAnomalie: prestations.length ? (impacted / prestations.length) * 100 : 0,
        statut: "analyse",
      },
    });
  }, { timeout: 120_000 });

  return { prestations: prestations.length, anomalies: anomalies.length, lignesImpactees: impacted, montantReclame: totalClaimed, montantImpacte: totalImpact };
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function amountOf(prestation: { montantPaye: unknown; montantReclame: unknown }) {
  return Number(prestation.montantPaye || prestation.montantReclame || 0);
}

function partialDuplicateKey(prestation: {
  matriculeBeneficiaire: string | null;
  nomBeneficiaire: string | null;
  prenomsBeneficiaire?: string | null;
  dateSoins: Date | null;
  codeActe: string | null;
  acte: string | null;
  codePrestataire: string | null;
  prestataire: string | null;
}) {
  const beneficiary = normalize(prestation.matriculeBeneficiaire) || normalize(`${prestation.nomBeneficiaire ?? ""} ${prestation.prenomsBeneficiaire ?? ""}`);
  const act = normalize(prestation.codeActe) || normalize(prestation.acte);
  const provider = normalize(prestation.codePrestataire) || normalize(prestation.prestataire);
  const date = prestation.dateSoins ? prestation.dateSoins.toISOString().slice(0, 10) : "";
  if (!beneficiary || !date || !act || !provider) return null;
  return [beneficiary, date, act, provider].join("|");
}

function normalize(value: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}
