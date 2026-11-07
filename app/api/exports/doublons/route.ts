import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getApiUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const duplicateCodes = ["DOUBLON_FONCTIONNEL", "DOUBLON_PARTIEL", "DOUBLON_INTER_MOIS", "DOUBLON_INTER_GESTIONNAIRE"];
const typeCodes: Record<string, string> = {
  fonctionnel: "DOUBLON_FONCTIONNEL",
  partiel: "DOUBLON_PARTIEL",
  "inter-mois": "DOUBLON_INTER_MOIS",
  "inter-gestionnaire": "DOUBLON_INTER_GESTIONNAIRE",
};
const labels: Record<string, string> = {
  DOUBLON_FONCTIONNEL: "Doublon fonctionnel",
  DOUBLON_PARTIEL: "Doublon partiel",
  DOUBLON_INTER_MOIS: "Doublon inter-mois",
  DOUBLON_INTER_GESTIONNAIRE: "Doublon inter-gestionnaire",
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const url = new URL(request.url);
  const fileIds = numberList(url.searchParams.get("fichiers"));
  const companyId = user.role === "super_admin" ? numberParam(url.searchParams.get("compagnie")) : Number(user.compagnieId);
  const branchId = numberParam(url.searchParams.get("filiale"));
  const managerId = numberParam(url.searchParams.get("gestionnaire"));
  const exerciseId = numberParam(url.searchParams.get("exercice"));
  const periodStart = dateParam(url.searchParams.get("debut"));
  const periodEnd = endDateParam(url.searchParams.get("fin"));
  const selectedCode = typeCodes[url.searchParams.get("type") ?? ""];
  const codes = selectedCode ? [selectedCode] : duplicateCodes;

  const anomalies = await prisma.anomalie.findMany({
    where: {
      categorie: "DOUBLON",
      codeAnomalie: { in: codes },
      fichierImporteId: fileIds.length ? { in: fileIds } : undefined,
      fichier: {
        compagnieId: companyId || undefined,
        filialeId: branchId || undefined,
        gestionnaireId: managerId || undefined,
        exerciceId: exerciseId || undefined,
        dateImport: periodStart || periodEnd ? { gte: periodStart ?? undefined, lte: periodEnd ?? undefined } : undefined,
      },
    },
    include: {
      fichier: { include: { compagnie: true, filiale: true, gestionnaire: true, exercice: true } },
      prestation: true,
    },
    orderBy: [{ codeAnomalie: "asc" }, { montantImpacte: "desc" }],
  });

  const rows = anomalies.map((anomaly) => {
    const prestation = anomaly.prestation;
    return {
      "Type doublon": labels[anomaly.codeAnomalie] ?? anomaly.codeAnomalie,
      "Qualification": qualification(anomaly.codeAnomalie, anomaly.description),
      "Gravité": severityLabel(anomaly.gravite),
      "Montant impacté": Number(anomaly.montantImpacte),
      "Fichier": anomaly.fichier.nomFichier,
      "Mois fichier": `${String(anomaly.fichier.moisFichier).padStart(2, "0")}/${anomaly.fichier.anneeFichier}`,
      "Compagnie": anomaly.fichier.compagnie.nom,
      "Filiale": anomaly.fichier.filiale.nom,
      "Gestionnaire": fullName(anomaly.fichier.gestionnaire.prenoms, anomaly.fichier.gestionnaire.nom),
      "N° prestation": prestation?.numeroPrestation ?? "",
      "Matricule bénéficiaire": prestation?.matriculeBeneficiaire ?? anomaly.matriculeBenef ?? "",
      "Bénéficiaire": fullName(prestation?.prenomsBeneficiaire ?? null, prestation?.nomBeneficiaire ?? anomaly.nomBenef ?? ""),
      "Assuré principal": fullName(prestation?.prenomsAssurePrincipal ?? null, prestation?.nomAssurePrincipal ?? ""),
      "Date soins": prestation?.dateSoins ? formatDate(prestation.dateSoins) : "",
      "Code acte": prestation?.codeActe ?? "",
      "Acte": prestation?.acte ?? "",
      "Famille": prestation?.famillePrestation ?? "",
      "Code prestataire": prestation?.codePrestataire ?? "",
      "Prestataire": prestation?.prestataire ?? "",
      "Police": prestation?.police ?? "",
      "Collège": prestation?.college ?? prestation?.numeroCollege ?? "",
      "Montant réclamé": Number(prestation?.montantReclame ?? 0),
      "Montant payé": Number(prestation?.montantPaye ?? 0),
      "Description": anomaly.description ?? "",
    };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Doublons");
  const summary = [{ "Périmètre": "Doublons exportés", "Nombre": anomalies.length, "Montant impacté": anomalies.reduce((sum, item) => sum + Number(item.montantImpacte), 0) }];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Synthèse");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="doublons-crystal-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}

function numberParam(value: string | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function numberList(value: string | null) {
  return (value ?? "").split(",").map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
}

function dateParam(value: string | null) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function endDateParam(value: string | null) {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function fullName(prenoms: string | null, nom: string) {
  return `${prenoms ?? ""} ${nom}`.trim();
}

function severityLabel(value: string) {
  return value === "critique" ? "Critique" : value === "eleve" ? "Élevée" : value === "moyen" ? "Moyenne" : "Faible";
}

function qualification(code: string, description: string | null) {
  if (description?.includes("TARDIF")) return "TARDIF + VALIDE";
  return code === "DOUBLON_PARTIEL" ? "MONTANT DIFFÉRENT" : "VALIDE";
}
