import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BarBox, LineBox } from "@/components/charts";
import { getBiData } from "@/lib/bi-data";
import { getCurrentUser } from "@/lib/current-user";

const shades = ["#d8edf8", "#b9d8ea", "#8aabc6", "#527394", "#263f68", "#0b234f"];

function shortName(value: string) {
  return value.length > 10 ? `${value.slice(0, 9)}.` : value;
}

function Heatmap({ rows, intensity }: { rows: string[]; intensity: number[] }) {
  const safeRows = rows.length ? rows : ["Aucune donnee"];
  const max = Math.max(...intensity, 1);
  return <div className="mt-6 space-y-3">
    {safeRows.map((row, rowIndex) => <div key={row} className="flex items-center gap-2">
      <span className="w-24 truncate text-xs font-semibold text-slate-500">{row}</span>
      <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: "repeat(31, minmax(0, 1fr))" }}>
        {Array.from({ length: 31 }).map((_, dayIndex) => {
          const monthValue = intensity[dayIndex % intensity.length] ?? 0;
          const shadeIndex = Math.min(shades.length - 1, Math.floor(((monthValue / max) * 4) + ((rowIndex + dayIndex) % 2)));
          return <span key={dayIndex} className="h-7 rounded-sm" style={{ backgroundColor: shades[shadeIndex] }}/>;
        })}
      </div>
    </div>)}
    <div className="ml-28 grid grid-cols-6 text-xs font-semibold text-slate-500"><span>1</span><span>6</span><span>11</span><span>16</span><span>21</span><span>31</span></div>
  </div>
}

export default async function Page() {
  const data = await getBiData(await getCurrentUser());
  const monthlyAmounts = data.monthly.map((month) => ({ name: month.name, value: month.amountM }));
  const categories = data.categories.length ? data.categories.slice(0, 6).map((category) => ({ name: category.name, value: category.value })) : [{ name: "Aucune", value: 0 }];
  const monthlyRates = data.monthly.map((month) => ({ name: month.name, value: month.anomalyRate }));
  const heatRows = data.managers.slice(0, 4).map((manager) => shortName(manager.name));
  const heatIntensity = data.monthly.map((month) => month.amountM + month.anomalyRate);

  return <AppShell title="Graphiques et Visualisations — BI-03" subtitle="BI & Analytics / Graphiques / Comparaisons">
    <div className="mb-4 flex gap-2 text-sm font-black">
      <Link href="/bi" className="rounded-md bg-white px-5 py-3 text-slate-500">Dashboard</Link>
      <Link href="/bi/statistiques" className="rounded-md bg-white px-5 py-3 text-slate-500">Statistiques</Link>
      <Link href="/bi/graphiques" className="rounded-md bg-sky px-5 py-3 text-white">Graphiques</Link>
      <Link href="/bi/projections" className="rounded-md bg-white px-5 py-3 text-slate-500">Projections</Link>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <section className="card p-4">
        <h2 className="font-black text-navy">Evolution montants {data.selectedYear} (M FCFA)</h2>
        <div className="mt-2 flex gap-8 text-sm font-semibold text-slate-600"><span><i className="inline-block h-4 w-4 bg-sky"/> Montant reclame</span></div>
        <LineBox data={monthlyAmounts}/>
      </section>
      <section className="card p-4">
        <h2 className="font-black text-navy">Heatmap consommation — Intensite mensuelle</h2>
        <Heatmap rows={heatRows} intensity={heatIntensity}/>
      </section>
      <section className="card p-4">
        <h2 className="font-black text-navy">Comparaison anomalies par categorie</h2>
        <BarBox data={categories}/>
      </section>
      <section className="card p-4">
        <h2 className="font-black text-navy">Taux anomalies mensuels {data.selectedYear} (%)</h2>
        <BarBox data={monthlyRates}/>
      </section>
    </div>
  </AppShell>
}
