import { CredentialsSignin } from "next-auth";

export const COMPANY_BLOCKED_MESSAGE =
  "L'accès de votre compagnie est suspendu ou sa période d'essai est terminée. Veuillez contacter l'administrateur.";

/** Erreur de connexion distincte, pour afficher le message « contactez l'administrateur ». */
export class CompanyAccessBlocked extends CredentialsSignin {
  code = "compagnie_bloquee";
}

type CompanyAccess = { actif: boolean; dateFinEssai: Date | null };

/** Le jour de fin d'essai est inclus : l'accès s'arrête le lendemain à 00:00 (UTC). */
export function isTrialExpired(dateFinEssai: Date | null, now = new Date()): boolean {
  if (!dateFinEssai) return false;
  const endExclusive = Date.UTC(dateFinEssai.getUTCFullYear(), dateFinEssai.getUTCMonth(), dateFinEssai.getUTCDate() + 1);
  return now.getTime() >= endExclusive;
}

/** Le super administrateur n'est jamais bloqué, pour ne pas perdre l'accès à l'administration. */
export function isCompanyBlocked(company: CompanyAccess, role: string, now = new Date()): boolean {
  if (role === "super_admin") return false;
  return !company.actif || isTrialExpired(company.dateFinEssai, now);
}

export type CompanyStatus = "active" | "essai" | "essai_expire" | "suspendue";

export function companyStatus(company: CompanyAccess, now = new Date()): CompanyStatus {
  if (!company.actif) return "suspendue";
  if (!company.dateFinEssai) return "active";
  return isTrialExpired(company.dateFinEssai, now) ? "essai_expire" : "essai";
}

export const companyStatusLabel: Record<CompanyStatus, string> = {
  active: "Active",
  essai: "En essai",
  essai_expire: "Essai expiré",
  suspendue: "Suspendue",
};
