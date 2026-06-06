"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function createRefAssure(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  const compagnieId = scopedCompany(user, formData);
  await prisma.refAssure.create({
    data: {
      compagnieId,
      matricule: required(formData, "matricule"),
      nom: required(formData, "nom"),
      prenom: optional(formData, "prenom"),
      dateNaissance: dateValue(formData, "dateNaissance"),
      sexe: optional(formData, "sexe"),
      statut: optional(formData, "statut"),
      dateAffiliation: dateValue(formData, "dateAffiliation"),
      dateRadiation: dateValue(formData, "dateRadiation"),
      dateFinDroit: dateValue(formData, "dateFinDroit"),
      codeSouscripteur: optional(formData, "codeSouscripteur"),
      souscripteur: optional(formData, "souscripteur"),
      numeroGroupe: optional(formData, "numeroGroupe"),
      matriculeAssurePrincipal: optional(formData, "matriculeAssurePrincipal"),
      nomAssurePrincipal: optional(formData, "nomAssurePrincipal"),
      prenomsAssurePrincipal: optional(formData, "prenomsAssurePrincipal"),
      police: optional(formData, "police"),
      policeInterne: optional(formData, "policeInterne"),
      numeroCollege: optional(formData, "numeroCollege"),
      college: optional(formData, "college"),
      actif: booleanValue(formData, "actif"),
    },
  });
  revalidatePath("/parametres");
}

export async function createRefPrestataire(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  await prisma.refPrestataire.create({
    data: {
      compagnieId: scopedCompany(user, formData),
      code: required(formData, "code"),
      nom: required(formData, "nom"),
      statut: optional(formData, "statut") ?? "agree",
      actif: booleanValue(formData, "actif"),
    },
  });
  revalidatePath("/parametres");
}

export async function createRefActe(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  await prisma.refActe.create({
    data: {
      compagnieId: scopedCompany(user, formData),
      codeActe: required(formData, "codeActe"),
      libelle: required(formData, "libelle"),
      famille: optional(formData, "famille"),
      tarifConventionne: moneyValue(formData, "tarifConventionne"),
      couvert: booleanValue(formData, "couvert"),
      actif: booleanValue(formData, "actif"),
    },
  });
  revalidatePath("/parametres");
}

export async function createRefContrat(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  await prisma.refContrat.create({
    data: {
      compagnieId: scopedCompany(user, formData),
      codeContrat: required(formData, "codeContrat"),
      libelle: required(formData, "libelle"),
      police: optional(formData, "police"),
      policeInterne: optional(formData, "policeInterne"),
      codeSouscripteur: optional(formData, "codeSouscripteur"),
      souscripteur: optional(formData, "souscripteur"),
      dateDebut: dateValue(formData, "dateDebut"),
      dateFin: dateValue(formData, "dateFin"),
      actif: booleanValue(formData, "actif"),
    },
  });
  revalidatePath("/parametres");
}

export async function createRefPlafond(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  const contratId = numberValue(formData, "contratId");
  await prisma.refPlafond.create({
    data: {
      compagnieId: scopedCompany(user, formData),
      contratId,
      codePlafond: required(formData, "codePlafond"),
      libelle: required(formData, "libelle"),
      typePlafond: required(formData, "typePlafond"),
      police: optional(formData, "police"),
      numeroCollege: optional(formData, "numeroCollege"),
      codeActe: optional(formData, "codeActe"),
      famille: optional(formData, "famille"),
      montantPlafond: moneyValue(formData, "montantPlafond"),
      periodicite: optional(formData, "periodicite"),
      actif: booleanValue(formData, "actif"),
    },
  });
  revalidatePath("/parametres");
}

function scopedCompany(user: { role: string; compagnieId: number }, formData: FormData) {
  return user.role === "super_admin" ? Number(formData.get("compagnieId")) : user.compagnieId;
}

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} est obligatoire.`);
  return value;
}

function optional(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function dateValue(formData: FormData, key: string) {
  const value = optional(formData, key);
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function numberValue(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function moneyValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "0").replace(/\s/g, "").replace(",", ".");
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function booleanValue(formData: FormData, key: string) {
  return formData.get(key) !== "false";
}
