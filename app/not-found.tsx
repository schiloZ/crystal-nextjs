import Link from "next/link";

export default function NotFound() {
  return <main className="min-h-screen bg-soft p-8">
    <section className="mx-auto mt-24 max-w-xl card p-8">
      <div className="mb-4 inline-flex rounded-lg bg-sky px-4 py-3 text-2xl font-black text-navy">CRYSTAL</div>
      <h1 className="text-2xl font-black text-navy">Page introuvable</h1>
      <p className="mt-2 text-sm text-slate-600">La page demandée n'existe pas ou n'est plus disponible.</p>
      <Link href="/dashboard" className="btn mt-6 inline-flex">Retour au tableau de bord</Link>
    </section>
  </main>;
}
