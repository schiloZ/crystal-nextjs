"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordSchema } from "@/lib/password";
import { clearLoginFailures } from "@/lib/login-throttle";
import { hashResetToken, requestPasswordReset } from "@/lib/password-reset";

export async function requestResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").slice(0, 150);
  try {
    await requestPasswordReset(email);
  } catch (error) {
    // Même réponse en cas d'erreur, pour ne rien révéler sur l'existence du compte.
    console.error("[password-reset] Échec de la demande :", error instanceof Error ? error.message : error);
  }
  redirect("/mot-de-passe-oublie?envoye=1");
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const back = (error: string) => redirect(`/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}&erreur=${error}`);

  if (password !== confirmation) back("different");
  if (!passwordSchema.safeParse(password).success) back("regle");

  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { utilisateur: { select: { id: true, email: true, actif: true } } } });
  if (!record || !record.utilisateur.actif) redirect("/reinitialiser-mot-de-passe?erreur=lien");

  const motDePasse = await hashPassword(password);
  const updated = await prisma.$transaction(async (tx) => {
    // Consomme le jeton de façon atomique : un second envoi du formulaire échoue.
    const consumed = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) return false;
    await tx.utilisateur.update({ where: { id: record.utilisateurId }, data: { motDePasse } });
    await tx.passwordResetToken.deleteMany({ where: { utilisateurId: record.utilisateurId, usedAt: null } });
    return true;
  });
  if (!updated) redirect("/reinitialiser-mot-de-passe?erreur=lien");

  clearLoginFailures(record.utilisateur.email);
  redirect("/login?toast=password-reset");
}
