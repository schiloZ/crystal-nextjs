"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { runFileAudit } from "@/lib/run-file-audit";

export type ExerciseFormState = { error?: string; success?: string };

const exerciseSchema = z.object({
  compagnieId: z.coerce.number().int().positive().optional(),
  codeExercice: z.string().trim().min(2, "Le code de l'exercice est requis.").max(20),
  dateDebut: z.coerce.date({ error: "La date de début est invalide." }),
  dateFin: z.coerce.date({ error: "La date de fin est invalide." }),
  dateDebutToleranceTardif: z.preprocess((value) => value === "" ? undefined : value, z.coerce.date().optional()),
  dateFinToleranceTardif: z.preprocess((value) => value === "" ? undefined : value, z.coerce.date().optional()),
  actif: z.string().optional(),
}).refine((values) => values.dateFin >= values.dateDebut, {
  message: "La date de fin doit être postérieure à la date de début.",
  path: ["dateFin"],
}).refine((values) => !values.dateDebutToleranceTardif || !values.dateFinToleranceTardif || values.dateFinToleranceTardif >= values.dateDebutToleranceTardif, {
  message: "La fin de tolérance doit être postérieure au début de tolérance.",
  path: ["dateFinToleranceTardif"],
});

export async function createExercise(_state: ExerciseFormState, formData: FormData): Promise<ExerciseFormState> {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const result = exerciseSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Les informations sont invalides." };

  const values = result.data;
  const compagnieId = current.role === "super_admin" ? values.compagnieId : current.compagnieId;
  if (!compagnieId) return { error: "Sélectionnez une compagnie." };

  const duplicate = await prisma.exerciceComptable.findFirst({
    where: { compagnieId, codeExercice: values.codeExercice },
  });
  if (duplicate) return { error: "Un exercice avec ce code existe déjà pour cette compagnie." };

  try {
    await prisma.exerciceComptable.create({
      data: {
        compagnieId,
        codeExercice: values.codeExercice,
        dateDebut: values.dateDebut,
        dateFin: values.dateFin,
        dateDebutToleranceTardif: values.dateDebutToleranceTardif,
        dateFinToleranceTardif: values.dateFinToleranceTardif,
        actif: Boolean(values.actif),
      },
    });
  } catch {
    return { error: "L'exercice comptable n'a pas pu être créé." };
  }

  revalidatePath("/exercices");
  return { success: `L'exercice ${values.codeExercice} a été créé.` };
}

export async function toggleExercise(formData: FormData) {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const id = Number(formData.get("id"));
  const exercise = await prisma.exerciceComptable.findUnique({ where: { id } });
  if (!exercise) return;
  if (current.role !== "super_admin" && exercise.compagnieId !== current.compagnieId) return;

  await prisma.exerciceComptable.update({ where: { id }, data: { actif: !exercise.actif } });
  revalidatePath("/exercices");
  redirect("/exercices?toast=exercise-status");
}

export async function updateTardinessWindow(formData: FormData) {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const id = Number(formData.get("id"));
  const rawStart = String(formData.get("dateDebutToleranceTardif") ?? "");
  const rawEnd = String(formData.get("dateFinToleranceTardif") ?? "");
  const exercise = await prisma.exerciceComptable.findUnique({ where: { id } });
  if (!exercise || (current.role !== "super_admin" && exercise.compagnieId !== current.compagnieId)) return;
  const dateDebutToleranceTardif = rawStart ? new Date(`${rawStart}T00:00:00.000Z`) : null;
  const dateFinToleranceTardif = rawEnd ? new Date(`${rawEnd}T00:00:00.000Z`) : null;
  if (dateDebutToleranceTardif && Number.isNaN(dateDebutToleranceTardif.getTime())) return;
  if (dateFinToleranceTardif && Number.isNaN(dateFinToleranceTardif.getTime())) return;
  if (dateDebutToleranceTardif && dateFinToleranceTardif && dateFinToleranceTardif < dateDebutToleranceTardif) return;
  await prisma.exerciceComptable.update({ where: { id }, data: { dateDebutToleranceTardif, dateFinToleranceTardif } });
  const files = await prisma.fichierImporte.findMany({ where: { exerciceId: id, statut: { in: ["analyse", "valide"] } }, select: { id: true } });
  for (const file of files) await runFileAudit(file.id);
  revalidatePath("/exercices");
  revalidatePath("/rapports/tardifs");
  revalidatePath("/rapports/temporel");
  revalidatePath("/synthese");
  redirect("/exercices?toast=exercise-updated");
}
