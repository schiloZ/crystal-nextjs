import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

type Intent =
  | "SUMMARY"
  | "ANOMALIES_BY_CATEGORY"
  | "TOP_PROVIDERS"
  | "TOP_BENEFICIARIES"
  | "DUPLICATES"
  | "LATE_CLAIMS"
  | "FILES"
  | "AMOUNTS"
  | "DATABASE_CATALOG"
  | "TABLE_QUERY"
  | "TABLE_COUNT";

type TableName =
  | "COMPAGNIES"
  | "FILIALES"
  | "GESTIONNAIRES"
  | "EXERCICES"
  | "UTILISATEURS"
  | "FICHIERS"
  | "HISTORIQUE_IMPORTATIONS"
  | "PRESTATIONS"
  | "ANOMALIES"
  | "REF_ASSURES"
  | "REF_PRESTATAIRES"
  | "REF_ACTES"
  | "REF_CONTRATS"
  | "REF_PLAFONDS";

type Plan = {
  intent: Intent;
  limit?: number;
  year?: number;
  month?: number;
  table?: TableName;
  search?: string;
};

type Result = {
  answer: string;
  intent: Intent;
  rows: Array<Record<string, string | number>>;
};

const intents: Intent[] = ["SUMMARY", "ANOMALIES_BY_CATEGORY", "TOP_PROVIDERS", "TOP_BENEFICIARIES", "DUPLICATES", "LATE_CLAIMS", "FILES", "AMOUNTS", "DATABASE_CATALOG", "TABLE_QUERY", "TABLE_COUNT"];
const tableNames: TableName[] = ["COMPAGNIES", "FILIALES", "GESTIONNAIRES", "EXERCICES", "UTILISATEURS", "FICHIERS", "HISTORIQUE_IMPORTATIONS", "PRESTATIONS", "ANOMALIES", "REF_ASSURES", "REF_PRESTATAIRES", "REF_ACTES", "REF_CONTRATS", "REF_PLAFONDS"];
// Les appels à un fournisseur externe sont désactivés par défaut : ils exigent
// ASSISTANT_AI_EXTERNAL=true en plus d'une clé, après validation DPO.
const externalAllowed = process.env.ASSISTANT_AI_EXTERNAL === "true";
const provider = !externalAllowed ? "local" : process.env.GROQ_API_KEY ? "groq" : process.env.OPENAI_API_KEY ? "openai" : "local";
const MAX_QUESTION_LENGTH = 500;
// Champs nominatifs jamais transmis au fournisseur externe.
const PERSONAL_FIELD = /nom|prenom|matricule|email|telephone|contact|benef|assure|naissance/i;
const model = provider === "groq" ? process.env.GROQ_MODEL || "openai/gpt-oss-120b" : process.env.OPENAI_MODEL || "gpt-5.5";

const tableCatalog: Record<TableName, {
  label: string;
  delegate: string;
  scopedByCompany: boolean;
  defaultOrder?: Record<string, "asc" | "desc">;
  fields: string[];
  searchFields: string[];
}> = {
  COMPAGNIES: { label: "Compagnies", delegate: "compagnie", scopedByCompany: false, defaultOrder: { id: "desc" }, fields: ["id", "code", "nom", "ville", "telephone", "email", "actif", "createdAt"], searchFields: ["code", "nom", "ville", "email"] },
  FILIALES: { label: "Filiales", delegate: "filiale", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "compagnieId", "code", "nom", "ville", "telephone", "email", "actif"], searchFields: ["code", "nom", "ville", "email"] },
  GESTIONNAIRES: { label: "Gestionnaires", delegate: "gestionnaire", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "compagnieId", "code", "nom", "prenoms", "contact", "telephone", "email", "actif"], searchFields: ["code", "nom", "prenoms", "contact", "email"] },
  EXERCICES: { label: "Exercices comptables", delegate: "exerciceComptable", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "compagnieId", "codeExercice", "dateDebut", "dateFin", "dateDebutToleranceTardif", "dateFinToleranceTardif", "actif"], searchFields: ["codeExercice"] },
  UTILISATEURS: { label: "Utilisateurs", delegate: "utilisateur", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "compagnieId", "filialeId", "nom", "prenoms", "email", "role", "actif", "derniereConnexion", "createdAt"], searchFields: ["nom", "prenoms", "email"] },
  FICHIERS: { label: "Fichiers importés", delegate: "fichierImporte", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "compagnieId", "filialeId", "gestionnaireId", "exerciceId", "moisFichier", "anneeFichier", "nomFichier", "nbLignesTotal", "nbLignesValides", "nbLignesAnomalies", "nbLignesTardives", "nbDoublons", "montantTotalReclame", "montantNetRecommande", "tauxAnomalie", "statut", "dateImport"], searchFields: ["nomFichier"] },
  HISTORIQUE_IMPORTATIONS: { label: "Historique importations", delegate: "historiqueImportation", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "compagnieId", "fichierImporteId", "nomFichier", "action", "utilisateurId", "utilisateurNom", "utilisateurEmail", "nbLignesTotal", "nbAnomalies", "createdAt"], searchFields: ["nomFichier", "action", "utilisateurNom", "utilisateurEmail"] },
  PRESTATIONS: { label: "Prestations", delegate: "prestation", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "fichierImporteId", "compagnieId", "filialeId", "gestionnaireId", "exerciceId", "numeroPrestation", "dateSoins", "dateComptable", "codeActe", "acte", "famillePrestation", "codePrestataire", "prestataire", "matriculeBeneficiaire", "nomBeneficiaire", "nomAssurePrincipal", "police", "college", "montantReclame", "montantPaye", "estValide", "estTardive", "estRejetee", "nbAnomalies"], searchFields: ["numeroPrestation", "codeActe", "acte", "famillePrestation", "codePrestataire", "prestataire", "matriculeBeneficiaire", "nomBeneficiaire", "nomAssurePrincipal", "police", "college"] },
  ANOMALIES: { label: "Anomalies", delegate: "anomalie", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "prestationId", "fichierImporteId", "compagnieId", "filialeId", "categorie", "codeAnomalie", "description", "gravite", "montantImpacte", "matriculeBenef", "nomBenef", "dateDetection"], searchFields: ["codeAnomalie", "description", "matriculeBenef", "nomBenef"] },
  REF_ASSURES: { label: "Référentiel assurés", delegate: "refAssure", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "compagnieId", "matricule", "nom", "prenom", "dateNaissance", "sexe", "statut", "dateAffiliation", "dateRadiation", "dateFinDroit", "codeSouscripteur", "souscripteur", "matriculeAssurePrincipal", "nomAssurePrincipal", "police", "policeInterne", "numeroCollege", "college", "actif"], searchFields: ["matricule", "nom", "prenom", "statut", "codeSouscripteur", "souscripteur", "matriculeAssurePrincipal", "nomAssurePrincipal", "police", "college"] },
  REF_PRESTATAIRES: { label: "Référentiel prestataires", delegate: "refPrestataire", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "compagnieId", "code", "nom", "statut", "actif"], searchFields: ["code", "nom", "statut"] },
  REF_ACTES: { label: "Référentiel actes", delegate: "refActe", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "compagnieId", "codeActe", "libelle", "famille", "tarifConventionne", "couvert", "actif"], searchFields: ["codeActe", "libelle", "famille"] },
  REF_CONTRATS: { label: "Référentiel contrats", delegate: "refContrat", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "compagnieId", "codeContrat", "libelle", "police", "policeInterne", "codeSouscripteur", "souscripteur", "dateDebut", "dateFin", "actif"], searchFields: ["codeContrat", "libelle", "police", "policeInterne", "codeSouscripteur", "souscripteur"] },
  REF_PLAFONDS: { label: "Référentiel plafonds", delegate: "refPlafond", scopedByCompany: true, defaultOrder: { id: "desc" }, fields: ["id", "compagnieId", "contratId", "codePlafond", "libelle", "typePlafond", "police", "numeroCollege", "codeActe", "famille", "montantPlafond", "periodicite", "actif"], searchFields: ["codePlafond", "libelle", "typePlafond", "police", "numeroCollege", "codeActe", "famille", "periodicite"] },
};

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Question vide." }, { status: 400 });
  if (question.length > MAX_QUESTION_LENGTH) return NextResponse.json({ error: `La question ne doit pas dépasser ${MAX_QUESTION_LENGTH} caractères.` }, { status: 400 });

  const plan = forcedPlan(question) ?? await buildPlan(question);
  const result = await runIntent(plan, user.compagnieId, user.role === "super_admin");
  const answer = await summarize(question, result);

  return NextResponse.json({
    answer,
    intent: result.intent,
    model: provider === "local" ? "local-fallback" : `${provider}:${model}`,
    rows: result.rows,
    suggestions: [
      "Filtre par fichier ou par année.",
      "Compare les gestionnaires.",
      "Explique les principales anomalies.",
    ],
  });
}

async function buildPlan(question: string): Promise<Plan> {
  if (provider === "local") return fallbackPlan(question);
  try {
    const text = await completeJson([
      {
        role: "system",
        content: "Tu convertis une question métier en plan JSON. Choisis une seule intention autorisée. Ne propose jamais de SQL. Réponds uniquement en JSON valide.",
      },
      {
        role: "user",
        content: `Intentions autorisées: ${intents.join(", ")}.
Tables autorisées pour TABLE_QUERY et TABLE_COUNT: ${tableNames.join(", ")}.
Utilise TABLE_COUNT pour les questions du type "combien de", "nombre de", "total de lignes dans une table".
Champs JSON attendus: intent, limit, year, month, table, search.
Question: ${question}`,
      },
    ]);
    const parsed = JSON.parse(text) as Plan;
    return sanitizePlan(parsed);
  } catch {
    return fallbackPlan(question);
  }
}

async function summarize(question: string, result: Result) {
  if (result.answer) return result.answer;
  if (result.intent === "TABLE_COUNT") return deterministicAnswer(result);
  if (provider === "local") return deterministicAnswer(result);
  try {
    return await completeText([
      {
        role: "system",
        content: "Tu es l'assistant BI de CRYSTAL. Les données JSON viennent de requêtes Prisma exécutées sur la base de données CRYSTAL, pas de données fournies par l'utilisateur. Réponds en français, clairement, sans inventer. Ne dis jamais \"données fournies\" ou \"données partagées\". Ne génère aucun Markdown: pas de **gras**, pas de liste avec tirets ou étoiles, pas de tableau Markdown, pas de backticks. L'interface affiche déjà le tableau de données sous ta réponse. Fais une synthèse courte en texte simple.",
      },
      {
        role: "user",
        content: `Question: ${question}\nIntention: ${result.intent}\nRésultats de la base CRYSTAL en JSON: ${JSON.stringify(maskPersonalData(result.rows.slice(0, 20)))}`,
      },
    ]);
  } catch {
    return deterministicAnswer(result);
  }
}

async function runIntent(plan: Plan, companyId: number, isSuperAdmin: boolean): Promise<Result> {
  const fileWhere = {
    ...(isSuperAdmin ? {} : { compagnieId: companyId }),
    ...(plan.year ? { anneeFichier: plan.year } : {}),
    ...(plan.month ? { moisFichier: plan.month } : {}),
  };
  const files = await prisma.fichierImporte.findMany({
    where: fileWhere,
    include: { compagnie: true, filiale: true, gestionnaire: true },
    orderBy: [{ anneeFichier: "desc" }, { moisFichier: "desc" }, { dateImport: "desc" }],
    take: 200,
  });
  const fileIds = files.map((file) => file.id);
  const scopedIds = fileIds.length ? { in: fileIds } : { in: [-1] };
  const limit = Math.min(Math.max(plan.limit ?? 10, 1), 25);

  if (plan.intent === "DATABASE_CATALOG") {
    const rows = await Promise.all(tableNames.map(async (table) => {
      const config = tableCatalog[table];
      const where = scopedWhere(config, companyId, isSuperAdmin);
      const count = await (prisma as any)[config.delegate].count({ where });
      return {
        "Table": table,
        "Libellé": config.label,
        "Lignes": count,
        "Champs lisibles": config.fields.join(", "),
      };
    }));
    return { intent: plan.intent, rows, answer: `J'ai accès en lecture à ${rows.length} table(s) de la base CRYSTAL dans votre périmètre. Le détail est affiché dans le tableau ci-dessous.` };
  }

  if (plan.intent === "TABLE_QUERY") {
    const table = plan.table && tableCatalog[plan.table] ? plan.table : inferTableFromSearch(plan.search ?? "") ?? "FICHIERS";
    const rows = await readTable(table, companyId, isSuperAdmin, limit, plan.search);
    return { intent: plan.intent, rows, answer: `J'ai trouvé ${rows.length} ligne(s) dans ${tableCatalog[table].label}. Le détail est affiché dans le tableau ci-dessous.` };
  }

  if (plan.intent === "TABLE_COUNT") {
    const table = plan.table && tableCatalog[plan.table] ? plan.table : inferTableFromSearch(plan.search ?? "") ?? "FICHIERS";
    const config = tableCatalog[table];
    const count = await (prisma as any)[config.delegate].count({
      where: {
        ...scopedWhere(config, companyId, isSuperAdmin),
        ...searchWhere(config.searchFields, plan.search),
      },
    });
    return {
      intent: plan.intent,
      rows: [{
        "Table": table,
        "Libellé": config.label,
        "Nombre": count,
      }],
      answer: `Il y a ${count} enregistrement(s) dans ${config.label}.`,
    };
  }

  if (plan.intent === "SUMMARY") {
    const rows = [{
      "Fichiers": files.length,
      "Lignes": files.reduce((sum, file) => sum + file.nbLignesTotal, 0),
      "Anomalies": files.reduce((sum, file) => sum + file.nbLignesAnomalies, 0),
      "Doublons": files.reduce((sum, file) => sum + file.nbDoublons, 0),
      "Montant réclamé": money(files.reduce((sum, file) => sum + Number(file.montantTotalReclame), 0)),
      "Montant recommandé": money(files.reduce((sum, file) => sum + Number(file.montantNetRecommande), 0)),
    }];
    return { intent: plan.intent, rows, answer: "" };
  }

  if (plan.intent === "FILES") {
    const rows = files.slice(0, limit).map((file) => ({
      "Fichier": file.nomFichier,
      "Période": `${String(file.moisFichier).padStart(2, "0")}/${file.anneeFichier}`,
      "Filiale": file.filiale.nom,
      "Gestionnaire": fullName(file.gestionnaire.prenoms, file.gestionnaire.nom),
      "Lignes": file.nbLignesTotal,
      "Taux anomalie": `${Number(file.tauxAnomalie).toFixed(1)}%`,
    }));
    return { intent: plan.intent, rows, answer: "" };
  }

  if (plan.intent === "ANOMALIES_BY_CATEGORY") {
    const grouped = await prisma.anomalie.groupBy({
      by: ["categorie"],
      where: { fichierImporteId: scopedIds, codeAnomalie: { not: "DOUBLON_STRICT" } },
      _count: { id: true },
      _sum: { montantImpacte: true },
      orderBy: { _count: { id: "desc" } },
    });
    const rows = grouped.map((row) => ({
      "Catégorie": row.categorie,
      "Nombre": row._count.id,
      "Montant impacté": money(Number(row._sum.montantImpacte ?? 0)),
    }));
    return { intent: plan.intent, rows, answer: "" };
  }

  if (plan.intent === "TOP_PROVIDERS") {
    const grouped = await prisma.prestation.groupBy({
      by: ["codePrestataire", "prestataire"],
      where: { fichierImporteId: scopedIds },
      _count: { id: true },
      _sum: { montantReclame: true, nbAnomalies: true },
      orderBy: { _sum: { montantReclame: "desc" } },
      take: limit,
    });
    const rows = grouped.map((row) => ({
      "Code": row.codePrestataire ?? "-",
      "Prestataire": row.prestataire ?? "Non renseigné",
      "Lignes": row._count.id,
      "Anomalies": row._sum.nbAnomalies ?? 0,
      "Montant": money(Number(row._sum.montantReclame ?? 0)),
    }));
    return { intent: plan.intent, rows, answer: "" };
  }

  if (plan.intent === "TOP_BENEFICIARIES") {
    const grouped = await prisma.prestation.groupBy({
      by: ["matriculeBeneficiaire", "nomBeneficiaire"],
      where: { fichierImporteId: scopedIds },
      _count: { id: true },
      _sum: { montantReclame: true, nbAnomalies: true },
      orderBy: { _sum: { montantReclame: "desc" } },
      take: limit,
    });
    const rows = grouped.map((row) => ({
      "Matricule": row.matriculeBeneficiaire ?? "-",
      "Bénéficiaire": row.nomBeneficiaire ?? "Non renseigné",
      "Lignes": row._count.id,
      "Anomalies": row._sum.nbAnomalies ?? 0,
      "Montant": money(Number(row._sum.montantReclame ?? 0)),
    }));
    return { intent: plan.intent, rows, answer: "" };
  }

  if (plan.intent === "DUPLICATES" || plan.intent === "LATE_CLAIMS" || plan.intent === "AMOUNTS") {
    const where = plan.intent === "DUPLICATES"
      ? { fichierImporteId: scopedIds, categorie: "DOUBLON" as const, codeAnomalie: { not: "DOUBLON_STRICT" } }
      : plan.intent === "LATE_CLAIMS"
        ? { fichierImporteId: scopedIds, categorie: "TEMPOREL" as const, codeAnomalie: { in: ["HORS_EXERCICE", "DELAI_TARDIF_DEPASSE"] } }
        : { fichierImporteId: scopedIds, categorie: "MONTANT" as const };
    const grouped = await prisma.anomalie.groupBy({
      by: ["codeAnomalie", "gravite"],
      where,
      _count: { id: true },
      _sum: { montantImpacte: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    });
    const rows = grouped.map((row) => ({
      "Type": row.codeAnomalie,
      "Gravité": row.gravite,
      "Nombre": row._count.id,
      "Montant impacté": money(Number(row._sum.montantImpacte ?? 0)),
    }));
    return { intent: plan.intent, rows, answer: "" };
  }

  return { intent: "SUMMARY", rows: [], answer: "" };
}

function fallbackPlan(question: string): Plan {
  const text = question.toLowerCase();
  const limit = Number(text.match(/\b(\d{1,2})\b/)?.[1]) || 10;
  const year = Number(text.match(/\b(20\d{2})\b/)?.[1]) || undefined;
  const forced = forcedPlan(question);
  if (forced) return { ...forced, limit, year };
  if (text.includes("doublon")) return { intent: "DUPLICATES", limit, year };
  if (text.includes("tardif") || text.includes("hors exercice")) return { intent: "LATE_CLAIMS", limit, year };
  if (text.includes("prestataire")) return { intent: "TOP_PROVIDERS", limit, year };
  if (text.includes("bénéfic") || text.includes("benefic")) return { intent: "TOP_BENEFICIARIES", limit, year };
  if (text.includes("catégorie") || text.includes("categorie") || text.includes("anomal")) return { intent: "ANOMALIES_BY_CATEGORY", limit, year };
  if (text.includes("fichier") || text.includes("audit")) return { intent: "FILES", limit, year };
  if (text.includes("montant") || text.includes("réclam") || text.includes("reclam")) return { intent: "AMOUNTS", limit, year };
  const table = inferTableFromSearch(text);
  if (text.includes("table") || text.includes("liste") || text.includes("affiche") || table) return { intent: "TABLE_QUERY", table: table ?? "FICHIERS", search: question, limit, year };
  if (text.includes("base") || text.includes("schema") || text.includes("schéma")) return { intent: "DATABASE_CATALOG", limit, year };
  return { intent: "SUMMARY", limit, year };
}

function forcedPlan(question: string): Plan | null {
  const text = question.toLowerCase();
  if ((text.includes("accès") || text.includes("acces") || text.includes("voir") || text.includes("lire")) && text.includes("base")) return { intent: "DATABASE_CATALOG" };
  const table = inferTableFromSearch(text);
  if (!table) return null;
  if (/\b(combien|nombre|total|nb)\b/.test(text)) return { intent: "TABLE_COUNT", table };
  return null;
}

function sanitizePlan(plan: Plan): Plan {
  return {
    intent: intents.includes(plan.intent) ? plan.intent : "SUMMARY",
    limit: Number.isFinite(plan.limit) ? Math.min(Math.max(Number(plan.limit), 1), 25) : 10,
    year: Number.isInteger(plan.year) ? plan.year : undefined,
    month: Number.isInteger(plan.month) && plan.month! >= 1 && plan.month! <= 12 ? plan.month : undefined,
    table: tableNames.includes(plan.table as TableName) ? plan.table : undefined,
    search: typeof plan.search === "string" ? plan.search.slice(0, 120) : undefined,
  };
}

function deterministicAnswer(result: Result) {
  if (!result.rows.length) return "Je n'ai trouvé aucune donnée correspondant à cette question dans votre périmètre.";
  const first = result.rows[0];
  if (result.intent === "TABLE_COUNT" && typeof first["Nombre"] !== "undefined") return `Il y a ${first["Nombre"]} enregistrement(s) dans ${first["Libellé"]}.`;
  if (result.intent === "DATABASE_CATALOG") return `J'ai accès en lecture à ${result.rows.length} table(s) de la base CRYSTAL dans votre périmètre. Le détail des tables est affiché ci-dessous.`;
  return `J'ai trouvé ${result.rows.length} ligne(s) pour ${result.intent}. Premier résultat : ${Object.entries(first).map(([key, value]) => `${key}: ${value}`).join(", ")}.`;
}

async function readTable(table: TableName, companyId: number, isSuperAdmin: boolean, limit: number, search?: string) {
  const config = tableCatalog[table];
  const where = {
    ...scopedWhere(config, companyId, isSuperAdmin),
    ...searchWhere(config.searchFields, search),
  };
  const records = await (prisma as any)[config.delegate].findMany({
    where,
    select: Object.fromEntries(config.fields.map((field) => [field, true])),
    orderBy: config.defaultOrder,
    take: limit,
  });
  return records.map((record: Record<string, unknown>) => formatRecord(record, config.fields));
}

function scopedWhere(config: { scopedByCompany: boolean; delegate?: string }, companyId: number, isSuperAdmin: boolean) {
  if (isSuperAdmin) return {};
  // La table des compagnies n'a pas de compagnieId : on limite à la compagnie de l'utilisateur.
  if (config.delegate === "compagnie") return { id: companyId };
  return config.scopedByCompany ? { compagnieId: companyId } : {};
}

function maskPersonalData(rows: Array<Record<string, string | number>>) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, PERSONAL_FIELD.test(key.normalize("NFD").replace(/[̀-ͯ]/g, "")) ? "[masqué]" : value])));
}

function searchWhere(fields: string[], search?: string) {
  const query = search?.trim();
  if (!query || query.length < 2) return {};
  return {
    OR: fields.map((field) => ({ [field]: { contains: query } })),
  };
}

function formatRecord(record: Record<string, unknown>, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [labelField(field), formatValue(record[field])])) as Record<string, string | number>;
}

function formatValue(value: unknown): string | number {
  if (value === null || value === undefined) return "-";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (value instanceof Date) return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
  if (typeof value === "object" && "toString" in value) return String(value);
  return JSON.stringify(value);
}

function labelField(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function inferTableFromSearch(text: string): TableName | undefined {
  const value = text.toLowerCase();
  if (value.includes("compagn")) return "COMPAGNIES";
  if (value.includes("filiale")) return "FILIALES";
  if (value.includes("gestionnaire")) return "GESTIONNAIRES";
  if (value.includes("exercice")) return "EXERCICES";
  if (value.includes("utilisateur") || value.includes("user")) return "UTILISATEURS";
  if (value.includes("historique")) return "HISTORIQUE_IMPORTATIONS";
  if (value.includes("prestation") || value.includes("soin")) return "PRESTATIONS";
  if (value.includes("anomal")) return "ANOMALIES";
  if (value.includes("assuré") || value.includes("assure")) return "REF_ASSURES";
  if (value.includes("prestataire")) return "REF_PRESTATAIRES";
  if (value.includes("acte")) return "REF_ACTES";
  if (value.includes("contrat")) return "REF_CONTRATS";
  if (value.includes("plafond")) return "REF_PLAFONDS";
  if (value.includes("fichier") || value.includes("audit") || value.includes("import")) return "FICHIERS";
  return undefined;
}

async function completeJson(messages: Array<{ role: "system" | "user"; content: string }>) {
  if (provider === "groq") {
    return groqChat(messages, { response_format: { type: "json_object" } });
  }
  return openaiResponse(messages, {
    text: {
      format: {
        type: "json_schema",
        name: "database_assistant_plan",
        schema: {
          type: "object",
          additionalProperties: false,
        properties: {
            intent: { type: "string", enum: intents },
            limit: { type: "number" },
            year: { type: "number" },
            month: { type: "number" },
            table: { type: "string", enum: tableNames },
            search: { type: "string" },
          },
          required: ["intent"],
        },
      },
    },
  });
}

async function completeText(messages: Array<{ role: "system" | "user"; content: string }>) {
  if (provider === "groq") return groqChat(messages);
  return openaiResponse(messages);
}

async function groqChat(messages: Array<{ role: "system" | "user"; content: string }>, options: Record<string, unknown> = {}) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      ...options,
    }),
  });
  if (!response.ok) throw new Error(`Groq request failed: ${response.status}`);
  const payload = await response.json();
  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}

async function openaiResponse(messages: Array<{ role: "system" | "user"; content: string }>, options: Record<string, unknown> = {}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: messages, ...options }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const payload = await response.json();
  return extractOutputText(payload);
}

function extractOutputText(payload: any) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const chunks = payload.output?.flatMap((item: any) => item.content ?? []) ?? [];
  return chunks.map((chunk: any) => chunk.text ?? "").join("").trim();
}

function money(value: number) {
  return `${Math.round(value).toLocaleString("fr-FR")} F`;
}

function fullName(prenoms: string | null, nom: string) {
  return `${prenoms ?? ""} ${nom}`.trim();
}
