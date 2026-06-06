import Link from "next/link";
import { AppShell } from "@/components/app-shell";

const kpis = [
  { icon: "PF", value: "3.12G F", label: "Projection fin année", sub: "FCFA estimé", color: "#d97706" },
  { icon: "EA", value: "2.88G F", label: "Budget annuel", sub: "Enveloppe annuelle", color: "#10285a" },
  { icon: "DP", value: "+8.3%", label: "Dépassement prévu", sub: "si rythme actuel", color: "#dc2626" },
  { icon: "MC", value: "Septembre", label: "Mois critique prévu", sub: "Dépassement", color: "#d97706" },
];

const recommendations = [
  ["URGENT", "Negocier revision budgetaire +8.3% avec direction technique", "bg-red-600"],
  ["ATTENTION", "Renforcer controles sur MEDIASSUR (+12% sur 5 mois consecutifs)", "bg-orange-600"],
  ["INFO", "Septembre et octobre sont des pics de consommation historiques", "bg-sky"],
  ["POSITIF", "Taux fraude en baisse continue : de 11.2% a 8.7% en 5 mois", "bg-emerald-600"],
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

function ProjectionChart() {
  const real: Array<[number, number, string]> = [
    [30, 92, "248"], [150, 70, "265"], [270, 87, "252"], [390, 58, "271"], [510, 91, "248"],
  ];
  const proj: Array<[number, number, string]> = [
    [610, 55, "~280"], [735, 48, "~290"], [855, 50, "~285"], [975, 43, "~295"], [1095, 36, "~305"], [1215, 41, "~298"], [1335, 29, "~310"],
  ];
  return <section className="card p-4">
    <h2 className="font-black text-navy">Projection consommation annuelle 2026 — NSIA CI (M FCFA)</h2>
    <div className="mt-2 flex gap-8 text-sm font-semibold">
      <span><i className="inline-block h-4 w-5 bg-sky"/> Donnees reelles</span>
      <span><i className="inline-block h-4 w-5 bg-orange-600"/> Projection</span>
    </div>
    <svg viewBox="0 0 1380 240" className="mt-2 h-64 w-full rounded bg-white">
      <rect x="590" y="0" width="765" height="220" fill="#fff6ec"/>
      <line x1="20" y1="80" x2="1350" y2="80" stroke="#ef4444" strokeDasharray="8 8" strokeWidth="3"/>
      <text x="1280" y="70" fill="#dc2626" fontSize="13" fontWeight="900">Budget 240M</text>
      <polyline points={real.map(([x,y]) => `${x},${y}`).join(" ")} fill="none" stroke="#21b5f5" strokeWidth="4"/>
      <polyline points={proj.map(([x,y]) => `${x},${y}`).join(" ")} fill="none" stroke="#ea580c" strokeWidth="4" strokeDasharray="8 8"/>
      {real.map(([x,y,label]) => <g key={`r-${x}`}><circle cx={x} cy={y} r="6" fill="#21b5f5"/><text x={x - 14} y={y - 14} fill="#0284c7" fontSize="13" fontWeight="900">{label}</text></g>)}
      {proj.map(([x,y,label]) => <g key={`p-${x}`}><circle cx={x} cy={y} r="6" fill="#ea580c"/><text x={x - 18} y={y - 14} fill="#ea580c" fontSize="13" fontWeight="900">{label}</text></g>)}
      {["Jan","Fev","Mar","Avr","Mai","Juin","Juil","Aou","Sep","Oct","Nov","Dec"].map((m, i) => <text key={m} x={30 + i * 119} y="232" fill="#64748b" fontSize="12">{m}</text>)}
    </svg>
  </section>
}

export default function Page() {
  return <AppShell title="Projections et Previsions — BI-05" subtitle="BI & Analytics / Projections">
    <div className="mb-4 flex gap-2 text-sm font-black">
      <Link href="/bi" className="rounded-md bg-white px-5 py-3 text-slate-500">Dashboard</Link>
      <Link href="/bi/statistiques" className="rounded-md bg-white px-5 py-3 text-slate-500">Statistiques</Link>
      <Link href="/bi/graphiques" className="rounded-md bg-white px-5 py-3 text-slate-500">Graphiques</Link>
      <Link href="/bi/projections" className="rounded-md bg-sky px-5 py-3 text-white">Projections</Link>
    </div>

    <section className="mb-5 rounded-lg border-l-8 border-orange-500 bg-yellow-100 px-5 py-4">
      <h2 className="text-xl font-black text-orange-600">ALERTE DEPASSEMENT PREVISIONNEL — NSIA CI</h2>
      <p className="mt-1 text-sm font-semibold text-slate-700">Sur trajectoire actuelle l'enveloppe annuelle sera depassee de 8.3% avant fin septembre 2026.</p>
    </section>

    <div className="mb-5 grid grid-cols-4 gap-4">
      {kpis.map((item) => <KpiCard key={item.icon} item={item}/>)}
    </div>

    <ProjectionChart/>

    <section className="mt-2">
      <h2 className="mb-3 text-lg font-black text-navy">Recommandations previsionnelles</h2>
      <div className="space-y-2">
        {recommendations.map(([level, text, color]) => <article key={level} className="flex overflow-hidden rounded-lg border border-[#d9edf7] bg-white shadow-soft">
          <div className={`w-2 ${color}`}/>
          <div className="flex items-center gap-3 px-4 py-2">
            <span className={`rounded px-4 py-1 text-xs font-black text-white ${color}`}>{level}</span>
            <span className="font-semibold text-slate-700">{text}</span>
          </div>
        </article>)}
      </div>
    </section>
  </AppShell>
}
