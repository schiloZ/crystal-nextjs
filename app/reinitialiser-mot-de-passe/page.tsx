import { AuthCard, authButtonClass, authInputClass } from "@/components/auth-card";
import { PasswordInput } from "@/components/password-input";
import { PASSWORD_RULE_MESSAGE } from "@/lib/password";
import { findValidResetToken } from "@/lib/password-reset";
import { resetPasswordAction } from "../mot-de-passe-oublie/actions";

const errors: Record<string, string> = {
  different: "Les deux mots de passe ne sont pas identiques.",
  regle: PASSWORD_RULE_MESSAGE,
};

export default async function ResetPasswordPage(props: { searchParams?: Promise<{ token?: string; erreur?: string }> }) {
  const searchParams = await props.searchParams;
  const token = searchParams?.token ?? "";
  const record = token ? await findValidResetToken(token) : null;

  if (!record) {
    return (
      <AuthCard subtitle="Ce lien de réinitialisation n'est plus utilisable." title="Lien invalide ou expiré">
        <p className="mb-6 text-sm font-semibold text-slate-700">
          Le lien a peut-être déjà servi, ou il a dépassé sa durée de validité. Vous pouvez en demander un nouveau.
        </p>
        <a className={`${authButtonClass} grid place-items-center`} href="/mot-de-passe-oublie">DEMANDER UN NOUVEAU LIEN</a>
      </AuthCard>
    );
  }

  const error = searchParams?.erreur ? errors[searchParams.erreur] : undefined;

  return (
    <AuthCard subtitle={`Compte : ${record.utilisateur.email}`} title="Nouveau mot de passe">
      {error && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{error}</div>
      )}
      <form action={resetPasswordAction} className="space-y-5">
        <input name="token" type="hidden" value={token} />
        <label className="block">
          <span className="text-xs font-bold text-[#09275a]">Nouveau mot de passe</span>
          <div className="mt-1"><PasswordInput autoComplete="new-password" className={authInputClass} minLength={12} name="password" required /></div>
          <span className="mt-1 block text-xs text-slate-500">{PASSWORD_RULE_MESSAGE}</span>
        </label>
        <label className="block">
          <span className="text-xs font-bold text-[#09275a]">Confirmer le mot de passe</span>
          <div className="mt-1"><PasswordInput autoComplete="new-password" className={authInputClass} minLength={12} name="confirmation" required /></div>
        </label>
        <button className={authButtonClass} type="submit">ENREGISTRER LE MOT DE PASSE</button>
      </form>
    </AuthCard>
  );
}
