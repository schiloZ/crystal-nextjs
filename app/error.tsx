"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-screen bg-soft p-8">
    <section className="mx-auto mt-24 max-w-xl card p-8">
      <div className="mb-4 inline-flex rounded-lg bg-sky px-4 py-3 text-2xl font-black text-navy">CRYSTAL</div>
      <h1 className="text-2xl font-black text-navy">Erreur d'affichage</h1>
      <p className="mt-2 text-sm text-slate-600">Une erreur est survenue pendant le rendu de cette page.</p>
      {error.digest && <p className="mt-3 text-xs font-bold text-slate-500">Digest: {error.digest}</p>}
      <button onClick={reset} className="btn mt-6" type="button">Réessayer</button>
    </section>
  </main>;
}
