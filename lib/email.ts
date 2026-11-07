/**
 * Envoi d'e-mails transactionnels via l'API HTTP de Resend (https://resend.com).
 *
 * Variables d'environnement :
 *   RESEND_API_KEY  clé API Resend
 *   EMAIL_FROM      expéditeur, ex. "CRYSTAL <no-reply@votre-domaine.ci>"
 *                   (le domaine doit être vérifié dans Resend)
 *
 * Sans clé, en développement, le contenu est affiché dans la console du serveur.
 */
type Email = { to: string; subject: string; html: string; text: string };

export async function sendEmail(email: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:dev] À : ${email.to}\nObjet : ${email.subject}\n${email.text}`);
      return true;
    }
    console.error("[email] RESEND_API_KEY ou EMAIL_FROM manquant : e-mail non envoyé.");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
    });
    if (!response.ok) {
      console.error(`[email] Échec Resend (HTTP ${response.status}) : ${(await response.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Erreur réseau lors de l'envoi :", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * URL publique de l'application, jamais déduite de l'en-tête Host de la requête
 * (qui peut être falsifié pour envoyer des liens vers un autre site).
 */
export function appBaseUrl(): string | null {
  const explicit = process.env.APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}
