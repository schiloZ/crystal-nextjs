import { PrintReportButton } from "@/components/print-report-button";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

type AnnualStats = {
  year: number;
  files: number;
  lines: number;
  validLines: number;
  anomalyLines: number;
  lateLines: number;
  duplicates: number;
  claimedAmount: number;
  recommendedAmount: number;
  anomalyCount: number;
  anomalyAmount: number;
};
type BranchStats = AnnualStats & { branchId: number; branchName: string };
type ManagerStats = AnnualStats & { managerId: number; managerName: string };
type FileRow = {
  id: number;
  branch: string;
  exercise: string;
  year: number;
  month: number;
  file: string;
  manager: string;
  lines: number;
  validLines: number;
  anomalyLines: number;
  lateLines: number;
  duplicates: number;
  claimedAmount: number;
  recommendedAmount: number;
  anomalyCount: number;
};

export default async function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const user = await getCurrentUser();
  const params = parseParams(searchParams);
  const companies = await prisma.compagnie.findMany({
    where: user.role === "super_admin" ? {} : { id: user.compagnieId },
    orderBy: { nom: "asc" },
  });
  const companyId = user.role === "super_admin" ? params.companyId ?? companies[0]?.id : user.compagnieId;
  const company = companies.find((item) => item.id === companyId);

  if (!companyId || !company) {
    return <main className="mx-auto max-w-5xl p-8"><section className="card p-12 text-center"><h1 className="text-2xl font-black text-navy">Aucune compagnie disponible</h1></section></main>;
  }

  const branches = await prisma.filiale.findMany({ where: { compagnieId: companyId }, orderBy: { nom: "asc" } });
  const managers = await prisma.gestionnaire.findMany({ where: { compagnieId: companyId }, orderBy: [{ nom: "asc" }, { prenoms: "asc" }] });
  const manager = managers.find((item) => item.id === params.managerId);
  const requestedBranchA = branches.find((branch) => branch.id === (params.branchAId ?? params.branchId));
  const requestedBranchB = branches.find((branch) => branch.id === params.branchBId);
  const branchA = requestedBranchA ?? requestedBranchB;
  const branchB = requestedBranchA && requestedBranchB && requestedBranchB.id !== requestedBranchA.id ? requestedBranchB : undefined;
  const branchIds = [branchA?.id, branchB?.id].filter((id): id is number => Boolean(id));
  const branchWhere = branchIds.length ? { filialeId: { in: branchIds } } : {};
  const managerWhere = manager ? { gestionnaireId: manager.id } : {};
  const yearWhere = yearFilter(params.startYear, params.endYear);

  const files = await prisma.fichierImporte.findMany({
    where: { compagnieId: companyId, ...branchWhere, ...managerWhere, ...yearWhere },
    include: { filiale: true, gestionnaire: true, exercice: true },
    orderBy: [{ filiale: { nom: "asc" } }, { anneeFichier: "asc" }, { moisFichier: "asc" }, { nomFichier: "asc" }],
  });
  const fileIds = files.map((file) => file.id);
  const anomalyGroups = fileIds.length
    ? await prisma.anomalie.groupBy({
        by: ["fichierImporteId"],
        where: { fichierImporteId: { in: fileIds }, codeAnomalie: { not: "DOUBLON_STRICT" } },
        _count: { id: true },
        _sum: { montantImpacte: true },
      })
    : [];
  const anomaliesByFile = new Map(anomalyGroups.map((group) => [group.fichierImporteId, { count: group._count.id, amount: Number(group._sum.montantImpacte ?? 0) }]));

  const statsByYear = new Map<number, AnnualStats>();
  const statsByBranchYear = new Map<string, BranchStats>();
  const statsByManagerYear = new Map<string, ManagerStats>();
  const fileRows: FileRow[] = [];
  for (const file of files) {
    const anomaly = anomaliesByFile.get(file.id);
    const yearly = statsByYear.get(file.anneeFichier) ?? emptyStats(file.anneeFichier);
    addFile(yearly, file, anomaly);
    statsByYear.set(file.anneeFichier, yearly);

    const branchKey = `${file.filialeId}:${file.anneeFichier}`;
    const branchYear = statsByBranchYear.get(branchKey) ?? { ...emptyStats(file.anneeFichier), branchId: file.filialeId, branchName: file.filiale.nom };
    addFile(branchYear, file, anomaly);
    statsByBranchYear.set(branchKey, branchYear);

    const managerName = fullName(file.gestionnaire.prenoms, file.gestionnaire.nom);
    const managerKey = `${file.gestionnaireId}:${file.anneeFichier}`;
    const managerYear = statsByManagerYear.get(managerKey) ?? { ...emptyStats(file.anneeFichier), managerId: file.gestionnaireId, managerName };
    addFile(managerYear, file, anomaly);
    statsByManagerYear.set(managerKey, managerYear);

    fileRows.push({
      id: file.id,
      branch: file.filiale.nom,
      exercise: file.exercice.codeExercice,
      year: file.anneeFichier,
      month: file.moisFichier,
      file: file.nomFichier,
      manager: fullName(file.gestionnaire.prenoms, file.gestionnaire.nom),
      lines: file.nbLignesTotal,
      validLines: file.nbLignesValides,
      anomalyLines: file.nbLignesAnomalies,
      lateLines: file.nbLignesTardives,
      duplicates: file.nbDoublons,
      claimedAmount: Number(file.montantTotalReclame),
      recommendedAmount: Number(file.montantNetRecommande),
      anomalyCount: anomaly?.count ?? 0,
    });
  }

  const yearlyStats = [...statsByYear.values()].sort((left, right) => left.year - right.year);
  const branchYearStats = [...statsByBranchYear.values()].sort((left, right) => left.branchName.localeCompare(right.branchName) || left.year - right.year);
  const managerYearStats = [...statsByManagerYear.values()].sort((left, right) => left.managerName.localeCompare(right.managerName) || left.year - right.year);
  const totals = yearlyStats.reduce((acc, row) => ({
    files: acc.files + row.files,
    lines: acc.lines + row.lines,
    claimedAmount: acc.claimedAmount + row.claimedAmount,
    recommendedAmount: acc.recommendedAmount + row.recommendedAmount,
    anomalyCount: acc.anomalyCount + row.anomalyCount,
    anomalyAmount: acc.anomalyAmount + row.anomalyAmount,
  }), { files: 0, lines: 0, claimedAmount: 0, recommendedAmount: 0, anomalyCount: 0, anomalyAmount: 0 });
  const years = [...new Set(branchYearStats.map((row) => row.year))].sort((left, right) => left - right);
  const comparedRows = branchA && branchB ? years.map((year) => ({
    year,
    left: branchYearStats.find((row) => row.branchId === branchA.id && row.year === year),
    right: branchYearStats.find((row) => row.branchId === branchB.id && row.year === year),
  })) : [];
  const maxAmount = Math.max(...yearlyStats.map((row) => row.claimedAmount), 1);
  const maxAnomaly = Math.max(...yearlyStats.map((row) => row.anomalyCount), 1);
  const reference = `CMP-${companyId}-${params.startYear ?? "ALL"}-${params.endYear ?? "ALL"}-${branchA?.id ?? "ALL"}-${branchB?.id ?? "X"}-${manager?.id ?? "GM"}`;

  return (
    <main className="min-h-screen bg-[#eef8fc] px-5 py-6 text-navy print:bg-white print:px-0 print:py-0">
      <style>{`@page{size:A4 landscape;margin:10mm}.report-page{break-after:page}.report-page:last-child{break-after:auto}@media print{.shadow-soft,.card{box-shadow:none!important}body{background:white!important}.table th,.table td{font-size:10px!important;padding:6px!important}}`}</style>
      <div className="mx-auto mb-5 flex max-w-[1180px] flex-wrap items-center justify-between gap-3 print:hidden">
        <a className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white" href={`/rapports/comparatif?${buildBackQuery(params, companyId, branchA?.id, branchB?.id, manager?.id)}`}>Retour comparatif</a>
        <PrintReportButton />
      </div>

      <article className="mx-auto max-w-[1180px] space-y-5 print:max-w-none print:space-y-0">
        <ReportPage title="Rapport comparatif filiales" subtitle={`${company.nom} · ${scopeLabel(branchA?.nom, branchB?.nom)}${manager ? ` · ${fullName(manager.prenoms, manager.nom)}` : ""}`}>
          <Header company={company.nom} manager={manager ? fullName(manager.prenoms, manager.nom) : undefined} reference={reference} startYear={params.startYear} endYear={params.endYear} scope={scopeLabel(branchA?.nom, branchB?.nom)} />
          <div className="grid grid-cols-5 gap-3">
            <Kpi label="Fichiers" value={formatNumber(totals.files)} tone="sky" />
            <Kpi label="Lignes" value={formatNumber(totals.lines)} tone="navy" />
            <Kpi label="Montant réclamé" value={formatMoney(totals.claimedAmount)} tone="orange" />
            <Kpi label="Anomalies" value={formatNumber(totals.anomalyCount)} tone="red" />
            <Kpi label="Taux global" value={`${rate(totals.anomalyCount, totals.lines).toFixed(1)}%`} tone="emerald" />
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <Panel title="Évolution des montants">
              <div className="space-y-3">{yearlyStats.map((row) => <Bar key={row.year} label={String(row.year)} value={row.claimedAmount} max={maxAmount} valueLabel={formatMoney(row.claimedAmount)} color="#0ea5e9" />)}</div>
            </Panel>
            <Panel title="Évolution des anomalies">
              <div className="space-y-3">{yearlyStats.map((row) => <Bar key={row.year} label={String(row.year)} value={row.anomalyCount} max={maxAnomaly} valueLabel={formatNumber(row.anomalyCount)} color="#ef4444" />)}</div>
            </Panel>
          </div>
          <Panel className="mt-5" title="Synthèse annuelle globale">
            <SimpleTable headers={["Année", "Fichiers", "Lignes", "Valides", "Anomalies", "Tardives", "Doublons", "Réclamé", "Recommandé", "Taux"]} rows={yearlyStats.map((row) => [row.year, formatNumber(row.files), formatNumber(row.lines), formatNumber(row.validLines), formatNumber(row.anomalyCount), formatNumber(row.lateLines), formatNumber(row.duplicates), formatMoney(row.claimedAmount), formatMoney(row.recommendedAmount), `${anomalyRate(row).toFixed(1)}%`])} />
          </Panel>
        </ReportPage>

        {branchA && branchB && (
          <ReportPage title="Comparaison directe entre filiales" subtitle={`${branchA.nom} contre ${branchB.nom}`}>
            <SimpleTable headers={["Année", `${branchA.nom} lignes`, `${branchA.nom} taux`, `${branchA.nom} réclamé`, `${branchB.nom} lignes`, `${branchB.nom} taux`, `${branchB.nom} réclamé`, "Écart taux", "Écart montant"]} rows={comparedRows.map(({ year, left, right }) => [year, formatNumber(left?.lines ?? 0), optionalRate(left), formatMoney(left?.claimedAmount ?? 0), formatNumber(right?.lines ?? 0), optionalRate(right), formatMoney(right?.claimedAmount ?? 0), rateDiffLabel(left, right), formatMoney((left?.claimedAmount ?? 0) - (right?.claimedAmount ?? 0))])} />
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Panel title={branchA.nom}>
                <div className="space-y-3">{comparedRows.map(({ year, left }) => <Bar key={year} label={String(year)} value={left?.claimedAmount ?? 0} max={maxAmount} valueLabel={formatMoney(left?.claimedAmount ?? 0)} color="#22c55e" />)}</div>
              </Panel>
              <Panel title={branchB.nom}>
                <div className="space-y-3">{comparedRows.map(({ year, right }) => <Bar key={year} label={String(year)} value={right?.claimedAmount ?? 0} max={maxAmount} valueLabel={formatMoney(right?.claimedAmount ?? 0)} color="#f97316" />)}</div>
              </Panel>
            </div>
          </ReportPage>
        )}

        <ReportPage title="Comparatif annuel par filiale" subtitle="Synthèse par filiale et par année d'exercice">
          <DetailedTable headers={["Filiale", "Année", "Fichiers", "Lignes", "Valides", "Lignes anomalie", "Anomalies audit", "Tardives", "Doublons", "Réclamé", "Recommandé", "Taux"]} rows={branchYearStats.map((row) => [row.branchName, row.year, formatNumber(row.files), formatNumber(row.lines), formatNumber(row.validLines), formatNumber(row.anomalyLines), formatNumber(row.anomalyCount), formatNumber(row.lateLines), formatNumber(row.duplicates), formatMoney(row.claimedAmount), formatMoney(row.recommendedAmount), `${anomalyRate(row).toFixed(1)}%`])} />
        </ReportPage>

        <ReportPage title="Comparatif annuel par gestionnaire" subtitle={manager ? `Synthèse filtrée sur ${fullName(manager.prenoms, manager.nom)}` : "Synthèse par gestionnaire et par année d'exercice"}>
          <DetailedTable headers={["Gestionnaire", "Année", "Fichiers", "Lignes", "Valides", "Lignes anomalie", "Anomalies audit", "Tardives", "Doublons", "Réclamé", "Recommandé", "Taux"]} rows={managerYearStats.map((row) => [row.managerName, row.year, formatNumber(row.files), formatNumber(row.lines), formatNumber(row.validLines), formatNumber(row.anomalyLines), formatNumber(row.anomalyCount), formatNumber(row.lateLines), formatNumber(row.duplicates), formatMoney(row.claimedAmount), formatMoney(row.recommendedAmount), `${anomalyRate(row).toFixed(1)}%`])} />
        </ReportPage>

        <ReportPage title="Détail des fichiers" subtitle="Lecture fichier par fichier, filiale par filiale">
          <DetailedTable headers={["Filiale", "Exercice", "Période", "Fichier", "Gestionnaire", "Lignes", "Valides", "Lignes anomalie", "Anomalies audit", "Tardives", "Doublons", "Réclamé", "Recommandé", "Taux"]} rows={fileRows.slice(0, 120).map((row) => [row.branch, row.exercise, `${monthLabel(row.month)}/${row.year}`, row.file, row.manager, formatNumber(row.lines), formatNumber(row.validLines), formatNumber(row.anomalyLines), formatNumber(row.anomalyCount), formatNumber(row.lateLines), formatNumber(row.duplicates), formatMoney(row.claimedAmount), formatMoney(row.recommendedAmount), `${rate(row.anomalyCount, row.lines).toFixed(1)}%`])} />
          {fileRows.length > 120 && <p className="mt-4 text-sm font-semibold text-slate-500">{formatNumber(fileRows.length - 120)} fichier(s) supplémentaires non affichés dans cette édition PDF.</p>}
        </ReportPage>
      </article>
    </main>
  );
}

function Header({ company, scope, manager, reference, startYear, endYear }: { company: string; scope: string; manager?: string; reference: string; startYear?: number; endYear?: number }) {
  return <div className="mb-5 rounded-lg bg-navy p-5 text-white"><h1 className="text-3xl font-black">RAPPORT COMPARATIF CRYSTAL</h1><p className="mt-2 text-base font-semibold text-blue-100">{company} · {scope}{manager ? ` · Gestionnaire : ${manager}` : ""}</p><p className="mt-1 text-xs font-semibold text-blue-200">Référence : {reference} · Période : {startYear ?? "début"} à {endYear ?? "fin"} · Généré le {formatDate(new Date())}</p></div>;
}
function ReportPage({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="report-page card mb-5 min-h-[760px] p-6 print:mb-0 print:min-h-0 print:rounded-none print:border-0"><div className="mb-5 border-b border-line pb-3"><h2 className="text-2xl font-black text-navy">{title}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p></div>{children}</section>; }
function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) { return <section className={`rounded-lg border border-line bg-white p-4 ${className}`}><h3 className="mb-3 text-lg font-black text-navy">{title}</h3>{children}</section>; }
function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) { const colors: Record<string, string> = { sky: "border-sky text-sky", red: "border-red-500 text-red-600", navy: "border-navy text-navy", orange: "border-orange-500 text-orange-600", emerald: "border-emerald-600 text-emerald-700" }; return <div className={`rounded-lg border-l-4 bg-white p-4 shadow-soft ${colors[tone]}`}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function Bar({ label, value, max, valueLabel, color }: { label: string; value: number; max: number; valueLabel: string; color: string }) { return <div><div className="mb-1 flex justify-between text-xs font-black text-slate-600"><span>{label}</span><span>{valueLabel}</span></div><div className="h-3 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full" style={{ width: `${Math.max(4, (value / max) * 100)}%`, backgroundColor: color }} /></div></div>; }
function SimpleTable({ headers, rows }: { headers: string[]; rows: Array<Array<React.ReactNode>> }) { return <table className="table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td className="text-center text-slate-500" colSpan={headers.length}>Aucune donnée.</td></tr>}</tbody></table>; }
function DetailedTable(props: { headers: string[]; rows: Array<Array<React.ReactNode>> }) { return <div className="overflow-hidden rounded-lg border border-line bg-white"><SimpleTable {...props} /></div>; }
function addFile(target: AnnualStats, file: { nbLignesTotal: number; nbLignesValides: number; nbLignesAnomalies: number; nbLignesTardives: number; nbDoublons: number; montantTotalReclame: unknown; montantNetRecommande: unknown }, anomaly?: { count: number; amount: number }) { target.files += 1; target.lines += file.nbLignesTotal; target.validLines += file.nbLignesValides; target.anomalyLines += file.nbLignesAnomalies; target.lateLines += file.nbLignesTardives; target.duplicates += file.nbDoublons; target.claimedAmount += Number(file.montantTotalReclame); target.recommendedAmount += Number(file.montantNetRecommande); target.anomalyCount += anomaly?.count ?? 0; target.anomalyAmount += anomaly?.amount ?? 0; }
function emptyStats(year: number): AnnualStats { return { year, files: 0, lines: 0, validLines: 0, anomalyLines: 0, lateLines: 0, duplicates: 0, claimedAmount: 0, recommendedAmount: 0, anomalyCount: 0, anomalyAmount: 0 }; }
function parseParams(searchParams?: Record<string, string | string[] | undefined>) { return { companyId: numberParam(searchParams?.compagnie), branchId: numberParam(searchParams?.filiale), branchAId: numberParam(searchParams?.filialeA), branchBId: numberParam(searchParams?.filialeB), managerId: numberParam(searchParams?.gestionnaire), startYear: numberParam(searchParams?.debut), endYear: numberParam(searchParams?.fin) }; }
function yearFilter(startYear?: number, endYear?: number) { return startYear && endYear ? { anneeFichier: { gte: Math.min(startYear, endYear), lte: Math.max(startYear, endYear) } } : startYear ? { anneeFichier: { gte: startYear } } : endYear ? { anneeFichier: { lte: endYear } } : {}; }
function buildBackQuery(params: ReturnType<typeof parseParams>, companyId: number, branchAId?: number, branchBId?: number, managerId?: number) { const query = new URLSearchParams(); query.set("compagnie", String(companyId)); if (branchAId) query.set("filialeA", String(branchAId)); if (branchBId) query.set("filialeB", String(branchBId)); if (managerId) query.set("gestionnaire", String(managerId)); if (params.startYear) query.set("debut", String(params.startYear)); if (params.endYear) query.set("fin", String(params.endYear)); return query.toString(); }
function numberParam(value: string | string[] | undefined) { const raw = Array.isArray(value) ? value[0] : value; const number = Number(raw); return Number.isInteger(number) && number > 0 ? number : undefined; }
function anomalyRate(row: AnnualStats) { return rate(row.anomalyCount, row.lines); }
function optionalRate(row?: AnnualStats) { return row ? `${anomalyRate(row).toFixed(1)}%` : "-"; }
function rateDiffLabel(left?: AnnualStats, right?: AnnualStats) { if (!left || !right) return "-"; const diff = anomalyRate(left) - anomalyRate(right); if (Math.abs(diff) < 0.05) return "Stable"; return `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pts`; }
function rate(count: number, total: number) { return total ? (count / total) * 100 : 0; }
function scopeLabel(branchA?: string, branchB?: string) { return branchB ? `${branchA} vs ${branchB}` : branchA ?? "Toutes les filiales"; }
function fullName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
function monthLabel(month: number) { return String(month).padStart(2, "0"); }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
