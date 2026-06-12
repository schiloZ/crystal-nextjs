import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BarBox, DonutBox, LineBox } from "@/components/charts";
import { getBiData } from "@/lib/bi-data";
import { getCurrentUser } from "@/lib/current-user";

const tabs = ["Beneficiaires", "Prestataires", "Actes medicaux", "Colleges", "Gestionnaires"];

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("fr-FR")} F`;
}

function formatMoneyShort(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}G F`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M F`;
  return `${Math.round(value).toLocaleString("fr-FR")} F`;
}

function buildDistribution(amounts: number[]) {
  const buckets = [
    { name: "0-10K", min: 0, max: 10_000, value: 0 },
    { name: "10-25K", min: 10_000, max: 25_000, value: 0 },
    { name: "25-50K", min: 25_000, max: 50_000, value: 0 },
    { name: "50-100K", min: 50_000, max: 100_000, value: 0 },
    { name: "100K+", min: 100_000, max: Number.POSITIVE_INFINITY, value: 0 },
  ];
  for (const amount of amounts) {
    const bucket = buckets.find((item) => amount >= item.min && amount < item.max) ?? buckets[buckets.length - 1];
    bucket.value += 1;
  }
  return buckets.map(({ name, value }) => ({ name, value }));
}

function fileQuery(fileId: number | null) {
  return fileId ? `?fichier=${fileId}` : "";
}

function FileSelector({ files, selectedFileId }: { files: Array<{ id: number; label: string }>; selectedFileId: number | null }) {
  return <form className="mb-5 flex flex-wrap items-end gap-3 rounded-lg bg-white px-5 py-4 shadow-soft">
    <label className="min-w-80 flex-1"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Fichier à analyser</span><select className="input" defaultValue={selectedFileId ?? ""} name="fichier"><option value="">Tous les fichiers</option>{files.map((file) => <option key={file.id} value={file.id}>{file.label}</option>)}</select></label>
    <button className="rounded-lg bg-sky px-5 py-3 text-sm font-black text-white">Analyser</button>
  </form>
}

export default async function Page({ searchParams }: { searchParams?: { fichier?: string } }) {
  const data = await getBiData(await getCurrentUser(), Number(searchParams?.fichier) || undefined);
  const query = fileQuery(data.selectedFileId);
  const rows = data.beneficiaries;
  const distribution = buildDistribution(rows.map((row) => row.amount / Math.max(row.count, 1)));
  const monthly = data.monthly.map((month) => ({ name: month.name, value: month.amountM }));
  const familyTotal = data.families.reduce((sum, family) => sum + family.value, 0);
  const familySplit = data.families.length ? data.families.slice(0, 5).map((family) => ({ name: family.name, value: family.value })) : [{ name: "Aucune donnee", value: 1 }];
  const stats = [
    ["Montant moyen", formatMoney(data.amountStats.avg)],
    ["Montant minimum", formatMoney(data.amountStats.min)],
    ["Montant maximum", formatMoney(data.amountStats.max)],
    ["Total consomme", formatMoneyShort(data.totalClaimed)],
    ["Economies", formatMoneyShort(data.savings)],
  ];

  return <AppShell title="Statistiques descriptives — BI-02" subtitle="BI & Analytics / Statistiques">
    <div className="mb-4 flex gap-2 text-sm font-black">
      <Link href={`/bi${query}`} className="rounded-md bg-white px-5 py-3 text-slate-500">Dashboard</Link>
      <Link href={`/bi/statistiques${query}`} className="rounded-md bg-sky px-5 py-3 text-white">Statistiques</Link>
      <Link href={`/bi/graphiques${query}`} className="rounded-md bg-white px-5 py-3 text-slate-500">Graphiques</Link>
      <Link href={`/bi/projections${query}`} className="rounded-md bg-white px-5 py-3 text-slate-500">Projections</Link>
    </div>
    <FileSelector files={data.files} selectedFileId={data.selectedFileId}/>
    <div className="mb-1 grid grid-cols-5 gap-1">
      {tabs.map((tab, index) => <button key={tab} className={`rounded-md px-6 py-4 text-sm font-bold ${index === 0 ? "bg-sky text-white" : "bg-white text-slate-500"}`}>{tab}</button>)}
    </div>

    <div className="grid grid-cols-[1fr_0.95fr_0.95fr] gap-3">
      <section>
        <h2 className="mb-3 text-lg font-black text-navy">Top 10 beneficiaires</h2>
        <div className="overflow-hidden rounded-lg border border-[#d9edf7] bg-white shadow-soft">
          <table className="table">
            <thead><tr><th>Matricule</th><th>Beneficiaire</th><th>Nb actes</th><th>Montant</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((row, index) => <tr key={`${row.matricule}-${row.name}`} className={index % 2 ? "bg-sky/10" : "bg-white"}>
                <td className="font-mono text-xs">{row.matricule}</td>
                <td className="font-black text-navy">{row.name}</td>
                <td>{row.count}</td>
                <td className="font-black text-orange-600">{formatMoney(row.amount)}</td>
              </tr>) : <tr><td colSpan={4} className="py-8 text-center font-semibold text-slate-500">Aucun beneficiaire trouve.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-black text-navy">Distribution montants moyens</h2>
        <div className="card p-3"><BarBox data={distribution}/></div>
        <div className="mt-2 space-y-2">{stats.map(([label, value]) => <div key={label} className="flex justify-between rounded-lg bg-white px-4 py-2 shadow-soft"><span className="font-semibold text-slate-500">{label}</span><b className="text-navy">{value}</b></div>)}</div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-black text-navy">Consommation mensuelle {data.selectedYear}</h2>
        <div className="card p-3"><LineBox data={monthly}/></div>
        <div className="mt-4 grid grid-cols-[1fr_1fr] items-center gap-4">
          <div className="space-y-2 text-sm font-semibold text-slate-600">
            {familySplit.slice(0, 3).map((family) => <div key={family.name}><span className="inline-block h-4 w-4 bg-sky"/> {family.name} {familyTotal ? Math.round((family.value / familyTotal) * 100) : 0}%</div>)}
          </div>
          <div>
            <h3 className="text-center font-black text-navy">Familles</h3>
            <DonutBox data={familySplit} center={String(familyTotal)}/>
          </div>
        </div>
      </section>
    </div>
  </AppShell>
}
