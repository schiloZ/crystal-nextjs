"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="fr">
    <body>
      <main className="min-h-screen bg-soft p-8">
        <section className="mx-auto mt-24 max-w-xl rounded-lg border border-sky/20 bg-white p-8 shadow-soft">
          <div className="mb-4 inline-flex rounded-lg bg-sky px-4 py-3 text-2xl font-black text-navy">CRYSTAL</div>
          <h1 className="text-2xl font-black text-navy">Erreur critique</h1>
          <p className="mt-2 text-sm text-slate-600">L'application n'a pas pu afficher la page demandée.</p>
          <button onClick={reset} className="mt-6 rounded-lg bg-sky px-4 py-2 text-sm font-black text-white" type="button">Réessayer</button>
        </section>
      </main>
    </body>
  </html>;
}
