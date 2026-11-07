"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordSchema } from "@/lib/password";
import { requireRole } from "@/lib/current-user";

export type CompanyFormState = {
  error?: string;
  success?: string;
};

const companySchema = z.object({
  code: z.string().trim().min(2, "Le code doit contenir au moins 2 caractères.").max(20).transform((value) => value.toUpperCase()),
  nom: z.string().trim().min(2, "Le nom de la compagnie est requis.").max(200),
  ville: z.string().trim().max(100).optional(),
  email: z.string().trim().email("L'email de la compagnie est invalide.").max(100),
  adminNom: z.string().trim().min(2, "Le nom du super utilisateur est requis.").max(100),
  adminPrenoms: z.string().trim().min(2, "Les prénoms du super utilisateur sont requis.").max(150),
  adminEmail: z.string().trim().email("L'email du super utilisateur est invalide.").max(150),
  adminPassword: passwordSchema,
});

export async function createCompany(_state: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  await requireRole(["super_admin"]);
  const result = companySchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Les informations saisies sont invalides." };
  }

  const values = result.data;
  const password = await hashPassword(values.adminPassword);

  try {
    await prisma.$transaction(async (tx) => {
      const compagnie = await tx.compagnie.create({
        data: {
          code: values.code,
          nom: values.nom,
          ville: values.ville || null,
          email: values.email,
        },
      });
      await tx.utilisateur.create({
        data: {
          compagnieId: compagnie.id,
          nom: values.adminNom,
          prenoms: values.adminPrenoms,
          email: values.adminEmail,
          motDePasse: password,
          role: "admin_compagnie",
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Ce code de compagnie ou cet email est déjà utilisé." };
    }
    return { error: "La compagnie n'a pas pu être créée. Réessayez dans quelques instants." };
  }

  revalidatePath("/administration");
  return { success: `${values.nom} et son super utilisateur ont été créés.` };
}

const companyAccessSchema = z.object({
  id: z.coerce.number().int().positive(),
  statut: z.enum(["active", "suspendue"]),
  dateFinEssai: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(""),
});

/** Définit la date de fin d'essai (vide = sans limite) et suspend ou réactive la compagnie. */
export async function updateCompanyAccess(formData: FormData) {
  await requireRole(["super_admin"]);
  const parsed = companyAccessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/administration?toast=company-access-invalid");
  const { id, statut, dateFinEssai } = parsed.data;

  await prisma.compagnie.update({
    where: { id },
    data: {
      actif: statut === "active",
      dateFinEssai: dateFinEssai ? new Date(`${dateFinEssai}T00:00:00.000Z`) : null,
    },
  });
  revalidatePath("/administration");
  redirect("/administration?toast=company-access");
}

/**
 * Supprime définitivement une compagnie et tout ce qui lui appartient :
 * utilisateurs, filiales, gestionnaires, exercices, fichiers, prestations,
 * anomalies, historique et référentiels. L'opération est irréversible.
 */
export async function deleteCompany(formData: FormData) {
  await requireRole(["super_admin"]);
  const id = Number(formData.get("id"));
  const confirmation = String(formData.get("confirmation") ?? "").trim().toUpperCase();
  if (!Number.isInteger(id) || id <= 0) return;

  const company = await prisma.compagnie.findUnique({ where: { id }, select: { code: true } });
  if (!company) redirect("/administration");
  if (confirmation !== company.code.toUpperCase()) redirect("/administration?toast=company-delete-confirm");

  // Empêche de supprimer le compte d'un super administrateur avec la compagnie.
  const superAdmins = await prisma.utilisateur.count({ where: { compagnieId: id, role: "super_admin" } });
  if (superAdmins > 0) redirect("/administration?toast=company-delete-superadmin");

  const where = { compagnieId: id };
  await prisma.$transaction(async (tx) => {
    await tx.anomalie.deleteMany({ where });
    await tx.prestation.deleteMany({ where });
    await tx.historiqueImportation.deleteMany({ where });
    await tx.fichierImporte.deleteMany({ where });
    await tx.refPlafond.deleteMany({ where });
    await tx.refContrat.deleteMany({ where });
    await tx.refActe.deleteMany({ where });
    await tx.refPrestataire.deleteMany({ where });
    await tx.refAssure.deleteMany({ where });
    await tx.utilisateur.deleteMany({ where });
    await tx.exerciceComptable.deleteMany({ where });
    await tx.gestionnaire.deleteMany({ where });
    await tx.filiale.deleteMany({ where });
    await tx.compagnie.delete({ where: { id } });
  }, { timeout: 120_000, maxWait: 10_000 });

  revalidatePath("/administration");
  redirect("/administration?toast=company-deleted");
}
