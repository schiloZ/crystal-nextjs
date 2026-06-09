"use server";

import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const userSchema = z.object({
  compagnieId: z.coerce.number().int().positive(),
  filialeId: z.coerce.number().int().positive().optional().or(z.literal("")),
  prenoms: z.string().trim().max(150).optional(),
  nom: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(150),
  password: z.string().min(8).max(100),
  role: z.enum(["admin_compagnie", "admin_filiale", "auditeur", "lecteur"]),
});

const updateUserSchema = userSchema.extend({
  id: z.coerce.number().int().positive(),
  password: z.string().max(100).optional(),
  actif: z.enum(["true", "false"]).default("true"),
});

export async function createUser(formData: FormData) {
  await requireRole(["super_admin"]);
  const values = userSchema.parse(Object.fromEntries(formData));
  const filialeId = normalizeFiliale(values.filialeId);
  await assertCompanyScope(values.compagnieId, filialeId);

  await prisma.utilisateur.create({
    data: {
      compagnieId: values.compagnieId,
      filialeId,
      prenoms: values.prenoms || null,
      nom: values.nom,
      email: values.email,
      motDePasse: await bcrypt.hash(values.password, 10),
      role: values.role as UserRole,
    },
  });

  revalidatePath("/utilisateurs");
  redirect("/utilisateurs?toast=user-created");
}

export async function updateUser(formData: FormData) {
  await requireRole(["super_admin"]);
  const values = updateUserSchema.parse(Object.fromEntries(formData));
  const filialeId = normalizeFiliale(values.filialeId);
  await assertCompanyScope(values.compagnieId, filialeId);
  const password = values.password?.trim();

  await prisma.utilisateur.update({
    where: { id: values.id },
    data: {
      compagnieId: values.compagnieId,
      filialeId,
      prenoms: values.prenoms || null,
      nom: values.nom,
      email: values.email,
      role: values.role as UserRole,
      actif: values.actif === "true",
      ...(password ? { motDePasse: await bcrypt.hash(password, 10) } : {}),
    },
  });

  revalidatePath("/utilisateurs");
  redirect("/utilisateurs?toast=user-updated");
}

export async function toggleUserStatus(formData: FormData) {
  const current = await requireRole(["super_admin"]);
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0 || id === current.id) return;

  const user = await prisma.utilisateur.findUnique({ where: { id }, select: { actif: true } });
  if (!user) return;
  await prisma.utilisateur.update({ where: { id }, data: { actif: !user.actif } });
  revalidatePath("/utilisateurs");
  redirect("/utilisateurs?toast=user-status");
}

async function assertCompanyScope(compagnieId: number, filialeId: number | null) {
  const company = await prisma.compagnie.findUnique({ where: { id: compagnieId }, select: { id: true } });
  if (!company) throw new Error("Compagnie invalide.");
  if (!filialeId) return;
  const branch = await prisma.filiale.findUnique({ where: { id: filialeId }, select: { compagnieId: true } });
  if (!branch || branch.compagnieId !== compagnieId) throw new Error("Filiale invalide pour cette compagnie.");
}

function normalizeFiliale(value: number | "" | undefined) {
  return typeof value === "number" && value > 0 ? value : null;
}
