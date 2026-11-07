import { AuthCard, authButtonClass, authInputClass } from "@/components/auth-card";
import { RESET_TOKEN_TTL_MINUTES } from "@/lib/password-reset";
import { requestResetAction } from "./actions";

export default async function ForgotPasswordPage(props: { searchParams?: Promise<{ envoye?: string }> }) {
  const searchParams = await props.searchParams;
  const sent = searchParams?.envoye === "1";

  return (
    <AuthCard
      subtitle="Saisissez l'adresse e-mail de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe."
      title="Mot de passe oublié"
    >
      {sent ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-800" role="status">
          Si un compte actif correspond à cette adresse, un e-mail contenant un lien de réinitialisation vient d&apos;être envoyé. Le lien est valable {RESET_TOKEN_TTL_MINUTES} minutes. Pensez à vérifier vos courriers indésirables.
        </div>
      ) : (
        <form action={requestResetAction} className="space-y-6">
          <label className="block">
            <span className="text-xs font-bold text-[#09275a]">Email</span>
            <input autoComplete="email" className={`${authInputClass} mt-1`} maxLength={150} name="email" placeholder="votre@email.com" required type="email" />
          </label>
          <button className={authButtonClass} type="submit">ENVOYER LE LIEN</button>
        </form>
      )}
    </AuthCard>
  );
}
