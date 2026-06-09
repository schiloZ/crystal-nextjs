"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

type ReferenceType = "assures" | "prestataires" | "actes" | "contrats" | "plafonds";

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

export async function importRefAssures(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  const compagnieId = scopedCompany(user, formData);
  const { rows, mapping } = await importRows(formData);

  let imported = 0;
  for (const row of rows) {
    const matricule = mappedTextCell(row, mapping, "matricule");
    const nom = mappedTextCell(row, mapping, "nom");
    if (!matricule || !nom) continue;

    await prisma.refAssure.upsert({
      where: { matricule_compagnieId: { matricule, compagnieId } },
      create: {
        compagnieId,
        matricule,
        nom,
        prenom: mappedTextCell(row, mapping, "prenom") || null,
        dateNaissance: mappedDateCell(row, mapping, "dateNaissance"),
        sexe: mappedTextCell(row, mapping, "sexe") || null,
        statut: mappedTextCell(row, mapping, "statut") || null,
        dateAffiliation: mappedDateCell(row, mapping, "dateAffiliation"),
        dateRadiation: mappedDateCell(row, mapping, "dateRadiation"),
        dateFinDroit: mappedDateCell(row, mapping, "dateFinDroit"),
        codeSouscripteur: mappedTextCell(row, mapping, "codeSouscripteur") || null,
        souscripteur: mappedTextCell(row, mapping, "souscripteur") || null,
        numeroGroupe: mappedTextCell(row, mapping, "numeroGroupe") || null,
        matriculeAssurePrincipal: mappedTextCell(row, mapping, "matriculeAssurePrincipal") || null,
        nomAssurePrincipal: mappedTextCell(row, mapping, "nomAssurePrincipal") || null,
        prenomsAssurePrincipal: mappedTextCell(row, mapping, "prenomsAssurePrincipal") || null,
        police: mappedTextCell(row, mapping, "police") || null,
        policeInterne: mappedTextCell(row, mapping, "policeInterne") || null,
        numeroCollege: mappedTextCell(row, mapping, "numeroCollege") || null,
        college: mappedTextCell(row, mapping, "college") || null,
        actif: mappedBoolCell(row, mapping, "actif"),
      },
      update: {
        nom,
        prenom: mappedTextCell(row, mapping, "prenom") || null,
        dateNaissance: mappedDateCell(row, mapping, "dateNaissance"),
        sexe: mappedTextCell(row, mapping, "sexe") || null,
        statut: mappedTextCell(row, mapping, "statut") || null,
        dateAffiliation: mappedDateCell(row, mapping, "dateAffiliation"),
        dateRadiation: mappedDateCell(row, mapping, "dateRadiation"),
        dateFinDroit: mappedDateCell(row, mapping, "dateFinDroit"),
        codeSouscripteur: mappedTextCell(row, mapping, "codeSouscripteur") || null,
        souscripteur: mappedTextCell(row, mapping, "souscripteur") || null,
        numeroGroupe: mappedTextCell(row, mapping, "numeroGroupe") || null,
        matriculeAssurePrincipal: mappedTextCell(row, mapping, "matriculeAssurePrincipal") || null,
        nomAssurePrincipal: mappedTextCell(row, mapping, "nomAssurePrincipal") || null,
        prenomsAssurePrincipal: mappedTextCell(row, mapping, "prenomsAssurePrincipal") || null,
        police: mappedTextCell(row, mapping, "police") || null,
        policeInterne: mappedTextCell(row, mapping, "policeInterne") || null,
        numeroCollege: mappedTextCell(row, mapping, "numeroCollege") || null,
        college: mappedTextCell(row, mapping, "college") || null,
        actif: mappedBoolCell(row, mapping, "actif"),
      },
    });
    imported += 1;
  }

  if (!imported) throw new Error("Aucune ligne valide importée. Les colonnes matricule et nom sont obligatoires.");
  revalidatePath("/parametres");
}

export async function importRefActes(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  const compagnieId = scopedCompany(user, formData);
  const { rows, mapping } = await importRows(formData);

  let imported = 0;
  for (const row of rows) {
    const codeActe = mappedTextCell(row, mapping, "codeActe");
    const libelle = mappedTextCell(row, mapping, "libelle");
    if (!codeActe || !libelle) continue;

    await prisma.refActe.upsert({
      where: { codeActe_compagnieId: { codeActe, compagnieId } },
      create: {
        compagnieId,
        codeActe,
        libelle,
        famille: mappedTextCell(row, mapping, "famille") || null,
        tarifConventionne: mappedMoneyCell(row, mapping, "tarifConventionne"),
        couvert: mappedBoolCell(row, mapping, "couvert"),
        actif: mappedBoolCell(row, mapping, "actif"),
      },
      update: {
        libelle,
        famille: mappedTextCell(row, mapping, "famille") || null,
        tarifConventionne: mappedMoneyCell(row, mapping, "tarifConventionne"),
        couvert: mappedBoolCell(row, mapping, "couvert"),
        actif: mappedBoolCell(row, mapping, "actif"),
      },
    });
    imported += 1;
  }

  if (!imported) throw new Error("Aucune ligne valide importée. Les champs codeActe et libelle sont obligatoires.");
  revalidatePath("/parametres");
}

export async function importRefPrestataires(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  const compagnieId = scopedCompany(user, formData);
  const { rows, mapping } = await importRows(formData);

  let imported = 0;
  for (const row of rows) {
    const code = mappedTextCell(row, mapping, "code");
    const nom = mappedTextCell(row, mapping, "nom");
    if (!code || !nom) continue;

    await prisma.refPrestataire.upsert({
      where: { code_compagnieId: { code, compagnieId } },
      create: {
        compagnieId,
        code,
        nom,
        statut: mappedTextCell(row, mapping, "statut") || "agree",
        actif: mappedBoolCell(row, mapping, "actif"),
      },
      update: {
        nom,
        statut: mappedTextCell(row, mapping, "statut") || "agree",
        actif: mappedBoolCell(row, mapping, "actif"),
      },
    });
    imported += 1;
  }

  if (!imported) throw new Error("Aucune ligne valide importée. Les champs code et nom sont obligatoires.");
  revalidatePath("/parametres");
}

export async function importRefContrats(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  const compagnieId = scopedCompany(user, formData);
  const { rows, mapping } = await importRows(formData);

  let imported = 0;
  for (const row of rows) {
    const codeContrat = mappedTextCell(row, mapping, "codeContrat");
    const libelle = mappedTextCell(row, mapping, "libelle");
    if (!codeContrat || !libelle) continue;

    await prisma.refContrat.upsert({
      where: { codeContrat_compagnieId: { codeContrat, compagnieId } },
      create: {
        compagnieId,
        codeContrat,
        libelle,
        police: mappedTextCell(row, mapping, "police") || null,
        policeInterne: mappedTextCell(row, mapping, "policeInterne") || null,
        codeSouscripteur: mappedTextCell(row, mapping, "codeSouscripteur") || null,
        souscripteur: mappedTextCell(row, mapping, "souscripteur") || null,
        dateDebut: mappedDateCell(row, mapping, "dateDebut"),
        dateFin: mappedDateCell(row, mapping, "dateFin"),
        actif: mappedBoolCell(row, mapping, "actif"),
      },
      update: {
        libelle,
        police: mappedTextCell(row, mapping, "police") || null,
        policeInterne: mappedTextCell(row, mapping, "policeInterne") || null,
        codeSouscripteur: mappedTextCell(row, mapping, "codeSouscripteur") || null,
        souscripteur: mappedTextCell(row, mapping, "souscripteur") || null,
        dateDebut: mappedDateCell(row, mapping, "dateDebut"),
        dateFin: mappedDateCell(row, mapping, "dateFin"),
        actif: mappedBoolCell(row, mapping, "actif"),
      },
    });
    imported += 1;
  }

  if (!imported) throw new Error("Aucune ligne valide importée. Les champs codeContrat et libelle sont obligatoires.");
  revalidatePath("/parametres");
}

export async function importRefPlafonds(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  const compagnieId = scopedCompany(user, formData);
  const { rows, mapping } = await importRows(formData);

  let imported = 0;
  for (const row of rows) {
    const codePlafond = mappedTextCell(row, mapping, "codePlafond");
    const libelle = mappedTextCell(row, mapping, "libelle");
    const typePlafond = mappedTextCell(row, mapping, "typePlafond");
    if (!codePlafond || !libelle || !typePlafond) continue;

    await prisma.refPlafond.upsert({
      where: { codePlafond_compagnieId: { codePlafond, compagnieId } },
      create: {
        compagnieId,
        contratId: mappedIntCell(row, mapping, "contratId"),
        codePlafond,
        libelle,
        typePlafond,
        police: mappedTextCell(row, mapping, "police") || null,
        numeroCollege: mappedTextCell(row, mapping, "numeroCollege") || null,
        codeActe: mappedTextCell(row, mapping, "codeActe") || null,
        famille: mappedTextCell(row, mapping, "famille") || null,
        montantPlafond: mappedMoneyCell(row, mapping, "montantPlafond"),
        periodicite: mappedTextCell(row, mapping, "periodicite") || null,
        actif: mappedBoolCell(row, mapping, "actif"),
      },
      update: {
        contratId: mappedIntCell(row, mapping, "contratId"),
        libelle,
        typePlafond,
        police: mappedTextCell(row, mapping, "police") || null,
        numeroCollege: mappedTextCell(row, mapping, "numeroCollege") || null,
        codeActe: mappedTextCell(row, mapping, "codeActe") || null,
        famille: mappedTextCell(row, mapping, "famille") || null,
        montantPlafond: mappedMoneyCell(row, mapping, "montantPlafond"),
        periodicite: mappedTextCell(row, mapping, "periodicite") || null,
        actif: mappedBoolCell(row, mapping, "actif"),
      },
    });
    imported += 1;
  }

  if (!imported) throw new Error("Aucune ligne valide importée. Les champs codePlafond, libelle et typePlafond sont obligatoires.");
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

export async function updateReference(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  const type = String(formData.get("type") ?? "") as ReferenceType;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  if (type === "assures") {
    const existing = await prisma.refAssure.findUnique({ where: { id } });
    if (!canAccess(user, existing?.compagnieId)) return;
    await prisma.refAssure.update({
      where: { id },
      data: {
        matricule: required(formData, "matricule"),
        nom: required(formData, "nom"),
        prenom: optional(formData, "prenom"),
        dateNaissance: dateValue(formData, "dateNaissance"),
        statut: optional(formData, "statut"),
        police: optional(formData, "police"),
        policeInterne: optional(formData, "policeInterne"),
        numeroCollege: optional(formData, "numeroCollege"),
        college: optional(formData, "college"),
        codeSouscripteur: optional(formData, "codeSouscripteur"),
        souscripteur: optional(formData, "souscripteur"),
        matriculeAssurePrincipal: optional(formData, "matriculeAssurePrincipal"),
        dateAffiliation: dateValue(formData, "dateAffiliation"),
        dateRadiation: dateValue(formData, "dateRadiation"),
        actif: booleanValue(formData, "actif"),
      },
    });
  }

  if (type === "prestataires") {
    const existing = await prisma.refPrestataire.findUnique({ where: { id } });
    if (!canAccess(user, existing?.compagnieId)) return;
    await prisma.refPrestataire.update({
      where: { id },
      data: {
        code: required(formData, "code"),
        nom: required(formData, "nom"),
        statut: optional(formData, "statut") ?? "agree",
        actif: booleanValue(formData, "actif"),
      },
    });
  }

  if (type === "actes") {
    const existing = await prisma.refActe.findUnique({ where: { id } });
    if (!canAccess(user, existing?.compagnieId)) return;
    await prisma.refActe.update({
      where: { id },
      data: {
        codeActe: required(formData, "codeActe"),
        libelle: required(formData, "libelle"),
        famille: optional(formData, "famille"),
        tarifConventionne: moneyValue(formData, "tarifConventionne"),
        couvert: booleanValue(formData, "couvert"),
        actif: booleanValue(formData, "actif"),
      },
    });
  }

  if (type === "contrats") {
    const existing = await prisma.refContrat.findUnique({ where: { id } });
    if (!canAccess(user, existing?.compagnieId)) return;
    await prisma.refContrat.update({
      where: { id },
      data: {
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
  }

  if (type === "plafonds") {
    const existing = await prisma.refPlafond.findUnique({ where: { id } });
    if (!canAccess(user, existing?.compagnieId)) return;
    await prisma.refPlafond.update({
      where: { id },
      data: {
        contratId: numberValue(formData, "contratId"),
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
  }

  revalidatePath("/parametres");
}

export async function deleteReference(formData: FormData) {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  const type = String(formData.get("type") ?? "") as ReferenceType;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  if (type === "assures") {
    const existing = await prisma.refAssure.findUnique({ where: { id } });
    if (canAccess(user, existing?.compagnieId)) await prisma.refAssure.delete({ where: { id } });
  }
  if (type === "prestataires") {
    const existing = await prisma.refPrestataire.findUnique({ where: { id } });
    if (canAccess(user, existing?.compagnieId)) await prisma.refPrestataire.delete({ where: { id } });
  }
  if (type === "actes") {
    const existing = await prisma.refActe.findUnique({ where: { id } });
    if (canAccess(user, existing?.compagnieId)) await prisma.refActe.delete({ where: { id } });
  }
  if (type === "contrats") {
    const existing = await prisma.refContrat.findUnique({ where: { id } });
    if (canAccess(user, existing?.compagnieId)) await prisma.refContrat.delete({ where: { id } });
  }
  if (type === "plafonds") {
    const existing = await prisma.refPlafond.findUnique({ where: { id } });
    if (canAccess(user, existing?.compagnieId)) await prisma.refPlafond.delete({ where: { id } });
  }
  revalidatePath("/parametres");
}

function canAccess(user: { role: string; compagnieId: number }, compagnieId?: number | null) {
  return Boolean(compagnieId) && (user.role === "super_admin" || user.compagnieId === compagnieId);
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

async function importRows(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Fichier Excel manquant.");
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!rows.length) throw new Error("Le fichier ne contient aucune ligne.");
  return { rows, mapping: parseMapping(formData) };
}

function parseMapping(formData: FormData) {
  const raw = String(formData.get("mapping") ?? "{}");
  const parsed = JSON.parse(raw) as Record<string, string>;
  return parsed;
}

function mappedTextCell(row: Record<string, unknown>, mapping: Record<string, string>, key: string) {
  const source = mapping[key];
  if (!source) return "";
  return String(row[source] ?? "").trim();
}

function mappedDateCell(row: Record<string, unknown>, mapping: Record<string, string>, key: string) {
  return parseDateValue(row[mapping[key] ?? ""]);
}

function mappedMoneyCell(row: Record<string, unknown>, mapping: Record<string, string>, key: string) {
  const value = String(row[mapping[key] ?? ""] ?? "0").replace(/\s/g, "").replace(",", ".");
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mappedIntCell(row: Record<string, unknown>, mapping: Record<string, string>, key: string) {
  const value = Number(row[mapping[key] ?? ""]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function mappedBoolCell(row: Record<string, unknown>, mapping: Record<string, string>, key: string) {
  const source = mapping[key];
  if (!source) return true;
  const value = String(row[source] ?? "Oui").trim().toLowerCase();
  return !["non", "no", "false", "0", "inactif"].includes(value);
}

function normalizeRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = value;
  }
  return normalized;
}

function normalizeHeader(value: string) {
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const aliases: Record<string, string> = {
    prenom: "prenom",
    prenoms: "prenom",
    datenaissance: "dateNaissance",
    dateaffiliation: "dateAffiliation",
    dateradiation: "dateRadiation",
    datefindroit: "dateFinDroit",
    codesouscripteur: "codeSouscripteur",
    numerogroupe: "numeroGroupe",
    matriculeassureprincipal: "matriculeAssurePrincipal",
    nomassureprincipal: "nomAssurePrincipal",
    prenomsassureprincipal: "prenomsAssurePrincipal",
    policeinterne: "policeInterne",
    numerocollege: "numeroCollege",
  };
  return aliases[key] ?? key;
}

function textCell(row: Record<string, unknown>, key: string) {
  return String(row[key] ?? "").trim();
}

function dateCell(row: Record<string, unknown>, key: string) {
  return parseDateValue(row[key]);
}

function parseDateValue(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim();
  if (!text) return null;
  const date = new Date(text.includes("/") ? text.split("/").reverse().join("-") : `${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function boolCell(row: Record<string, unknown>, key: string) {
  const value = String(row[key] ?? "Oui").trim().toLowerCase();
  return !["non", "no", "false", "0", "inactif"].includes(value);
}
