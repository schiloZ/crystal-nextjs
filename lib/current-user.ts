import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth();
  const sessionUser = session?.user as any;
  if (!sessionUser?.id) redirect("/login");
  const user = await prisma.utilisateur.findUnique({
    where: { id: Number(sessionUser.id) },
    include: { compagnie: true, filiale: true },
  });
  if (!user || !user.actif) redirect("/login");

  return {
    id: user.id,
    name: `${user.prenoms ?? ""} ${user.nom}`.trim() || user.email,
    email: user.email,
    role: user.role,
    compagnieId: user.compagnieId,
    compagnieNom: user.compagnie.nom,
    filialeId: user.filialeId,
    filialeNom: user.filiale?.nom ?? null,
  };
}

export async function requireRole(roles: UserRole[]) {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}
