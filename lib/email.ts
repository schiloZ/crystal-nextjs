/**
 * Envoi d'e-mails transactionnels par API HTTP (aucune dépendance).
 *
 * Fournisseur choisi selon les variables présentes :
 *   BREVO_API_KEY   Brevo (https://brevo.com) : fonctionne SANS nom de domaine,
 *                   avec une simple adresse expéditrice vérifiée (ex. un Gmail).
 *   RESEND_API_KEY  Resend (https://resend.com) : exige un domaine vérifié.
 *
 *   EMAIL_FROM      expéditeur, ex. "CRYSTAL <votre.adresse@gmail.com>"
 *                   (doit être l'adresse vérifiée chez le fournisseur)
 *
 * Sans fournisseur configuré, en développement, le contenu est affiché dans la console.
 */
type Email = { to: string; subject: string; html: string; text: string };

export async function sendEmail(email: Email): Promise<boolean> {
  const from = process.env.EMAIL_FROM;
  const brevoKey = process.env.BREVO_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!from || (!brevoKey && !resendKey)) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:dev] À : ${email.to}\nObjet : ${email.subject}\n${email.text}`);
      return true;
    }
    console.error("[email] EMAIL_FROM et BREVO_API_KEY (ou RESEND_API_KEY) requis : e-mail non envoyé.");
    return false;
  }

  try {
    const response = brevoKey ? await sendWithBrevo(brevoKey, from, email) : await sendWithResend(resendKey!, from, email);
    if (!response.ok) {
      console.error(`[email] Échec ${brevoKey ? "Brevo" : "Resend"} (HTTP ${response.status}) : ${(await response.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Erreur réseau lors de l'envoi :", error instanceof Error ? error.message : error);
    return false;
  }
}

function sendWithBrevo(apiKey: string, from: string, email: Email) {
  const sender = parseAddress(from);
  return fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: sender.name ? { name: sender.name, email: sender.email } : { email: sender.email },
      to: [{ email: email.to }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
    }),
  });
}

function sendWithResend(apiKey: string, from: string, email: Email) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
  });
}

/** "CRYSTAL <a@b.c>" -> { name: "CRYSTAL", email: "a@b.c" } ; "a@b.c" -> { email: "a@b.c" } */
export function parseAddress(value: string): { name?: string; email: string } {
  const match = value.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  if (!match) return { email: value.trim() };
  const name = match[1].replace(/^"|"$/g, "").trim();
  return name ? { name, email: match[2] } : { email: match[2] };
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
