import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCompanyBlocked } from "@/lib/company-access";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  compagnieId: number;
  compagnieNom: string;
  filialeId: number | null;
  filialeNom: string | null;
};

/** Rôles autorisés à importer des fichiers de prestations (le lecteur est en lecture seule). */
export const IMPORT_ROLES: UserRole[] = ["super_admin", "admin_compagnie", "admin_filiale", "auditeur"];

/**
 * Recharge l'utilisateur depuis la base à chaque requête : un compte désactivé
 * ou un rôle modifié prend effet immédiatement, sans attendre l'expiration du jeton.
 */
async function loadSessionUser(): Promise<{ user: CurrentUser | null; companyBlocked: boolean }> {
  const session = await auth();
  const sessionId = Number((session?.user as { id?: string } | undefined)?.id);
  if (!Number.isInteger(sessionId) || sessionId <= 0) return { user: null, companyBlocked: false };
  const user = await prisma.utilisateur.findUnique({
    where: { id: sessionId },
    include: { compagnie: true, filiale: true },
  });
  if (!user || !user.actif) return { user: null, companyBlocked: false };
  // Une session ouverte avant la fin d'essai ou la suspension est coupée immédiatement.
  if (isCompanyBlocked(user.compagnie, user.role)) return { user: null, companyBlocked: true };

  return { companyBlocked: false, user: {
    id: user.id,
    name: `${user.prenoms ?? ""} ${user.nom}`.trim() || user.email,
    email: user.email,
    role: user.role,
    compagnieId: user.compagnieId,
    compagnieNom: user.compagnie.nom,
    filialeId: user.filialeId,
    filialeNom: user.filiale?.nom ?? null,
  } };
}

/** Pour les pages et Server Actions : redirige vers /login si la session n'est pas valide. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const { user, companyBlocked } = await loadSessionUser();
  if (!user) redirect(companyBlocked ? "/login?acces=suspendu" : "/login");
  return user;
}

export async function requireRole(roles: UserRole[]) {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

/** Pour les routes API : renvoie null au lieu de rediriger, la route répond 401. */
export async function getApiUser(): Promise<CurrentUser | null> {
  return (await loadSessionUser()).user;
}
