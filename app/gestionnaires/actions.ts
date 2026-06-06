"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export type ManagerFormState = { error?: string; success?: string };

const managerSchema = z.object({
  compagnieId: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(2, "Le code doit contenir au moins 2 caractères.").max(20).transform((value) => value.toUpperCase()),
  nom: z.string().trim().min(2, "Le nom est requis.").max(200),
  prenoms: z.string().trim().min(2, "Les prénoms sont requis.").max(200),
  contact: z.string().trim().max(150).optional(),
  telephone: z.string().trim().max(50).optional(),
  email: z.string().trim().email("L'email est invalide.").max(100).optional().or(z.literal("")),
});

export async function createManager(_state: ManagerFormState, formData: FormData): Promise<ManagerFormState> {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const result = managerSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Les informations sont invalides." };

  const values = result.data;
  const compagnieId = current.role === "super_admin" ? values.compagnieId : current.compagnieId;
  if (!compagnieId) return { error: "Sélectionnez une compagnie." };

  const duplicate = await prisma.gestionnaire.findUnique({ where: { code: values.code } });
  if (duplicate) return { error: "Ce code gestionnaire est déjà utilisé." };

  try {
    await prisma.gestionnaire.create({
      data: {
        compagnieId,
        code: values.code,
        nom: values.nom,
        prenoms: values.prenoms,
        contact: values.contact || null,
        telephone: values.telephone || null,
        email: values.email || null,
      },
    });
  } catch {
    return { error: "Le gestionnaire n'a pas pu être créé." };
  }

  revalidatePath("/gestionnaires");
  revalidatePath("/import");
  return { success: `${values.prenoms} ${values.nom} a été ajouté à la liste.` };
}

export async function toggleManager(formData: FormData) {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const id = Number(formData.get("id"));
  const manager = await prisma.gestionnaire.findUnique({ where: { id } });
  if (!manager) return;
  if (current.role !== "super_admin" && manager.compagnieId !== current.compagnieId) return;

  await prisma.gestionnaire.update({ where: { id }, data: { actif: !manager.actif } });
  revalidatePath("/gestionnaires");
  revalidatePath("/import");
}

export async function updateManager(formData: FormData) {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const id = Number(formData.get("id"));
  const manager = await prisma.gestionnaire.findUnique({ where: { id } });
  if (!manager) return;
  if (current.role !== "super_admin" && manager.compagnieId !== current.compagnieId) return;

  const result = managerSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return;
  const values = result.data;
  const compagnieId = current.role === "super_admin" ? values.compagnieId : current.compagnieId;
  if (!compagnieId) return;

  const duplicate = await prisma.gestionnaire.findFirst({ where: { code: values.code, id: { not: id } } });
  if (duplicate) return;

  await prisma.gestionnaire.update({
    where: { id },
    data: {
      compagnieId,
      code: values.code,
      nom: values.nom,
      prenoms: values.prenoms,
      contact: values.contact || null,
      telephone: values.telephone || null,
      email: values.email || null,
    },
  });
  revalidatePath("/gestionnaires");
  revalidatePath("/import");
}
