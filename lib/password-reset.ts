import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, sendEmail } from "@/lib/email";

export const RESET_TOKEN_TTL_MINUTES = 30;
const MAX_REQUESTS_PER_WINDOW = 3;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Renvoie le jeton s'il existe, n'a pas servi et n'a pas expiré. */
export async function findValidResetToken(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { utilisateur: { select: { id: true, email: true, actif: true } } },
  });
  if (!record || record.usedAt || record.expiresAt <= new Date() || !record.utilisateur.actif) return null;
  return record;
}

/**
 * Crée un jeton et envoie le lien. Ne révèle jamais si l'adresse existe :
 * l'appelant affiche toujours le même message.
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return;

  const user = await prisma.utilisateur.findUnique({ where: { email }, select: { id: true, email: true, actif: true, prenoms: true, nom: true } });
  if (!user || !user.actif) return;

  // Limite les envois pour éviter de submerger une boîte de réception.
  const recent = await prisma.passwordResetToken.count({
    where: { utilisateurId: user.id, createdAt: { gt: new Date(Date.now() - REQUEST_WINDOW_MS) } },
  });
  if (recent >= MAX_REQUESTS_PER_WINDOW) return;

  const baseUrl = appBaseUrl();
  if (!baseUrl) {
    console.error("[password-reset] APP_URL (ou NEXTAUTH_URL) manquant : lien impossible à construire.");
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await prisma.$transaction([
    // Un seul lien actif à la fois : les anciens sont marqués comme utilisés
    // (et non supprimés, pour qu'ils restent comptés dans la limite d'envoi).
    prisma.passwordResetToken.updateMany({ where: { utilisateurId: user.id, usedAt: null }, data: { usedAt: now } }),
    // Ménage : les jetons de plus de 24 h ne servent plus à rien.
    prisma.passwordResetToken.deleteMany({ where: { utilisateurId: user.id, createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
    prisma.passwordResetToken.create({
      data: { utilisateurId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000) },
    }),
  ]);

  const link = `${baseUrl}/reinitialiser-mot-de-passe?token=${token}`;
  const name = `${user.prenoms ?? ""} ${user.nom}`.trim();
  await sendEmail({
    to: user.email,
    subject: "CRYSTAL : réinitialisation de votre mot de passe",
    text: `Bonjour ${name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable ${RESET_TOKEN_TTL_MINUTES} minutes, utilisable une seule fois) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste valable.\n\nCRYSTAL — Audit de Gestion Santé`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1e252c">
  <div style="background:#09275a;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0"><strong style="font-size:22px">CRYSTAL</strong><div style="font-size:13px;color:#39b9f2">Audit de Gestion Santé</div></div>
  <div style="border:1px solid #dbe5ef;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
    <p style="text-align:center;margin:28px 0"><a href="${link}" style="background:#0d91cf;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:6px;display:inline-block">Choisir un nouveau mot de passe</a></p>
    <p style="font-size:13px;color:#5b6673">Ce lien est valable ${RESET_TOKEN_TTL_MINUTES} minutes et ne peut servir qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste valable.</p>
  </div>
</div>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
