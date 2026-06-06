import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BarBox, DonutBox, LineBox } from "@/components/charts";

const tabs = ["Beneficiaires", "Prestataires", "Actes medicaux", "Colleges", "Gestionnaires"];
const rows = [
  ["NSIA-004521", "KOUASSI P. ANGE", "48", "487 500 F"],
  ["NSIA-007834", "BAMBA KOFI J.", "42", "398 250 F"],
  ["NSIA-003217", "YAOUA NINA M.", "38", "325 000 F"],
  ["NSIA-009456", "TRAORE SEYDOU", "35", "298 750 F"],
  ["NSIA-002198", "DIALLO AMINATA", "32", "275 500 F"],
  ["NSIA-011234", "COULIBALY MARC", "29", "245 000 F"],
  ["NSIA-005671", "OUATTARA IB.", "27", "220 000 F"],
  ["NSIA-008923", "ASSI PIERRE", "25", "198 000 F"],
  ["NSIA-015678", "N'DRI CHARLES", "23", "160 500 F"],
  ["NSIA-019234", "GBESSI H.", "21", "175 250 F"],
];
const distribution = [
  { name: "0-10K", value: 3450 },
  { name: "10-25K", value: 4120 },
  { name: "25-50K", value: 2890 },
  { name: "50-100K", value: 1234 },
  { name: "100K+", value: 456 },
];
const monthly = [
  { name: "Jan", value: 180 },
  { name: "Fev", value: 220 },
  { name: "Mar", value: 20 },
  { name: "Avr", value: 20 },
  { name: "Mai", value: 182 },
  { name: "Juin", value: 20 },
  { name: "Juil", value: 20 },
  { name: "Aout", value: 20 },
  { name: "Sep", value: 20 },
  { name: "Oct", value: 20 },
  { name: "Nov", value: 20 },
  { name: "Dec", value: 20 },
];
const stats = [["Montant moyen", "19 920 F"], ["Mediane", "18 500 F"], ["Ecart-type", "12 340 F"], ["Min", "500 F"], ["Max", "450 000 F"]];

export default function Page() {
  return <AppShell title="Statistiques descriptives — BI-02" subtitle="BI & Analytics / Statistiques">
    <div className="mb-4 flex gap-2 text-sm font-black">
      <Link href="/bi" className="rounded-md bg-white px-5 py-3 text-slate-500">Dashboard</Link>
      <Link href="/bi/statistiques" className="rounded-md bg-sky px-5 py-3 text-white">Statistiques</Link>
      <Link href="/bi/graphiques" className="rounded-md bg-white px-5 py-3 text-slate-500">Graphiques</Link>
      <Link href="/bi/projections" className="rounded-md bg-white px-5 py-3 text-slate-500">Projections</Link>
    </div>
    <div className="mb-1 grid grid-cols-5 gap-1">
      {tabs.map((tab, index) => <button key={tab} className={`rounded-md px-6 py-4 text-sm font-bold ${index === 0 ? "bg-sky text-white" : "bg-white text-slate-500"}`}>{tab}</button>)}
    </div>

    <div className="grid grid-cols-[1fr_0.95fr_0.95fr] gap-3">
      <section>
        <h2 className="mb-3 text-lg font-black text-navy">Top 10 beneficiaires</h2>
        <div className="overflow-hidden rounded-lg border border-[#d9edf7] bg-white shadow-soft">
          <table className="table">
            <thead><tr><th>Matricule</th><th>Beneficiaire</th><th>Nb actes</th><th>Montant</th></tr></thead>
            <tbody>{rows.map((row, index) => <tr key={row[0]} className={index % 2 ? "bg-sky/10" : "bg-white"}><td className="font-mono text-xs">{row[0]}</td><td className="font-black text-navy">{row[1]}</td><td>{row[2]}</td><td className="font-black text-orange-600">{row[3]}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-black text-navy">Distribution montants</h2>
        <div className="card p-3"><BarBox data={distribution}/></div>
        <div className="mt-2 space-y-2">{stats.map(([label, value]) => <div key={label} className="flex justify-between rounded-lg bg-white px-4 py-2 shadow-soft"><span className="font-semibold text-slate-500">{label}</span><b className="text-navy">{value}</b></div>)}</div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-black text-navy">Consommation mensuelle 2026</h2>
        <div className="card p-3"><LineBox data={monthly}/></div>
        <div className="mt-4 grid grid-cols-[1fr_1fr] items-center gap-4">
          <div className="space-y-2 text-sm font-semibold text-slate-600">
            <div><span className="inline-block h-4 w-4 bg-pink-400"/> Femmes 46%</div>
            <div><span className="inline-block h-4 w-4 bg-sky"/> Hommes 54%</div>
          </div>
          <div>
            <h3 className="text-center font-black text-navy">H/F</h3>
            <DonutBox data={[{name:"Hommes",value:54},{name:"Femmes",value:46}]} center="100"/>
          </div>
        </div>
      </section>
    </div>
  </AppShell>
}
