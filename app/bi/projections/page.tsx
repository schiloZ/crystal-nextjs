import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getBiData } from "@/lib/bi-data";
import { getCurrentUser } from "@/lib/current-user";

type Kpi = { icon: string; value: string; label: string; sub: string; color: string };
type ProjectionPoint = { name: string; value: number; projected: boolean };

function formatMoneyShort(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}G F`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M F`;
  return `${Math.round(value).toLocaleString("fr-FR")} F`;
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

function ProjectionChart({ year, points, annualBudget }: { year: number; points: ProjectionPoint[]; annualBudget: number }) {
  const monthlyBudgetM = annualBudget / 12 / 1_000_000;
  const maxValue = Math.max(monthlyBudgetM, ...points.map((point) => point.value), 1);
  const xFor = (index: number) => 30 + index * 119;
  const yFor = (value: number) => 205 - (value / maxValue) * 165;
  const real = points.map((point, index) => ({ ...point, index })).filter((point) => !point.projected);
  const projected = points.map((point, index) => ({ ...point, index })).filter((point) => point.projected);
  const realPolyline = real.map((point) => `${xFor(point.index)},${yFor(point.value)}`).join(" ");
  const projectedSeed = real.length ? real[real.length - 1] : null;
  const projectedPolyline = [
    ...(projectedSeed ? [`${xFor(projectedSeed.index)},${yFor(projectedSeed.value)}`] : []),
    ...projected.map((point) => `${xFor(point.index)},${yFor(point.value)}`),
  ].join(" ");
  const budgetY = yFor(monthlyBudgetM);

  return <section className="card p-4">
    <h2 className="font-black text-navy">Projection consommation annuelle {year} (M FCFA)</h2>
    <div className="mt-2 flex gap-8 text-sm font-semibold">
      <span><i className="inline-block h-4 w-5 bg-sky"/> Donnees reelles</span>
      <span><i className="inline-block h-4 w-5 bg-orange-600"/> Projection</span>
    </div>
    <svg viewBox="0 0 1380 250" className="mt-2 h-64 w-full rounded bg-white">
      <rect x={projected.length ? xFor(projected[0].index) - 20 : 1360} y="0" width="765" height="222" fill="#fff6ec"/>
      <line x1="20" y1={budgetY} x2="1350" y2={budgetY} stroke="#ef4444" strokeDasharray="8 8" strokeWidth="3"/>
      <text x="1210" y={Math.max(18, budgetY - 10)} fill="#dc2626" fontSize="13" fontWeight="900">Budget mensuel {Math.round(monthlyBudgetM)}M</text>
      {realPolyline ? <polyline points={realPolyline} fill="none" stroke="#21b5f5" strokeWidth="4"/> : null}
      {projectedPolyline ? <polyline points={projectedPolyline} fill="none" stroke="#ea580c" strokeWidth="4" strokeDasharray="8 8"/> : null}
      {real.map((point) => <g key={`r-${point.name}`}><circle cx={xFor(point.index)} cy={yFor(point.value)} r="6" fill="#21b5f5"/><text x={xFor(point.index) - 14} y={yFor(point.value) - 14} fill="#0284c7" fontSize="13" fontWeight="900">{Math.round(point.value)}</text></g>)}
      {projected.map((point) => <g key={`p-${point.name}`}><circle cx={xFor(point.index)} cy={yFor(point.value)} r="6" fill="#ea580c"/><text x={xFor(point.index) - 18} y={yFor(point.value) - 14} fill="#ea580c" fontSize="13" fontWeight="900">~{Math.round(point.value)}</text></g>)}
      {points.map((point, index) => <text key={point.name} x={xFor(index)} y="238" fill="#64748b" fontSize="12">{point.name}</text>)}
    </svg>
  </section>
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
  const user = await getCurrentUser();
  const data = await getBiData(user, Number(searchParams?.fichier) || undefined);
  const query = fileQuery(data.selectedFileId);
  const realMonths = data.monthly.filter((month) => month.amount > 0);
  const lastRealMonth = realMonths.at(-1)?.month ?? 0;
  const monthlyAverage = realMonths.length ? realMonths.reduce((sum, month) => sum + month.amount, 0) / realMonths.length : 0;
  const projectedAnnual = monthlyAverage * 12;
  const annualBudget = data.yearRecommended > 0 ? data.yearRecommended : Math.max(data.yearClaimed * 0.92, projectedAnnual * 0.92);
  const gapPercent = annualBudget ? ((projectedAnnual - annualBudget) / annualBudget) * 100 : 0;
  let cumulative = 0;
  let criticalMonth = "Non prevu";
  const points = data.monthly.map((month) => {
    const projected = month.month > lastRealMonth;
    const amount = projected ? monthlyAverage : month.amount;
    cumulative += amount;
    if (criticalMonth === "Non prevu" && annualBudget > 0 && cumulative > annualBudget) criticalMonth = month.name;
    return { name: month.name, value: Math.round(amount / 1_000_000), projected };
  });
  const trendLabel = gapPercent > 0 ? `+${gapPercent.toFixed(1)}%` : `${gapPercent.toFixed(1)}%`;
  const trendColor = gapPercent > 0 ? "#dc2626" : "#059669";
  const kpis: Kpi[] = [
    { icon: "PF", value: formatMoneyShort(projectedAnnual), label: "Projection fin annee", sub: "FCFA estime", color: "#d97706" },
    { icon: "EA", value: formatMoneyShort(annualBudget), label: "Budget annuel", sub: "Base recommandee", color: "#10285a" },
    { icon: "DP", value: trendLabel, label: gapPercent > 0 ? "Depassement prevu" : "Marge prevue", sub: "si rythme actuel", color: trendColor },
    { icon: "MC", value: criticalMonth, label: "Mois critique prevu", sub: "Depassement", color: "#d97706" },
  ];
  const topManager = data.managers[0];
  const recommendations = [
    [gapPercent > 0 ? "URGENT" : "INFO", gapPercent > 0 ? `Prevoir une revision budgetaire de ${trendLabel} pour ${data.selectedYear}` : `La trajectoire reste sous le budget de ${Math.abs(gapPercent).toFixed(1)}%`, gapPercent > 0 ? "bg-red-600" : "bg-sky"],
    ["ATTENTION", topManager ? `Surveiller ${topManager.name}, premier gestionnaire en consommation` : "Importer des fichiers pour identifier les gestionnaires sensibles", "bg-orange-600"],
    ["INFO", `${realMonths.length} mois reel(s) utilise(s) pour calculer la projection`, "bg-sky"],
    ["POSITIF", `Taux anomalies actuel: ${data.yearAnomalyRate.toFixed(1)}% sur l'exercice`, "bg-emerald-600"],
  ] as const;

  return <AppShell title="Projections et Previsions — BI-05" subtitle="BI & Analytics / Projections">
    <div className="mb-4 flex gap-2 text-sm font-black">
      <Link href={`/bi${query}`} className="rounded-md bg-white px-5 py-3 text-slate-500">Dashboard</Link>
      <Link href={`/bi/statistiques${query}`} className="rounded-md bg-white px-5 py-3 text-slate-500">Statistiques</Link>
      <Link href={`/bi/graphiques${query}`} className="rounded-md bg-white px-5 py-3 text-slate-500">Graphiques</Link>
      <Link href={`/bi/projections${query}`} className="rounded-md bg-sky px-5 py-3 text-white">Projections</Link>
    </div>
    <FileSelector files={data.files} selectedFileId={data.selectedFileId}/>

    <section className="mb-5 rounded-lg border-l-8 border-orange-500 bg-yellow-100 px-5 py-4">
      <h2 className="text-xl font-black text-orange-600">{gapPercent > 0 ? "ALERTE DEPASSEMENT PREVISIONNEL" : "SUIVI PREVISIONNEL MAITRISE"} — {data.companyLabel}</h2>
      <p className="mt-1 text-sm font-semibold text-slate-700">Sur trajectoire actuelle, l'exercice {data.selectedYear} est estime a {formatMoneyShort(projectedAnnual)} pour un budget de {formatMoneyShort(annualBudget)}.</p>
    </section>

    <div className="mb-5 grid grid-cols-4 gap-4">
      {kpis.map((item) => <KpiCard key={item.icon} item={item}/>)}
    </div>

    <ProjectionChart year={data.selectedYear} points={points} annualBudget={annualBudget}/>

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
