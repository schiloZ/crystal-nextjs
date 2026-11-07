import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { COMPANY_BLOCKED_MESSAGE } from "@/lib/company-access";

export default async function Login(props: { searchParams?: Promise<{ acces?: string }> }) {
  const searchParams = await props.searchParams;
  const companyBlocked = searchParams?.acces === "suspendu";

  async function action(formData: FormData) {
    "use server";

    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/dashboard?toast=login",
      });
    } catch (error) {
      if (error instanceof CredentialsSignin && error.code === "compagnie_bloquee") redirect("/login?acces=suspendu");
      if (error instanceof AuthError) redirect("/login?toast=login-error");
      throw error;
    }
  }

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-[43%_57%] bg-[#eef8ff]">
      <section className="relative overflow-hidden bg-[#09275a] text-white px-8 py-10 lg:px-14 flex flex-col justify-between">
        <div>
          <div className="bg-[#39b9f2] text-[#05265a] rounded-lg px-6 py-4 w-[310px]">
            <div className="text-5xl font-black tracking-tight">CRYSTAL</div>
            <div className="text-sm mt-1">Audit de Gestion Sante</div>
          </div>

          <h1 className="mt-12 max-w-sm text-2xl font-black leading-tight">
            La plateforme d&apos;audit
            <br />
            <span className="text-[#39b9f2]">la plus complete</span>
            <br />
            pour vos gestionnaires.
          </h1>

          <div className="mt-12 space-y-3 text-sm text-blue-100/80">
            <p>+ 10 categories de controles auto</p>
            <p>+ Detection fraude temps reel</p>
            <p>+ Rapports PDF automatiques</p>
            <p>+ BI integree multi-compagnies</p>
          </div>
        </div>

        <div className="relative mt-20">
          <div className="absolute -bottom-36 left-40 h-52 w-52 rounded-full bg-[#0d91cf]" />
          <div className="absolute -bottom-28 left-72 h-36 w-36 rounded-full bg-[#1d3779]" />

          <div className="relative z-10 grid grid-cols-3 gap-3 max-w-md">
            <div className="bg-white text-[#09275a] rounded-md p-4 border-b-4 border-[#39b9f2]">
              <b className="text-2xl text-[#39b9f2]">12 485</b>
              <p className="text-xs mt-1">Lignes/mois</p>
            </div>

            <div className="bg-white text-[#09275a] rounded-md p-4 border-b-4 border-[#059669]">
              <b className="text-2xl text-[#059669]">37</b>
              <p className="text-xs mt-1">Controles</p>
            </div>

            <div className="bg-white text-[#09275a] rounded-md p-4 border-b-4 border-[#f18a00]">
              <b className="text-2xl text-[#f18a00]">9.2%</b>
              <p className="text-xs mt-1">Fraude</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center px-8 py-12">
        <form action={action} className="w-full max-w-md">
          <h2 className="text-3xl font-black text-[#09275a]">
            Connexion a Crystal
          </h2>

          <p className="text-sm text-slate-600 mb-6">
            Identifiants pour acceder a la plateforme
          </p>

          {companyBlocked && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
              {COMPANY_BLOCKED_MESSAGE}
            </div>
          )}

          <label className="text-xs font-bold text-[#09275a]">Email</label>
          <input
            name="email"
            type="email"
            placeholder="votre@email.com"
            required
            autoComplete="username"
            className="mt-1 mb-6 w-full h-12 rounded-md border border-[#9edcff] bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-[#39b9f2]"
          />

          <label className="text-xs font-bold text-[#09275a]">
            Mot de passe
          </label>
          <input
            name="password"
            type="password"
            placeholder="••••••••••"
            required
            autoComplete="current-password"
            className="mt-1 mb-3 w-full h-12 rounded-md border border-[#9edcff] bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-[#39b9f2]"
          />

          <div className="mb-3 flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-[#39b9f2]" />
              Se souvenir de moi
            </label>

            <a href="#" className="font-bold text-[#008bd2]">
              Mot de passe oublie ?
            </a>
          </div>

          <button className="h-12 w-full rounded-md bg-[#0d91cf] text-white font-black shadow-md hover:bg-[#087fba]">
            SE CONNECTER&nbsp; →
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
            <div className="h-px flex-1 bg-[#bde8ff]" />
            ou
            <div className="h-px flex-1 bg-[#bde8ff]" />
          </div>

          <button
            type="button"
            className="h-12 w-full rounded-md border border-[#9edcff] bg-white text-[#09275a]"
          >
            Connexion SSO Entreprise
          </button>
        </form>

        <p className="absolute bottom-8 text-xs text-slate-500">
          (c) 2026 ARIEL INDUSTRIES SARL — Crystal v1.0
        </p>
      </section>
    </main>
  );
}
