import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getApiUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { companyStatus, companyStatusLabel } from "@/lib/company-access";

export const runtime = "nodejs";

export async function GET() {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  if (user.role !== "super_admin") return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const companies = await prisma.compagnie.findMany({
    orderBy: { nom: "asc" },
    include: { _count: { select: { filiales: true, utilisateurs: true, gestionnaires: true, fichiers: true } } },
  });

  const rows = companies.map((company) => ({
    Code: company.code,
    Compagnie: company.nom,
    Ville: company.ville ?? "",
    Adresse: company.adresse ?? "",
    "Téléphone": company.telephone ?? "",
    Email: company.email ?? "",
    Statut: companyStatusLabel[companyStatus(company)],
    "Fin d'essai": company.dateFinEssai ?? "",
    Filiales: company._count.filiales,
    Utilisateurs: company._count.utilisateurs,
    Gestionnaires: company._count.gestionnaires,
    "Fichiers importés": company._count.fichiers,
    "Créée le": company.createdAt,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows, { cellDates: true, dateNF: "dd/mm/yyyy" });
  sheet["!cols"] = [10, 32, 16, 28, 16, 28, 14, 14, 10, 12, 14, 16, 14].map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Compagnies");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="compagnies-crystal-${stamp}.xlsx"`,
    },
  });
}
