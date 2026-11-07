import type { ReactNode } from "react";

/** Mise en page des écrans hors connexion (mot de passe oublié, réinitialisation). */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#eef8ff] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 inline-block rounded-lg bg-[#39b9f2] px-5 py-3 text-[#05265a]">
          <div className="text-3xl font-black tracking-tight">CRYSTAL</div>
          <div className="text-xs">Audit de Gestion Santé</div>
        </div>
        <section className="rounded-lg bg-white p-8 shadow-md">
          <h1 className="text-2xl font-black text-[#09275a]">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-600">{subtitle}</p>
          {children}
        </section>
        <p className="mt-6 text-center text-sm">
          <a className="font-bold text-[#008bd2]" href="/login">← Retour à la connexion</a>
        </p>
      </div>
    </main>
  );
}

export const authInputClass =
  "w-full h-12 rounded-md border border-[#9edcff] bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-[#39b9f2]";
export const authButtonClass =
  "h-12 w-full rounded-md bg-[#0d91cf] font-black text-white shadow-md hover:bg-[#087fba]";
