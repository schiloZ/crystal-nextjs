"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function deleteImportedFileData(formData: FormData) {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const id = Number(formData.get("id"));
  const returnTo = String(formData.get("returnTo") ?? "");
  if (!Number.isInteger(id) || id <= 0) return;

  const file = await prisma.fichierImporte.findUnique({
    where: { id },
    select: { compagnieId: true, nomFichier: true, nbLignesTotal: true, nbLignesAnomalies: true },
  });
  if (!file) return;
  if (current.role !== "super_admin" && file.compagnieId !== current.compagnieId) return;

  await prisma.$transaction(async (tx) => {
    await tx.historiqueImportation.create({
      data: {
        compagnieId: file.compagnieId,
        fichierImporteId: id,
        nomFichier: file.nomFichier,
        action: "suppression",
        utilisateurId: current.id,
        utilisateurNom: current.name,
        utilisateurEmail: current.email,
        nbLignesTotal: file.nbLignesTotal,
        nbAnomalies: file.nbLignesAnomalies,
      },
    });
    await tx.anomalie.deleteMany({ where: { fichierImporteId: id } });
    await tx.prestation.deleteMany({ where: { fichierImporteId: id } });
    await tx.fichierImporte.delete({ where: { id } });
  });

  revalidatePath("/import");
  revalidatePath("/dashboard");
  revalidatePath("/synthese");
  revalidatePath("/recommandation");
  revalidatePath("/scores");
  revalidatePath("/rapports/audit");
  revalidatePath("/rapports/comparatif");
  revalidatePath("/rapports/doublons");
  revalidatePath("/rapports/beneficiaires");
  revalidatePath("/rapports/prestataires");
  revalidatePath("/rapports/montants");
  revalidatePath("/rapports/actes");
  revalidatePath("/rapports/frequence");
  revalidatePath("/rapports/temporel");
  revalidatePath("/rapports/tardifs");
  redirect(returnTo === "exercices" ? "/exercices?toast=import-deleted" : "/import?toast=import-deleted");
}
