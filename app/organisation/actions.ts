"use server";

import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const branchSchema = z.object({
  code: z.string().trim().min(2).max(20).transform((value) => value.toUpperCase()),
  nom: z.string().trim().min(2).max(200),
  ville: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(100).optional().or(z.literal("")),
});

const userSchema = z.object({
  nom: z.string().trim().min(2).max(100),
  prenoms: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(150),
  password: z.string().min(8).max(100),
  role: z.enum(["admin_filiale", "auditeur", "lecteur"]),
  filialeId: z.coerce.number().int().positive().optional(),
});

export async function createBranch(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  const values = branchSchema.parse(Object.fromEntries(formData));
  const requestedCompanyId = Number(formData.get("compagnieId"));
  const compagnieId = user.role === "super_admin" ? requestedCompanyId : user.compagnieId;
  if (!compagnieId) throw new Error("Compagnie invalide");

  await prisma.filiale.create({
    data: { compagnieId, code: values.code, nom: values.nom, ville: values.ville || null, email: values.email || null },
  });
  revalidatePath("/organisation");
}

export async function createOrganizationUser(formData: FormData) {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const values = userSchema.parse(Object.fromEntries(formData));
  const filiale = await prisma.filiale.findUnique({ where: { id: values.filialeId } });
  if (!filiale) throw new Error("Filiale invalide");
  if (current.role !== "super_admin" && filiale.compagnieId !== current.compagnieId) throw new Error("Acces refuse");

  await prisma.utilisateur.create({
    data: {
      compagnieId: filiale.compagnieId,
      filialeId: filiale.id,
      nom: values.nom,
      prenoms: values.prenoms,
      email: values.email,
      motDePasse: await bcrypt.hash(values.password, 10),
      role: values.role as UserRole,
    },
  });
  revalidatePath("/organisation");
}
