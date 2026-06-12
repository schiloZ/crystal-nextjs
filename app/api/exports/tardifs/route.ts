import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const url = new URL(request.url);
  const fileId = numberParam(url.searchParams.get("fichier"));
  if (!fileId) return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });

  const file = await prisma.fichierImporte.findFirst({
    where: {
      id: fileId,
      compagnieId: user.role === "super_admin" ? undefined : Number(user.compagnieId),
    },
    include: { compagnie: true, filiale: true, gestionnaire: true, exercice: true },
  });
  if (!file) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });

  const hasTolerance = Boolean(file.exercice.dateDebutToleranceTardif || file.exercice.dateFinToleranceTardif);
  const mode = url.searchParams.get("mode") === "tolerance" && hasTolerance ? "tolerance" : "exercice";
  const toleranceStart = file.exercice.dateDebutToleranceTardif ? startOfDay(file.exercice.dateDebutToleranceTardif) : null;
  const toleranceEnd = file.exercice.dateFinToleranceTardif ? endOfDay(file.exercice.dateFinToleranceTardif) : null;

  const prestations = await prisma.prestation.findMany({
    where: mode === "tolerance"
      ? { fichierImporteId: file.id, dateComptable: { not: null } }
      : { fichierImporteId: file.id, dateSoins: { not: null } },
    orderBy: { dateSoins: "asc" },
  });

  const rows = prestations.flatMap((prestation) => {
    if (!prestation.dateSoins) return [];
    if (mode === "tolerance") {
      if (!prestation.dateComptable) return [];
      if (toleranceStart && prestation.dateComptable < toleranceStart) {
        const days = Math.ceil((toleranceStart.getTime() - prestation.dateComptable.getTime()) / 86_400_000);
        return [{ prestation, before: true, days, amount: Number(prestation.montantPaye || prestation.montantReclame), reason: `Comptabilisé ${days} jours avant la tolérance` }];
      }
      if (toleranceEnd && prestation.dateComptable > toleranceEnd) {
        const days = Math.ceil((prestation.dateComptable.getTime() - toleranceEnd.getTime()) / 86_400_000);
        return [{ prestation, before: false, days, amount: Number(prestation.montantPaye || prestation.montantReclame), reason: `Comptabilisé ${days} jours après la tolérance` }];
      }
      return [];
    }

    if (prestation.dateSoins >= file.exercice.dateDebut && prestation.dateSoins <= file.exercice.dateFin) return [];
    const before = prestation.dateSoins < file.exercice.dateDebut;
    const boundary = before ? file.exercice.dateDebut : file.exercice.dateFin;
    const days = Math.max(1, Math.ceil(Math.abs(prestation.dateSoins.getTime() - boundary.getTime()) / 86_400_000));
    return [{ prestation, before, days, amount: Number(prestation.montantPaye || prestation.montantReclame), reason: before ? "Avant exercice" : "Après exercice" }];
  });

  const detailRows = rows.map(({ prestation, before, days, amount, reason }) => ({
    "N° prestation": prestation.numeroPrestation ?? `PRE-${prestation.id}`,
    "Assuré principal": fullName(prestation.prenomsAssurePrincipal, prestation.nomAssurePrincipal ?? prestation.matriculeAssurePrincipal ?? ""),
    "Matricule assuré": prestation.matriculeAssurePrincipal ?? "",
    "Bénéficiaire": fullName(prestation.prenomsBeneficiaire, prestation.nomBeneficiaire ?? prestation.matriculeBeneficiaire ?? ""),
    "Matricule bénéficiaire": prestation.matriculeBeneficiaire ?? "",
    "Date soins": prestation.dateSoins ? formatDate(prestation.dateSoins) : "",
    "Date comptable": prestation.dateComptable ? formatDate(prestation.dateComptable) : "",
    "Sens": before ? "Avant" : "Après",
    "Écart jours": days,
    "Prestataire": prestation.prestataire ?? "",
    "Code prestataire": prestation.codePrestataire ?? "",
    "Code acte": prestation.codeActe ?? "",
    "Acte": prestation.acte ?? "",
    "Famille": prestation.famillePrestation ?? "",
    "Police": prestation.police ?? "",
    "Collège": prestation.college ?? prestation.numeroCollege ?? "",
    "Montant réclamé": Number(prestation.montantReclame ?? 0),
    "Montant payé": Number(prestation.montantPaye ?? 0),
    "Montant concerné": amount,
    "Motif": reason,
  }));

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const summary = [{
    "Fichier": file.nomFichier,
    "Compagnie": file.compagnie.nom,
    "Filiale": file.filiale.nom,
    "Gestionnaire": fullName(file.gestionnaire.prenoms, file.gestionnaire.nom),
    "Mode": mode === "tolerance" ? "Hors période de tolérance" : "Hors exercice",
    "Période exercice": `${formatDate(file.exercice.dateDebut)} - ${formatDate(file.exercice.dateFin)}`,
    "Période tolérance": toleranceLabel(file.exercice.dateDebutToleranceTardif, file.exercice.dateFinToleranceTardif),
    "Nombre de tardifs": rows.length,
    "Montant total concerné": total,
  }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), "Tardifs");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Synthèse");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tardifs-crystal-${dateStamp()}.xlsx"`,
    },
  });
}

function numberParam(value: string | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}

function fullName(prenoms: string | null, nom: string) {
  return `${prenoms ?? ""} ${nom}`.trim();
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

function toleranceLabel(start: Date | null, end: Date | null) {
  return start && end ? `${formatDate(start)} - ${formatDate(end)}` : start ? `À partir du ${formatDate(start)}` : end ? `Jusqu'au ${formatDate(end)}` : "Non configurée";
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
