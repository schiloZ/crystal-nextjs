import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BarBox, LineBox } from "@/components/charts";

const mediassur = [{name:"Jan",value:210},{name:"Fev",value:245},{name:"Mar",value:225},{name:"Avr",value:290},{name:"Mai",value:322},{name:"Juin",value:305},{name:"Juil",value:360},{name:"Aout",value:345},{name:"Sep",value:405},{name:"Oct",value:390},{name:"Nov",value:430},{name:"Dec",value:465}];
const categories = [{name:"Tardifs",value:198},{name:"Doublons",value:87},{name:"Benef.",value:57},{name:"Prest.",value:28},{name:"Montants",value:121},{name:"Actes",value:18}];
const monthlyRates = [{name:"Jan",value:9.2},{name:"Fev",value:8.8},{name:"Mar",value:10.1},{name:"Avr",value:9.5},{name:"Mai",value:8.7},{name:"Juin",value:0}];
const heatRows = ["MUTAM", "SOGEHAN", "EURAFRIC", "MEDIASSU"];
const shades = ["#d8edf8", "#b9d8ea", "#8aabc6", "#527394", "#263f68", "#0b234f"];

function Heatmap() {
  return <div className="mt-64 space-y-3">
    {heatRows.map((row, r) => <div key={row} className="flex items-center gap-2">
      <span className="w-20 text-xs font-semibold text-slate-500">{row}</span>
      <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: "repeat(31, minmax(0, 1fr))" }}>
        {Array.from({ length: 31 }).map((_, i) => <span key={i} className="h-7" style={{ backgroundColor: shades[(i * 7 + r * 3) % shades.length] }}/>)}
      </div>
    </div>)}
    <div className="ml-24 grid grid-cols-6 text-xs font-semibold text-slate-500"><span>1</span><span>6</span><span>11</span><span>16</span><span>21</span><span>31</span></div>
  </div>
}

export default function Page() {
  return <AppShell title="Graphiques et Visualisations — BI-03" subtitle="BI & Analytics / Graphiques / Comparaisons">
    <div className="mb-4 flex gap-2 text-sm font-black">
      <Link href="/bi" className="rounded-md bg-white px-5 py-3 text-slate-500">Dashboard</Link>
      <Link href="/bi/statistiques" className="rounded-md bg-white px-5 py-3 text-slate-500">Statistiques</Link>
      <Link href="/bi/graphiques" className="rounded-md bg-sky px-5 py-3 text-white">Graphiques</Link>
      <Link href="/bi/projections" className="rounded-md bg-white px-5 py-3 text-slate-500">Projections</Link>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <section className="card p-4">
        <h2 className="font-black text-navy">Evolution montants 2026 (M FCFA) — Comparaison gestionnaires</h2>
        <div className="mt-2 flex gap-8 text-sm font-semibold text-slate-600"><span><i className="inline-block h-4 w-4 bg-sky"/> MEDIASSUR</span><span><i className="inline-block h-4 w-4 bg-indigo-400"/> EURAFRIC</span></div>
        <LineBox data={mediassur}/>
      </section>
      <section className="card p-4">
        <h2 className="font-black text-navy">Heatmap consommation — Jours du mois (janvier 2026)</h2>
        <Heatmap/>
      </section>
      <section className="card p-4">
        <h2 className="font-black text-navy">Comparaison anomalies par categorie</h2>
        <BarBox data={categories}/>
      </section>
      <section className="card p-4">
        <h2 className="font-black text-navy">Taux anomalies mensuels 2026 (%)</h2>
        <BarBox data={monthlyRates}/>
      </section>
    </div>
  </AppShell>
}
