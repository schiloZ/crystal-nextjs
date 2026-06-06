"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
  adminPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(100),
});

export async function createCompany(_state: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  await requireRole(["super_admin"]);
  const result = companySchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Les informations saisies sont invalides." };
  }

  const values = result.data;
  const password = await bcrypt.hash(values.adminPassword, 10);

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
