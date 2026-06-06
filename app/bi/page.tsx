import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DonutBox, LineBox, BarBox } from "@/components/charts";
import { chartData } from "@/lib/mock-data";

const filters = [
  ["Annee:", "2026"],
  ["Compagnie:", "NSIA Assurances"],
  ["Filiale:", "Toutes"],
  ["Gestionnaire:", "Tous"],
  ["Vue:", "Mensuelle"],
];

const kpis = [
  { icon: "FA", value: "24", label: "Fichiers analyses", sub: "Ce trimestre", color: "#38bdf8" },
  { icon: "TL", value: "298K", label: "Total lignes", sub: "Toutes comp.", color: "#10285a" },
  { icon: "MC", value: "5.8G", label: "Montant controle", sub: "FCFA YTD", color: "#059669" },
  { icon: "EC", value: "487M", label: "Total economies", sub: "FCFA economises", color: "#d97706" },
  { icon: "TF", value: "9.2%", label: "Taux fraude moy.", sub: "Sur l'ensemble", color: "#dc2626" },
];

const gestionnaires = [
  { name: "MEDIA.", value: 248 },
  { name: "EURAFRIC", value: 185 },
  { name: "SOGEHAN", value: 142 },
  { name: "MUTAM", value: 98 },
  { name: "GMS", value: 76 },
];
const families = [
  { name: "Consult.", value: 35 },
  { name: "Pharmacie", value: 28 },
  { name: "Hospit.", value: 18 },
  { name: "Biologie", value: 12 },
  { name: "Autres", value: 7 },
];
const savings = [
  ["MEDIASSUR SARL", "8.7M F", 94],
  ["EURAFRIC GESTION", "6.4M F", 78],
  ["SOGEHAN", "4.2M F", 74],
  ["MUTAM ASSUR", "2.8M F", 62],
  ["GMS", "1.9M F", 56],
] as const;
const anomalyTrend = [
  { name: "Jan", value: 9.2 },
  { name: "Fev", value: 8.9 },
  { name: "Mar", value: 7.8 },
  { name: "Avr", value: 8.4 },
  { name: "Mai", value: 8.1 },
  { name: "Juin", value: 7.5 },
  { name: "Juil", value: 7.3 },
  { name: "Aout", value: 7.4 },
  { name: "Sep", value: 7.1 },
  { name: "Oct", value: 7.6 },
  { name: "Nov", value: 7.2 },
  { name: "Dec", value: 7.5 },
];

function KpiCard({ item }: { item: typeof kpis[number] }) {
  return <article className="relative overflow-hidden rounded-lg border border-[#d9edf7] bg-white p-5 shadow-soft">
    <div className="mb-4 grid h-14 w-14 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: item.color }}>{item.icon}</div>
    <h3 className="text-4xl font-black leading-none text-navy">{item.value}</h3>
    <p className="mt-3 text-sm font-black text-navy">{item.label}</p>
    <p className="text-xs font-semibold text-slate-500">{item.sub}</p>
    <div className="absolute bottom-0 left-4 right-4 h-1" style={{ backgroundColor: item.color }}/>
  </article>
}

function BiTabs() {
  return <div className="mb-4 flex gap-2 text-sm font-black">
    <Link href="/bi" className="rounded-md bg-sky px-5 py-3 text-white">Dashboard</Link>
    <Link href="/bi/statistiques" className="rounded-md bg-white px-5 py-3 text-slate-500">Statistiques</Link>
    <Link href="/bi/graphiques" className="rounded-md bg-white px-5 py-3 text-slate-500">Graphiques</Link>
    <Link href="/bi/projections" className="rounded-md bg-white px-5 py-3 text-slate-500">Projections</Link>
  </div>
}

export default function Page() {
  return <AppShell title="Business Intelligence — Dashboard" subtitle="BI & Analytics / Dashboard executif">
    <BiTabs/>
    <section className="mb-5 flex flex-wrap items-center gap-8 rounded-lg bg-white px-5 py-4 shadow-soft">
      {filters.map(([label, value]) => <div key={label} className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-500">{label}</span>
        <span className="rounded bg-sky/10 px-4 py-2 text-sm font-black text-navy">{value}</span>
      </div>)}
    </section>

    <div className="mb-3 grid grid-cols-5 gap-4">
      {kpis.map((item) => <KpiCard key={item.icon} item={item}/>)}
    </div>

    <div className="grid grid-cols-[1.1fr_0.9fr_0.85fr] gap-2">
      <section className="card p-3">
        <h2 className="font-black text-navy">Evolution mensuelle — Montant reclame (M FCFA)</h2>
        <LineBox data={chartData}/>
      </section>
      <section className="card p-3">
        <h2 className="font-black text-navy">Consommation par gestionnaire (M FCFA)</h2>
        <BarBox data={gestionnaires}/>
      </section>
      <section className="card p-3">
        <h2 className="text-center font-black text-navy">Repartition familles</h2>
        <DonutBox data={families} center="100"/>
      </section>
    </div>

    <div className="mt-2 grid grid-cols-[0.9fr_1.45fr] gap-4">
      <section>
        <h2 className="mb-3 text-lg font-black text-navy">Top economies par gestionnaire</h2>
        <div className="space-y-2">
          {savings.map(([name, amount, width]) => <div key={name} className="rounded-lg bg-white px-4 py-2 shadow-soft">
            <div className="flex items-center justify-between">
              <b className="text-navy">{name}</b>
              <b className="text-emerald-700">{amount}</b>
            </div>
            <div className="mt-1 h-2 rounded-full bg-blue-100">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${width}%` }}/>
            </div>
          </div>)}
        </div>
      </section>
      <section className="card p-3">
        <h2 className="font-black text-navy">Evolution taux anomalies mensuel (%)</h2>
        <div className="rounded bg-red-50">
          <LineBox data={anomalyTrend}/>
        </div>
      </section>
    </div>
  </AppShell>
}
