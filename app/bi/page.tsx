import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DonutBox, LineBox, BarBox } from "@/components/charts";
import { getBiData } from "@/lib/bi-data";
import { getCurrentUser } from "@/lib/current-user";

type Kpi = { icon: string; value: string; label: string; sub: string; color: string };

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR");
}

function formatMoneyShort(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}G F`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M F`;
  return `${Math.round(value).toLocaleString("fr-FR")} F`;
}

function shortName(value: string) {
  return value.length > 10 ? `${value.slice(0, 9)}.` : value;
}

function KpiCard({ item }: { item: Kpi }) {
  return <article className="relative overflow-hidden rounded-lg border border-[#d9edf7] bg-white p-5 shadow-soft">
    <div className="mb-4 grid h-14 w-14 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: item.color }}>{item.icon}</div>
    <h3 className="text-4xl font-black leading-none text-navy">{item.value}</h3>
    <p className="mt-3 text-sm font-black text-navy">{item.label}</p>
    <p className="text-xs font-semibold text-slate-500">{item.sub}</p>
    <div className="absolute bottom-0 left-4 right-4 h-1" style={{ backgroundColor: item.color }}/>
  </article>
}

function BiTabs({ fileId }: { fileId: number | null }) {
  const query = fileId ? `?fichier=${fileId}` : "";
  return <div className="mb-4 flex gap-2 text-sm font-black">
    <Link href={`/bi${query}`} className="rounded-md bg-sky px-5 py-3 text-white">Dashboard</Link>
    <Link href={`/bi/statistiques${query}`} className="rounded-md bg-white px-5 py-3 text-slate-500">Statistiques</Link>
    <Link href={`/bi/graphiques${query}`} className="rounded-md bg-white px-5 py-3 text-slate-500">Graphiques</Link>
    <Link href={`/bi/projections${query}`} className="rounded-md bg-white px-5 py-3 text-slate-500">Projections</Link>
  </div>
}

function FileSelector({ files, selectedFileId }: { files: Array<{ id: number; label: string }>; selectedFileId: number | null }) {
  return <form className="mb-5 flex flex-wrap items-end gap-3 rounded-lg bg-white px-5 py-4 shadow-soft">
    <label className="min-w-80 flex-1"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Fichier à analyser</span><select className="input" defaultValue={selectedFileId ?? ""} name="fichier"><option value="">Tous les fichiers</option>{files.map((file) => <option key={file.id} value={file.id}>{file.label}</option>)}</select></label>
    <button className="rounded-lg bg-sky px-5 py-3 text-sm font-black text-white">Analyser</button>
  </form>
}

export default async function Page({ searchParams }: { searchParams?: { fichier?: string } }) {
  const user = await getCurrentUser();
  const data = await getBiData(user, Number(searchParams?.fichier) || undefined);
  const filters = [
    ["Annee:", String(data.selectedYear)],
    ["Compagnie:", data.companyLabel],
    ["Filiale:", user.filialeNom ?? "Toutes"],
    ["Gestionnaire:", "Tous"],
    ["Fichier:", data.selectedFileLabel],
    ["Vue:", "Mensuelle"],
  ];
  const kpis: Kpi[] = [
    { icon: "FA", value: formatNumber(data.fileCount), label: "Fichiers analyses", sub: `${data.yearFileCount} fichier(s) en ${data.selectedYear}`, color: "#38bdf8" },
    { icon: "TL", value: formatNumber(data.totalLines), label: "Total lignes", sub: "Toutes periodes", color: "#10285a" },
    { icon: "MC", value: formatMoneyShort(data.totalClaimed), label: "Montant controle", sub: "FCFA consolides", color: "#059669" },
    { icon: "EC", value: formatMoneyShort(data.savings), label: "Total economies", sub: "FCFA economises", color: "#d97706" },
    { icon: "TF", value: `${data.anomalyRate.toFixed(1)}%`, label: "Taux anomalies moy.", sub: `${formatNumber(data.anomalyCount)} anomalie(s)`, color: "#dc2626" },
  ];
  const monthlyAmounts = data.monthly.map((month) => ({ name: month.name, value: month.amountM }));
  const gestionnaires = data.managers.slice(0, 5).map((manager) => ({ name: shortName(manager.name), value: Math.round(manager.amount / 1_000_000) }));
  const families = data.families.length ? data.families.slice(0, 5).map((family) => ({ name: shortName(family.name), value: family.value })) : [{ name: "Aucune donnee", value: 1 }];
  const maxSavings = Math.max(...data.managers.map((manager) => manager.amount - manager.recommended), 1);
  const savings = data.managers.slice(0, 5).map((manager) => {
    const amount = Math.max(manager.amount - manager.recommended, 0);
    return { name: manager.name, amount, width: Math.max(8, Math.round((amount / maxSavings) * 100)) };
  });
  const anomalyTrend = data.monthly.map((month) => ({ name: month.name, value: month.anomalyRate }));

  return <AppShell title="Business Intelligence — Dashboard" subtitle="BI & Analytics / Dashboard executif">
    <BiTabs fileId={data.selectedFileId}/>
    <FileSelector files={data.files} selectedFileId={data.selectedFileId}/>
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
        <LineBox data={monthlyAmounts}/>
      </section>
      <section className="card p-3">
        <h2 className="font-black text-navy">Consommation par gestionnaire (M FCFA)</h2>
        <BarBox data={gestionnaires}/>
      </section>
      <section className="card p-3">
        <h2 className="text-center font-black text-navy">Repartition familles</h2>
        <DonutBox data={families} center={formatNumber(data.families.reduce((sum, family) => sum + family.value, 0))}/>
      </section>
    </div>

    <div className="mt-2 grid grid-cols-[0.9fr_1.45fr] gap-4">
      <section>
        <h2 className="mb-3 text-lg font-black text-navy">Top economies par gestionnaire</h2>
        <div className="space-y-2">
          {savings.length ? savings.map((item) => <div key={item.name} className="rounded-lg bg-white px-4 py-2 shadow-soft">
            <div className="flex items-center justify-between">
              <b className="text-navy">{item.name}</b>
              <b className="text-emerald-700">{formatMoneyShort(item.amount)}</b>
            </div>
            <div className="mt-1 h-2 rounded-full bg-blue-100">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${item.width}%` }}/>
            </div>
          </div>) : <div className="rounded-lg bg-white px-4 py-5 text-sm font-semibold text-slate-500 shadow-soft">Aucune economie calculee pour cette periode.</div>}
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
