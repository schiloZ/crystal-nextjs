import { AppShell } from "@/components/app-shell";
import { BarBox, DonutBox, LineBox } from "@/components/charts";
import { Status } from "@/components/ui";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const categoryLabels: Record<string, string> = {
  INTEGRITE: "Intégrité",
  BENEFICIAIRE: "Bénéf.",
  PRESTATAIRE: "Prest.",
  DOUBLON: "Doublons",
  FREQUENCE: "Fréq.",
  MONTANT: "Montants",
  ACTE: "Actes",
  TEMPOREL: "Temporel",
  CONTRACTUEL: "Contrat",
  STATISTIQUE: "Stats",
};

const monthNames = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  return <article className="relative overflow-hidden rounded-lg border border-[#d9edf7] bg-white p-6 shadow-soft">
    <div className="mb-4 grid h-16 w-16 place-items-center rounded-full text-lg font-black text-white" style={{ backgroundColor: color }}>{icon}</div>
    <h3 className="text-4xl font-black leading-none text-navy">{value}</h3>
    <p className="mt-2 text-sm font-black text-navy">{label}</p>
    <p className="text-xs font-semibold text-slate-500">{sub}</p>
    <div className="absolute bottom-0 left-0 h-1 w-full" style={{ backgroundColor: color }}/>
  </article>;
}

export default async function Page({ searchParams }: { searchParams?: { annee?: string; mois?: string } }) {
  const user = await getCurrentUser();
  const scope = user.role === "super_admin" ? {} : { compagnieId: user.compagnieId };
  const years = await prisma.fichierImporte.groupBy({ by: ["anneeFichier"], where: scope, orderBy: { anneeFichier: "desc" } });
  const selectedYear = Number(searchParams?.annee) || years[0]?.anneeFichier || new Date().getFullYear();
  const selectedMonth = Number(searchParams?.mois) || 0;
  const fileWhere = { ...scope, anneeFichier: selectedYear, ...(selectedMonth ? { moisFichier: selectedMonth } : {}) };

  const files = await prisma.fichierImporte.findMany({
    where: fileWhere,
    include: { compagnie: true, filiale: true, gestionnaire: true },
    orderBy: [{ anneeFichier: "desc" }, { moisFichier: "desc" }, { dateImport: "desc" }],
  });
  const fileIds = files.map((file) => file.id);
  const prestationWhere = { fichierImporteId: fileIds.length ? { in: fileIds } : { in: [-1] } };
  const anomalyWhere = { fichierImporteId: fileIds.length ? { in: fileIds } : { in: [-1] }, codeAnomalie: { not: "DOUBLON_STRICT" } };

  const [prestations, anomalies, amountAgg, netAgg, monthly, categories, providers, criticalAlerts] = await Promise.all([
    prisma.prestation.count({ where: prestationWhere }),
    prisma.anomalie.count({ where: anomalyWhere }),
    prisma.prestation.aggregate({ where: prestationWhere, _sum: { montantReclame: true } }),
    prisma.fichierImporte.aggregate({ where: fileWhere, _sum: { montantNetRecommande: true } }),
    prisma.fichierImporte.groupBy({ by: ["moisFichier"], where: { ...scope, anneeFichier: selectedYear }, _sum: { montantTotalReclame: true }, orderBy: { moisFichier: "asc" } }),
    prisma.anomalie.groupBy({ by: ["categorie"], where: anomalyWhere, _count: { id: true }, _sum: { montantImpacte: true }, orderBy: { _count: { id: "desc" } }, take: 5 }),
    prisma.prestation.groupBy({ by: ["codePrestataire", "prestataire"], where: prestationWhere, _count: { id: true }, _sum: { montantReclame: true }, orderBy: { _sum: { montantReclame: "desc" } }, take: 5 }),
    prisma.anomalie.findMany({ where: { ...anomalyWhere, gravite: { in: ["critique", "eleve"] } }, include: { prestation: true }, orderBy: [{ gravite: "asc" }, { montantImpacte: "desc" }], take: 5 }),
  ]);

  const montant = Number(amountAgg._sum.montantReclame ?? 0);
  const netRecommended = Number(netAgg._sum.montantNetRecommande ?? 0);
  const anomalyRate = prestations ? (anomalies / prestations) * 100 : 0;
  const lineData = monthly.map((row) => ({ name: monthNames[row.moisFichier - 1] ?? String(row.moisFichier), value: Math.round(Number(row._sum.montantTotalReclame ?? 0) / 1_000_000) }));
  const barData = categories.map((row) => ({ name: categoryLabels[row.categorie] ?? row.categorie, value: row._count.id }));
  const donutData = categories.map((row) => ({ name: categoryLabels[row.categorie] ?? row.categorie, value: row._count.id }));
  const companyName = user.role === "super_admin" ? "Toutes compagnies" : user.compagnieNom;

  return <AppShell title="Tableau de bord" subtitle="Accueil / Tableau de bord">
    <form className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-white px-5 py-3 shadow-soft">
      <span className="mr-2 text-sm font-black text-navy">Période :</span>
      <select className="input max-w-40" name="annee" defaultValue={selectedYear}>
        {years.length ? years.map((year) => <option key={year.anneeFichier} value={year.anneeFichier}>{year.anneeFichier}</option>) : <option value={selectedYear}>{selectedYear}</option>}
      </select>
      <select className="input max-w-48" name="mois" defaultValue={selectedMonth}>
        <option value="0">Toute l'année</option>
        {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
      </select>
      <button className="btn">Afficher</button>
      <div className="ml-auto flex items-center gap-8 text-sm">
        <span className="font-semibold text-slate-500">Compagnie :</span>
        <b className="text-navy">{companyName}</b>
      </div>
    </form>

    <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon="LI" label="Lignes importées" value={prestations.toLocaleString("fr-FR")} sub={`${files.length} fichier(s) analysé(s)`} color="#38bdf8"/>
      <KpiCard icon="AN" label="Anomalies" value={anomalies.toLocaleString("fr-FR")} sub={`${anomalyRate.toFixed(1)}% des lignes`} color="#dc2626"/>
      <KpiCard icon="MR" label="Montant réclamé" value={`${(montant / 1_000_000).toFixed(1)} M`} sub="FCFA sur le périmètre" color="#d97706"/>
      <KpiCard icon="MP" label="Mnt recommandé" value={`${(netRecommended / 1_000_000).toFixed(1)} M`} sub="FCFA à payer estimé" color="#059669"/>
    </div>

    <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1.35fr_1fr]">
      <section className="card p-4">
        <h2 className="font-black text-navy">Évolution consommation mensuelle (M FCFA)</h2>
        <LineBox data={lineData.length ? lineData : [{ name: "-", value: 0 }]}/>
      </section>
      <section className="card p-4">
        <h2 className="font-black text-navy">Anomalies par catégorie</h2>
        <BarBox data={barData.length ? barData : [{ name: "-", value: 0 }]}/>
      </section>
      <section className="card p-4">
        <h2 className="font-black text-navy">Répartition</h2>
        <DonutBox center={anomalies.toLocaleString("fr-FR")} data={donutData.length ? donutData : [{ name: "-", value: 1 }]}/>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
          {donutData.map((item, index) => <div key={item.name} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: ["#38bdf8", "#ef4444", "#f97316", "#facc15", "#7c3aed"][index] }}/>
            {item.name} {item.value}
          </div>)}
        </div>
      </section>
    </div>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
      <section>
        <h2 className="mb-3 text-2xl font-black text-navy">Top 5 prestataires par montant</h2>
        <div className="overflow-hidden rounded-lg border border-[#d9edf7] bg-white">
          <table className="table">
            <thead><tr><th>Code</th><th>Prestataire</th><th>Nb actes</th><th>Montant</th><th>Score</th><th>Statut</th></tr></thead>
            <tbody>
              {providers.length ? providers.map((provider, index) => {
                const amount = Number(provider._sum.montantReclame ?? 0);
                const score = Math.min(100, Math.round((amount / Math.max(montant, 1)) * 100 + provider._count.id / Math.max(prestations, 1) * 100));
                return <tr key={`${provider.codePrestataire}-${index}`} className={index === 0 ? "bg-red-100/80" : index % 2 ? "bg-white" : "bg-sky/10"}>
                  <td className="font-mono text-xs">{provider.codePrestataire ?? "-"}</td>
                  <td className="font-black text-navy">{provider.prestataire ?? "Prestataire non renseigné"}</td>
                  <td>{provider._count.id}</td>
                  <td className={index < 2 ? "font-black text-orange-600" : ""}>{formatMoney(amount)}</td>
                  <td className={score >= 60 ? "font-black text-orange-600" : "font-black"}>{score}/100</td>
                  <td><Status text={score >= 60 ? "Critique" : score >= 35 ? "Élevé" : "Moyen"}/></td>
                </tr>;
              }) : <tr><td className="p-8 text-center text-sm font-semibold text-slate-500" colSpan={6}>Aucun prestataire sur ce périmètre.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-black text-navy">Alertes actives</h2>
        <div className="space-y-2">
          {criticalAlerts.length ? criticalAlerts.map((alert) => <article key={alert.id.toString()} className="flex overflow-hidden rounded-lg border border-[#d9edf7] bg-white shadow-soft">
            <div className={`w-2 ${alert.gravite === "critique" ? "bg-red-500" : "bg-orange-500"}`}/>
            <div className="px-3 py-2">
              <p className={`text-xs font-black ${alert.gravite === "critique" ? "text-red-700" : "text-orange-700"}`}>{alert.gravite === "critique" ? "CRITIQUE" : "ÉLEVÉ"}</p>
              <p className="text-sm font-semibold text-slate-700">{alert.description ?? alert.codeAnomalie}</p>
              <p className="text-xs font-semibold text-slate-500">{alert.prestation?.nomBeneficiaire ?? alert.prestation?.prestataire ?? "Prestation concernée"}</p>
            </div>
          </article>) : <article className="rounded-lg border border-[#d9edf7] bg-white p-6 text-sm font-semibold text-emerald-700 shadow-soft">Aucune alerte critique sur le périmètre.</article>}
        </div>
      </section>
    </div>
  </AppShell>;
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("fr-FR")} F`;
}
