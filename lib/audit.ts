import type { CategorieAnomalie, Gravite, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditPrestation = {
  id: string;
  numeroPrestation: string | null;
  nomBeneficiaire: string | null;
  prenomsBeneficiaire: string | null;
  matriculeBeneficiaire: string | null;
  nomAssurePrincipal: string | null;
  prestataire: string | null;
  codePrestataire: string | null;
  codeActe: string | null;
  dateSoins: Date | null;
  dateComptable: Date | null;
  montantReclame: number;
  montantPaye: number;
};

type AuditRow = {
  id: string;
  codeAnomalie: string;
  categorie: CategorieAnomalie;
  description: string;
  gravite: Gravite;
  montantImpacte: number;
  prestation: AuditPrestation | null;
};

const prestationSelect = {
  id: true,
  numeroPrestation: true,
  nomBeneficiaire: true,
  prenomsBeneficiaire: true,
  matriculeBeneficiaire: true,
  nomAssurePrincipal: true,
  prestataire: true,
  codePrestataire: true,
  codeActe: true,
  dateSoins: true,
  dateComptable: true,
  montantReclame: true,
  montantPaye: true,
  fichier: {
    select: {
      moisFichier: true,
      anneeFichier: true,
    },
  },
} satisfies Prisma.PrestationSelect;

type SelectedPrestation = Prisma.PrestationGetPayload<{ select: typeof prestationSelect }>;

function money(value: unknown) {
  return Number(value ?? 0);
}

function normalizePrestation(prestation: SelectedPrestation): AuditPrestation {
  return {
    id: prestation.id.toString(),
    numeroPrestation: prestation.numeroPrestation,
    nomBeneficiaire: prestation.nomBeneficiaire,
    prenomsBeneficiaire: prestation.prenomsBeneficiaire,
    matriculeBeneficiaire: prestation.matriculeBeneficiaire,
    nomAssurePrincipal: prestation.nomAssurePrincipal,
    prestataire: prestation.prestataire,
    codePrestataire: prestation.codePrestataire,
    codeActe: prestation.codeActe,
    dateSoins: prestation.dateSoins,
    dateComptable: prestation.dateComptable,
    montantReclame: money(prestation.montantReclame),
    montantPaye: money(prestation.montantPaye),
  };
}

function row(categorie: CategorieAnomalie, codeAnomalie: string, description: string, prestation: SelectedPrestation, gravite: Gravite = "eleve", montantImpacte = money(prestation.montantPaye)): AuditRow {
  return {
    id: `${codeAnomalie}-${prestation.id.toString()}`,
    codeAnomalie,
    categorie,
    description,
    gravite,
    montantImpacte,
    prestation: normalizePrestation(prestation),
  };
}

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

async function storedRows(categorie: CategorieAnomalie): Promise<AuditRow[]> {
  const anomalies = await prisma.anomalie.findMany({
    where: categorie === "DOUBLON" ? { categorie, codeAnomalie: { not: "DOUBLON_STRICT" } } : { categorie },
    include: {
      prestation: {
        select: prestationSelect,
      },
    },
    take: 100,
  });

  return anomalies.map((anomalie) => ({
    id: anomalie.id.toString(),
    codeAnomalie: anomalie.codeAnomalie,
    categorie: anomalie.categorie,
    description: anomalie.description ?? anomalie.codeAnomalie,
    gravite: anomalie.gravite,
    montantImpacte: money(anomalie.montantImpacte),
    prestation: anomalie.prestation ? normalizePrestation(anomalie.prestation) : null,
  }));
}

async function temporalRows() {
  const prestations = await prisma.prestation.findMany({ select: prestationSelect, take: 500 });
  const now = new Date();
  const rows: AuditRow[] = [];

  for (const prestation of prestations) {
    if (prestation.dateSoins && prestation.dateSoins > now) {
      rows.push(row("TEMPOREL", "DATE_SOINS_FUTURE", "Date de soins postérieure à la date courante", prestation, "critique"));
    }

    if (prestation.dateSoins) {
      const { start, end } = monthBounds(prestation.fichier.anneeFichier, prestation.fichier.moisFichier);
      if (prestation.dateSoins < start || prestation.dateSoins > end) {
        rows.push(row("TEMPOREL", "PRESTATION_TARDIVE", "Prestation hors période d'audit du fichier", prestation, "critique"));
      }
    }

    if (prestation.dateSoins && prestation.dateComptable) {
      const diff = Math.abs(prestation.dateComptable.getTime() - prestation.dateSoins.getTime()) / 86400000;
      if (diff > 90) {
        rows.push(row("TEMPOREL", "ECART_DATE_EXCESSIF", "Ecart dateSoins/dateComptable supérieur à 90 jours", prestation, "eleve"));
      }
    }
  }

  return rows;
}

async function integrityRows() {
  const prestations = await prisma.prestation.findMany({
    where: {
      OR: [
        { dateSoins: null },
        { codeActe: null },
        { codePrestataire: null },
        { matriculeBeneficiaire: null },
        { montantReclame: { lt: 0 } },
        { montantPaye: { lt: 0 } },
      ],
    },
    select: prestationSelect,
    take: 100,
  });

  return prestations.map((prestation) => row("INTEGRITE", "CHAMPS_OBLIGATOIRES", "Champ obligatoire manquant ou montant négatif", prestation, "eleve"));
}

async function montantRows() {
  const prestations = await prisma.prestation.findMany({
    where: {
      OR: [
        { montantPaye: { gt: prisma.prestation.fields.montantReclame } },
        { montantReclame: { lt: 0 } },
        { montantPaye: { lt: 0 } },
      ],
    },
    select: prestationSelect,
    take: 100,
  });

  return prestations.map((prestation) => {
    const surplus = Math.max(0, money(prestation.montantPaye) - money(prestation.montantReclame));
    return row("MONTANT", "MONTANT_INCOHERENT", "Montant payé supérieur au montant réclamé ou montant négatif", prestation, "eleve", surplus || money(prestation.montantPaye));
  });
}

async function doublonRows() {
  return [];
}

async function beneficiaireRows() {
  const prestations = await prisma.prestation.findMany({
    where: { matriculeBeneficiaire: { not: null } },
    select: { ...prestationSelect, compagnieId: true },
    take: 500,
  });
  const refs = await prisma.refAssure.findMany({
    select: { compagnieId: true, matricule: true, actif: true },
  });
  const refKeys = new Set(refs.map((ref) => `${ref.compagnieId}:${ref.matricule}`));
  const inactiveKeys = new Set(refs.filter((ref) => !ref.actif).map((ref) => `${ref.compagnieId}:${ref.matricule}`));

  return prestations
    .filter((prestation) => {
      const key = `${prestation.compagnieId}:${prestation.matriculeBeneficiaire}`;
      return !refKeys.has(key) || inactiveKeys.has(key);
    })
    .slice(0, 100)
    .map((prestation) => row("BENEFICIAIRE", "BENEFICIAIRE_REFERENTIEL", "Bénéficiaire absent ou inactif dans le référentiel", prestation, "critique"));
}

async function prestataireRows() {
  const prestations = await prisma.prestation.findMany({
    where: { codePrestataire: { not: null } },
    select: { ...prestationSelect, compagnieId: true },
    take: 500,
  });
  const refs = await prisma.refPrestataire.findMany({
    select: { compagnieId: true, code: true, actif: true, statut: true },
  });
  const validKeys = new Set(refs.filter((ref) => ref.actif && ref.statut !== "radie" && ref.statut !== "suspendu").map((ref) => `${ref.compagnieId}:${ref.code}`));

  return prestations
    .filter((prestation) => !validKeys.has(`${prestation.compagnieId}:${prestation.codePrestataire}`))
    .slice(0, 100)
    .map((prestation) => row("PRESTATAIRE", "PRESTATAIRE_REFERENTIEL", "Prestataire absent, radié ou suspendu dans le référentiel", prestation, "critique"));
}

async function acteRows() {
  const prestations = await prisma.prestation.findMany({
    where: { OR: [{ codeActe: null }, { acte: null }] },
    select: prestationSelect,
    take: 100,
  });

  return prestations.map((prestation) => row("ACTE", "ACTE_NON_RENSEIGNE", "Acte médical ou code acte non renseigné", prestation, "eleve"));
}

async function frequenceRows() {
  const groups = await prisma.prestation.groupBy({
    by: ["matriculeBeneficiaire", "codeActe"],
    where: {
      matriculeBeneficiaire: { not: null },
      codeActe: { not: null },
    },
    _count: { id: true },
    having: { id: { _count: { gt: 5 } } },
    orderBy: { _count: { id: "desc" } },
    take: 50,
  });

  const rows: AuditRow[] = [];
  for (const group of groups) {
    const prestation = await prisma.prestation.findFirst({
      where: {
        matriculeBeneficiaire: group.matriculeBeneficiaire,
        codeActe: group.codeActe,
      },
      select: prestationSelect,
    });
    if (prestation) {
      rows.push(row("FREQUENCE", "REPETITION_ACTE", `Acte répété ${group._count.id} fois pour le même bénéficiaire`, prestation, "eleve"));
    }
  }
  return rows;
}

async function computedRows(categorie: CategorieAnomalie) {
  switch (categorie) {
    case "TEMPOREL":
      return temporalRows();
    case "INTEGRITE":
      return integrityRows();
    case "MONTANT":
      return montantRows();
    case "DOUBLON":
      return doublonRows();
    case "BENEFICIAIRE":
      return beneficiaireRows();
    case "PRESTATAIRE":
      return prestataireRows();
    case "ACTE":
      return acteRows();
    case "FREQUENCE":
      return frequenceRows();
    default:
      return [];
  }
}

function stats(rows: AuditRow[]) {
  const bySeverity = new Map<Gravite, { gravite: Gravite; _count: number; _sum: { montantImpacte: number } }>();
  for (const item of rows) {
    const current = bySeverity.get(item.gravite) ?? { gravite: item.gravite, _count: 0, _sum: { montantImpacte: 0 } };
    current._count += 1;
    current._sum.montantImpacte += item.montantImpacte;
    bySeverity.set(item.gravite, current);
  }
  return [...bySeverity.values()];
}

export async function getAuditReport(categorie: CategorieAnomalie) {
  const [persisted, computed] = await Promise.all([storedRows(categorie), computedRows(categorie)]);
  const byId = new Map<string, AuditRow>();
  for (const item of [...persisted, ...computed]) byId.set(item.id, item);
  const anomalies = [...byId.values()].slice(0, 100);
  const totalMontant = anomalies.reduce((sum, item) => sum + item.montantImpacte, 0);

  return {
    anomalies,
    stats: stats(anomalies),
    totalMontant,
    count: anomalies.length,
  };
}
