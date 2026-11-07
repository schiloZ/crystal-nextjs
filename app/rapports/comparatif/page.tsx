import { BarChart3, Building2, CalendarRange, FileDown, FileText, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
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
type BranchStats = AnnualStats & {
  branchId: number;
  branchName: string;
};
type ManagerStats = AnnualStats & {
  managerId: number;
  managerName: string;
};
type FileStats = {
  id: number;
  year: number;
  exerciseCode: string;
  month: number;
  branchName: string;
  managerName: string;
  fileName: string;
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

export default async function Page(
  props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  const params = parseParams(searchParams);
  const companies = await prisma.compagnie.findMany({
    where: user.role === "super_admin" ? {} : { id: user.compagnieId },
    orderBy: { nom: "asc" },
  });
  const selectedCompanyId = user.role === "super_admin" ? params.companyId ?? companies[0]?.id : user.compagnieId;
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);

  if (!selectedCompanyId || !selectedCompany) {
    return (
      <AppShell title="Comparatif annuel compagnie" subtitle="Audit / Rapports / Comparatif">
        <section className="card p-12 text-center">
          <h2 className="text-2xl font-black text-navy">Aucune compagnie disponible</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">Créez une compagnie avant de consulter le comparatif annuel.</p>
        </section>
      </AppShell>
    );
  }

  const branches = await prisma.filiale.findMany({
    where: { compagnieId: selectedCompanyId },
    orderBy: { nom: "asc" },
  });
  const managers = await prisma.gestionnaire.findMany({
    where: { compagnieId: selectedCompanyId },
    orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
  });
  const selectedManager = managers.find((manager) => manager.id === params.managerId);
  const requestedBranchA = branches.find((branch) => branch.id === (params.branchAId ?? params.branchId));
  const requestedBranchB = branches.find((branch) => branch.id === params.branchBId);
  const selectedBranchA = requestedBranchA ?? requestedBranchB;
  const selectedBranchB = requestedBranchA && requestedBranchB && requestedBranchB.id !== requestedBranchA.id ? requestedBranchB : undefined;
  const selectedBranchIds = [selectedBranchA?.id, selectedBranchB?.id].filter((id): id is number => Boolean(id));
  const branchWhere = selectedBranchIds.length ? { filialeId: { in: selectedBranchIds } } : {};
  const managerWhere = selectedManager ? { gestionnaireId: selectedManager.id } : {};
  const allCompanyFiles = await prisma.fichierImporte.findMany({
    where: { compagnieId: selectedCompanyId, ...branchWhere, ...managerWhere },
    select: { anneeFichier: true },
    distinct: ["anneeFichier"],
    orderBy: { anneeFichier: "desc" },
  });
  const availableYears = allCompanyFiles.map((file) => file.anneeFichier);
  const firstYear = params.startYear ?? Math.min(...availableYears);
  const lastYear = params.endYear ?? Math.max(...availableYears);
  const yearWhere = Number.isFinite(firstYear) && Number.isFinite(lastYear)
    ? { anneeFichier: { gte: Math.min(firstYear, lastYear), lte: Math.max(firstYear, lastYear) } }
    : {};

  const files = await prisma.fichierImporte.findMany({
    where: { compagnieId: selectedCompanyId, ...branchWhere, ...managerWhere, ...yearWhere },
    include: { gestionnaire: true, filiale: true, exercice: true },
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
  const anomaliesByFile = new Map(anomalyGroups.map((group) => [group.fichierImporteId, {
    count: group._count.id,
    amount: Number(group._sum.montantImpacte ?? 0),
  }]));

  const statsByYear = new Map<number, AnnualStats>();
  const statsByBranchYear = new Map<string, BranchStats>();
  const statsByManagerYear = new Map<string, ManagerStats>();
  const fileRows: FileStats[] = [];
  for (const file of files) {
    const current = statsByYear.get(file.anneeFichier) ?? emptyStats(file.anneeFichier);
    const anomaly = anomaliesByFile.get(file.id);
    current.files += 1;
    current.lines += file.nbLignesTotal;
    current.validLines += file.nbLignesValides;
    current.anomalyLines += file.nbLignesAnomalies;
    current.lateLines += file.nbLignesTardives;
    current.duplicates += file.nbDoublons;
    current.claimedAmount += Number(file.montantTotalReclame);
    current.recommendedAmount += Number(file.montantNetRecommande);
    current.anomalyCount += anomaly?.count ?? 0;
    current.anomalyAmount += anomaly?.amount ?? 0;
    statsByYear.set(file.anneeFichier, current);

    const branchKey = `${file.filialeId}:${file.anneeFichier}`;
    const branchCurrent = statsByBranchYear.get(branchKey) ?? { ...emptyStats(file.anneeFichier), branchId: file.filialeId, branchName: file.filiale.nom };
    branchCurrent.files += 1;
    branchCurrent.lines += file.nbLignesTotal;
    branchCurrent.validLines += file.nbLignesValides;
    branchCurrent.anomalyLines += file.nbLignesAnomalies;
    branchCurrent.lateLines += file.nbLignesTardives;
    branchCurrent.duplicates += file.nbDoublons;
    branchCurrent.claimedAmount += Number(file.montantTotalReclame);
    branchCurrent.recommendedAmount += Number(file.montantNetRecommande);
    branchCurrent.anomalyCount += anomaly?.count ?? 0;
    branchCurrent.anomalyAmount += anomaly?.amount ?? 0;
    statsByBranchYear.set(branchKey, branchCurrent);

    const managerName = fullName(file.gestionnaire.prenoms, file.gestionnaire.nom);
    const managerKey = `${file.gestionnaireId}:${file.anneeFichier}`;
    const managerCurrent = statsByManagerYear.get(managerKey) ?? { ...emptyStats(file.anneeFichier), managerId: file.gestionnaireId, managerName };
    managerCurrent.files += 1;
    managerCurrent.lines += file.nbLignesTotal;
    managerCurrent.validLines += file.nbLignesValides;
    managerCurrent.anomalyLines += file.nbLignesAnomalies;
    managerCurrent.lateLines += file.nbLignesTardives;
    managerCurrent.duplicates += file.nbDoublons;
    managerCurrent.claimedAmount += Number(file.montantTotalReclame);
    managerCurrent.recommendedAmount += Number(file.montantNetRecommande);
    managerCurrent.anomalyCount += anomaly?.count ?? 0;
    managerCurrent.anomalyAmount += anomaly?.amount ?? 0;
    statsByManagerYear.set(managerKey, managerCurrent);

    fileRows.push({
      id: file.id,
      year: file.anneeFichier,
      exerciseCode: file.exercice.codeExercice,
      month: file.moisFichier,
      branchName: file.filiale.nom,
      managerName: fullName(file.gestionnaire.prenoms, file.gestionnaire.nom),
      fileName: file.nomFichier,
      lines: file.nbLignesTotal,
      validLines: file.nbLignesValides,
      anomalyLines: file.nbLignesAnomalies,
      lateLines: file.nbLignesTardives,
      duplicates: file.nbDoublons,
      claimedAmount: Number(file.montantTotalReclame),
      recommendedAmount: Number(file.montantNetRecommande),
      anomalyCount: anomaly?.count ?? 0,
      anomalyAmount: anomaly?.amount ?? 0,
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
  const bestYear = yearlyStats.reduce<AnnualStats | null>((best, row) => !best || anomalyRate(row) < anomalyRate(best) ? row : best, null);
  const riskiestYear = yearlyStats.reduce<AnnualStats | null>((worst, row) => !worst || anomalyRate(row) > anomalyRate(worst) ? row : worst, null);
  const maxClaimed = Math.max(...yearlyStats.map((row) => row.claimedAmount), 1);
  const maxAnomalies = Math.max(...yearlyStats.map((row) => row.anomalyCount), 1);
  const managerRows = topManagers(files);
  const branchRows = topBranches(files);
  const exportQuery = buildExportQuery({
    companyId: selectedCompanyId,
    branchAId: selectedBranchA?.id,
    branchBId: selectedBranchB?.id,
    managerId: selectedManager?.id,
    startYear: params.startYear,
    endYear: params.endYear,
  });
  const comparedBranchYears = selectedBranchA && selectedBranchB
    ? [...new Set(branchYearStats.map((row) => row.year))]
        .sort((left, right) => left - right)
        .map((year) => ({
          year,
          left: branchYearStats.find((row) => row.branchId === selectedBranchA.id && row.year === year),
          right: branchYearStats.find((row) => row.branchId === selectedBranchB.id && row.year === year),
        }))
    : [];

  return (
    <AppShell title="Comparatif annuel par fichier et filiale" subtitle={`Audit / Rapports / Comparatif / ${selectedCompany.nom}`}>
      <section className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-navy px-6 py-4 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <BarChart3 size={20} />
            <div className="min-w-0">
              <h2 className="text-lg font-black">Périmètre de comparaison</h2>
              <p className="text-xs font-semibold text-blue-100">Comparaison annuelle par filiale, avec détail de chaque fichier importé</p>
            </div>
          </div>
          <a className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-4 text-xs font-black text-red-600 shadow-soft hover:bg-red-50" href={`/rapport-comparatif?${exportQuery}`}>
            <FileDown size={16} /> Rapport PDF
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="text-sm font-semibold text-slate-600">
            <b className="text-navy">{selectedBranchA?.nom ?? "Toutes filiales"}</b>
            {selectedBranchB ? <> vs <b className="text-navy">{selectedBranchB.nom}</b></> : null}
            <span> · {params.startYear ?? "Début"} → {params.endYear ?? "Fin"} · {selectedManager ? fullName(selectedManager.prenoms, selectedManager.nom) : "Tous gestionnaires"}</span>
          </div>
          <ModalForm size="lg" title="Périmètre de comparaison" trigger={<button className="btn inline-flex items-center gap-2"><CalendarRange size={17} /> Filtres</button>}>
            <form className="grid gap-4 p-5 md:grid-cols-2" method="get">
              {user.role === "super_admin" && (
                <label>
                  <span className="mb-1 block text-xs font-black uppercase text-slate-500">Compagnie</span>
                  <select className="input" defaultValue={selectedCompanyId} name="compagnie">
                    {companies.map((company) => <option key={company.id} value={company.id}>{company.nom}</option>)}
                  </select>
                </label>
              )}
              <label>
                <span className="mb-1 block text-xs font-black uppercase text-slate-500">Filiale A</span>
                <select className="input" defaultValue={String(selectedBranchA?.id ?? "")} name="filialeA">
                  <option value="">Toutes</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nom}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-black uppercase text-slate-500">Filiale B</span>
                <select className="input" defaultValue={String(selectedBranchB?.id ?? "")} name="filialeB">
                  <option value="">Aucune</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nom}</option>)}
                </select>
              </label>
              <YearSelect label="Année début" name="debut" value={String(params.startYear ?? "")} years={availableYears} />
              <YearSelect label="Année fin" name="fin" value={String(params.endYear ?? "")} years={availableYears} />
              <label>
                <span className="mb-1 block text-xs font-black uppercase text-slate-500">Gestionnaire</span>
                <select className="input" defaultValue={String(selectedManager?.id ?? "")} name="gestionnaire">
                  <option value="">Tous</option>
                  {managers.map((manager) => <option key={manager.id} value={manager.id}>{fullName(manager.prenoms, manager.nom)}</option>)}
                </select>
              </label>
              <div className="flex items-end md:col-span-2">
                <button className="btn inline-flex w-full items-center justify-center gap-2"><CalendarRange size={17} /> Comparer</button>
              </div>
            </form>
          </ModalForm>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={<Building2 size={20} />} label={selectedBranchB ? "Filiales" : selectedBranchA ? "Filiale" : "Compagnie"} value={selectedBranchB ? `${selectedBranchA?.nom} / ${selectedBranchB.nom}` : selectedBranchA?.nom ?? selectedCompany.nom} sub={`${formatNumber(yearlyStats.length)} année(s)`} />
        <Kpi label="Fichiers" value={formatNumber(totals.files)} sub="Imports comparés" />
        <Kpi label="Lignes" value={formatNumber(totals.lines)} sub="Prestations importées" />
        <Kpi label="Montant réclamé" value={formatMoney(totals.claimedAmount)} sub="Toutes années" />
        <Kpi tone="red" label={selectedManager ? "Gestionnaire" : "Anomalies"} value={selectedManager ? fullName(selectedManager.prenoms, selectedManager.nom) : formatNumber(totals.anomalyCount)} sub={selectedManager ? `${formatNumber(totals.anomalyCount)} anomalie(s)` : formatMoney(totals.anomalyAmount)} />
      </section>

      {yearlyStats.length === 0 ? (
        <section className="card p-12 text-center">
          <h2 className="text-2xl font-black text-navy">Aucune donnée sur cette période</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">Importez des fichiers ou ajustez la plage d’années.</p>
        </section>
      ) : (
        <>
          <section className="mb-6 grid gap-6 xl:grid-cols-[1fr_420px]">
            <Panel title="Évolution annuelle">
              <div className="space-y-4">
                {yearlyStats.map((row) => (
                  <div className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-[80px_1fr_120px]" key={row.year}>
                    <div>
                      <p className="text-2xl font-black text-navy">{row.year}</p>
                      <p className="text-xs font-semibold text-slate-500">{formatNumber(row.files)} fichier(s)</p>
                    </div>
                    <div className="space-y-3">
                      <Progress color="#0ea5e9" label="Montant réclamé" max={maxClaimed} value={row.claimedAmount} valueLabel={formatMoney(row.claimedAmount)} />
                      <Progress color="#ef4444" label="Anomalies" max={maxAnomalies} value={row.anomalyCount} valueLabel={formatNumber(row.anomalyCount)} />
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-red-600">{anomalyRate(row).toFixed(1)}%</p>
                      <p className="text-xs font-semibold text-slate-500">Taux anomalie</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <aside className="space-y-6">
              <Panel title="Lecture rapide">
                <div className="space-y-3">
                  <Insight icon={<TrendingDown size={18} />} label="Année la plus saine" value={bestYear ? `${bestYear.year} · ${anomalyRate(bestYear).toFixed(1)}%` : "-"} tone="green" />
                  <Insight icon={<TrendingUp size={18} />} label="Année la plus risquée" value={riskiestYear ? `${riskiestYear.year} · ${anomalyRate(riskiestYear).toFixed(1)}%` : "-"} tone="red" />
                  <Insight label="Écart réclamé / recommandé" value={formatMoney(totals.claimedAmount - totals.recommendedAmount)} tone="orange" />
                </div>
              </Panel>

              <Panel title="Top gestionnaires">
                <MiniTable rows={managerRows} />
              </Panel>
            </aside>
          </section>

          <section className="mb-6 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
            <Panel title="Synthèse annuelle globale">
              <div className="overflow-x-auto">
                <table className="table min-w-[980px]">
                  <thead><tr><th>Année</th><th>Fichiers</th><th>Lignes</th><th>Valides</th><th>Anomalies</th><th>Tardives</th><th>Doublons</th><th>Réclamé</th><th>Recommandé</th><th>Taux</th><th>Évolution</th></tr></thead>
                  <tbody>{yearlyStats.map((row, index) => {
                    const previous = yearlyStats[index - 1];
                    return <tr key={row.year}><td className="font-black text-navy">{row.year}</td><td>{formatNumber(row.files)}</td><td>{formatNumber(row.lines)}</td><td>{formatNumber(row.validLines)}</td><td className="font-black text-red-600">{formatNumber(row.anomalyCount)}</td><td>{formatNumber(row.lateLines)}</td><td>{formatNumber(row.duplicates)}</td><td>{formatMoney(row.claimedAmount)}</td><td>{formatMoney(row.recommendedAmount)}</td><td>{anomalyRate(row).toFixed(1)}%</td><td>{previous ? evolutionLabel(anomalyRate(previous), anomalyRate(row)) : "-"}</td></tr>;
                  })}</tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Top filiales">
              <MiniTable rows={branchRows} />
            </Panel>
          </section>

          {selectedBranchA && selectedBranchB && (
            <section className="mb-6">
              <Panel title={`Comparaison directe : ${selectedBranchA.nom} vs ${selectedBranchB.nom}`}>
                <div className="overflow-x-auto">
                  <table className="table min-w-[1180px]">
                    <thead><tr><th>Année exercice</th><th>{selectedBranchA.nom} fichiers</th><th>{selectedBranchA.nom} lignes</th><th>{selectedBranchA.nom} taux</th><th>{selectedBranchA.nom} réclamé</th><th>{selectedBranchB.nom} fichiers</th><th>{selectedBranchB.nom} lignes</th><th>{selectedBranchB.nom} taux</th><th>{selectedBranchB.nom} réclamé</th><th>Écart taux</th><th>Écart montant</th></tr></thead>
                    <tbody>{comparedBranchYears.map(({ year, left, right }) => <tr key={year}><td className="font-black text-navy">{year}</td><td>{formatNumber(left?.files ?? 0)}</td><td>{formatNumber(left?.lines ?? 0)}</td><td className="font-black text-red-600">{optionalRate(left)}</td><td>{formatMoney(left?.claimedAmount ?? 0)}</td><td>{formatNumber(right?.files ?? 0)}</td><td>{formatNumber(right?.lines ?? 0)}</td><td className="font-black text-red-600">{optionalRate(right)}</td><td>{formatMoney(right?.claimedAmount ?? 0)}</td><td>{rateDiffLabel(left, right)}</td><td>{formatMoney((left?.claimedAmount ?? 0) - (right?.claimedAmount ?? 0))}</td></tr>)}</tbody>
                  </table>
                </div>
              </Panel>
            </section>
          )}

          <section className="mb-6">
            <Panel title="Comparatif annuel par filiale">
              <div className="overflow-x-auto">
                <table className="table min-w-[1080px]">
                  <thead><tr><th>Filiale</th><th>Année exercice</th><th>Fichiers</th><th>Lignes</th><th>Valides</th><th>Lignes anomalie</th><th>Anomalies audit</th><th>Tardives</th><th>Doublons</th><th>Réclamé</th><th>Recommandé</th><th>Taux</th></tr></thead>
                  <tbody>{branchYearStats.map((row) => <tr key={`${row.branchId}-${row.year}`}><td className="font-black text-navy">{row.branchName}</td><td className="font-black text-sky">{row.year}</td><td>{formatNumber(row.files)}</td><td>{formatNumber(row.lines)}</td><td>{formatNumber(row.validLines)}</td><td>{formatNumber(row.anomalyLines)}</td><td className="font-black text-red-600">{formatNumber(row.anomalyCount)}</td><td>{formatNumber(row.lateLines)}</td><td>{formatNumber(row.duplicates)}</td><td>{formatMoney(row.claimedAmount)}</td><td>{formatMoney(row.recommendedAmount)}</td><td>{anomalyRate(row).toFixed(1)}%</td></tr>)}</tbody>
                </table>
              </div>
            </Panel>
          </section>

          <section className="mb-6">
            <Panel title="Comparatif annuel par gestionnaire">
              <div className="overflow-x-auto">
                <table className="table min-w-[1080px]">
                  <thead><tr><th>Gestionnaire</th><th>Année exercice</th><th>Fichiers</th><th>Lignes</th><th>Valides</th><th>Lignes anomalie</th><th>Anomalies audit</th><th>Tardives</th><th>Doublons</th><th>Réclamé</th><th>Recommandé</th><th>Taux</th></tr></thead>
                  <tbody>{managerYearStats.map((row) => <tr key={`${row.managerId}-${row.year}`}><td className="font-black text-navy">{row.managerName}</td><td className="font-black text-sky">{row.year}</td><td>{formatNumber(row.files)}</td><td>{formatNumber(row.lines)}</td><td>{formatNumber(row.validLines)}</td><td>{formatNumber(row.anomalyLines)}</td><td className="font-black text-red-600">{formatNumber(row.anomalyCount)}</td><td>{formatNumber(row.lateLines)}</td><td>{formatNumber(row.duplicates)}</td><td>{formatMoney(row.claimedAmount)}</td><td>{formatMoney(row.recommendedAmount)}</td><td>{anomalyRate(row).toFixed(1)}%</td></tr>)}</tbody>
                </table>
              </div>
            </Panel>
          </section>

          <section>
            <Panel title="Détail des fichiers par filiale et par année">
              <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-500">
                <FileText size={17} />
                <span>{formatNumber(fileRows.length)} fichier(s) dans le périmètre sélectionné</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table min-w-[1180px]">
                  <thead><tr><th>Filiale</th><th>Exercice</th><th>Année fichier</th><th>Mois</th><th>Fichier</th><th>Gestionnaire</th><th>Lignes</th><th>Valides</th><th>Lignes anomalie</th><th>Anomalies audit</th><th>Tardives</th><th>Doublons</th><th>Réclamé</th><th>Recommandé</th><th>Taux</th></tr></thead>
                  <tbody>{fileRows.map((row) => <tr key={row.id}><td className="font-black text-navy">{row.branchName}</td><td className="font-black text-sky">{row.exerciseCode}</td><td>{row.year}</td><td>{monthLabel(row.month)}</td><td>{row.fileName}</td><td>{row.managerName}</td><td>{formatNumber(row.lines)}</td><td>{formatNumber(row.validLines)}</td><td>{formatNumber(row.anomalyLines)}</td><td className="font-black text-red-600">{formatNumber(row.anomalyCount)}</td><td>{formatNumber(row.lateLines)}</td><td>{formatNumber(row.duplicates)}</td><td>{formatMoney(row.claimedAmount)}</td><td>{formatMoney(row.recommendedAmount)}</td><td>{fileAnomalyRate(row).toFixed(1)}%</td></tr>)}</tbody>
                </table>
              </div>
            </Panel>
          </section>
        </>
      )}
    </AppShell>
  );
}

function emptyStats(year: number): AnnualStats {
  return { year, files: 0, lines: 0, validLines: 0, anomalyLines: 0, lateLines: 0, duplicates: 0, claimedAmount: 0, recommendedAmount: 0, anomalyCount: 0, anomalyAmount: 0 };
}

function YearSelect({ label, name, value, years }: { label: string; name: string; value: string; years: number[] }) {
  return <label><span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span><select className="input" defaultValue={value} name={name}><option value="">Toutes</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card overflow-hidden"><div className="border-b border-line px-5 py-4"><h2 className="text-lg font-black text-navy">{title}</h2></div><div className="p-5">{children}</div></section>;
}

function Kpi({ label, value, sub, tone = "sky", icon }: { label: string; value: string; sub: string; tone?: "sky" | "red"; icon?: React.ReactNode }) {
  const colors = tone === "red" ? "border-red-500 text-red-600" : "border-sky text-sky";
  return <article className={`rounded-lg border-l-4 bg-white p-5 shadow-soft ${colors}`}><div className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">{icon}{label}</div><p className="mt-2 truncate text-2xl font-black">{value}</p><p className="text-xs font-semibold text-slate-500">{sub}</p></article>;
}

function Progress({ label, value, max, valueLabel, color }: { label: string; value: number; max: number; valueLabel: string; color: string }) {
  const width = max ? Math.max(2, (value / max) * 100) : 0;
  return <div><div className="mb-1 flex justify-between text-xs font-black text-slate-500"><span>{label}</span><span>{valueLabel}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} /></div></div>;
}

function Insight({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone: "green" | "red" | "orange" }) {
  const colors = { green: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700", orange: "bg-orange-50 text-orange-700" };
  return <div className={`rounded-lg p-4 ${colors[tone]}`}><div className="flex items-center gap-2 text-xs font-black uppercase">{icon}{label}</div><p className="mt-2 text-xl font-black">{value}</p></div>;
}

function MiniTable({ rows }: { rows: Array<{ label: string; files: number; amount: number }> }) {
  return rows.length ? <table className="table"><thead><tr><th>Libellé</th><th>Fichiers</th><th>Montant</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><td className="font-black text-navy">{row.label}</td><td>{formatNumber(row.files)}</td><td>{formatMoney(row.amount)}</td></tr>)}</tbody></table> : <p className="py-8 text-center text-sm font-semibold text-slate-500">Aucune donnée.</p>;
}

function topManagers(files: Array<{ gestionnaire: { nom: string; prenoms: string | null }; montantTotalReclame: unknown }>) {
  return topByLabel(files, (file) => fullName(file.gestionnaire.prenoms, file.gestionnaire.nom));
}

function topBranches(files: Array<{ filiale: { nom: string }; montantTotalReclame: unknown }>) {
  return topByLabel(files, (file) => file.filiale.nom);
}

function topByLabel<T extends { montantTotalReclame: unknown }>(files: T[], labelFor: (file: T) => string) {
  const grouped = new Map<string, { label: string; files: number; amount: number }>();
  for (const file of files) {
    const label = labelFor(file);
    const row = grouped.get(label) ?? { label, files: 0, amount: 0 };
    row.files += 1;
    row.amount += Number(file.montantTotalReclame);
    grouped.set(label, row);
  }
  return [...grouped.values()].sort((left, right) => right.amount - left.amount).slice(0, 8);
}

function parseParams(searchParams?: Record<string, string | string[] | undefined>) {
  return {
    companyId: numberParam(searchParams?.compagnie),
    branchId: numberParam(searchParams?.filiale),
    branchAId: numberParam(searchParams?.filialeA),
    branchBId: numberParam(searchParams?.filialeB),
    managerId: numberParam(searchParams?.gestionnaire),
    startYear: numberParam(searchParams?.debut),
    endYear: numberParam(searchParams?.fin),
  };
}

function buildExportQuery(params: { companyId?: number; branchAId?: number; branchBId?: number; managerId?: number; startYear?: number; endYear?: number }) {
  const query = new URLSearchParams();
  if (params.companyId) query.set("compagnie", String(params.companyId));
  if (params.branchAId) query.set("filialeA", String(params.branchAId));
  if (params.branchBId) query.set("filialeB", String(params.branchBId));
  if (params.managerId) query.set("gestionnaire", String(params.managerId));
  if (params.startYear) query.set("debut", String(params.startYear));
  if (params.endYear) query.set("fin", String(params.endYear));
  return query.toString();
}

function numberParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const number = Number(raw);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function anomalyRate(row: AnnualStats) {
  return row.lines ? (row.anomalyCount / row.lines) * 100 : 0;
}

function optionalRate(row?: AnnualStats) {
  return row ? `${anomalyRate(row).toFixed(1)}%` : "-";
}

function rateDiffLabel(left?: AnnualStats, right?: AnnualStats) {
  if (!left || !right) return "-";
  const diff = anomalyRate(left) - anomalyRate(right);
  if (Math.abs(diff) < 0.05) return "Stable";
  return `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pts`;
}

function fileAnomalyRate(row: FileStats) {
  return row.lines ? (row.anomalyCount / row.lines) * 100 : 0;
}

function monthLabel(month: number) {
  return String(month).padStart(2, "0");
}

function evolutionLabel(previous: number, current: number) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return "Stable";
  return `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pts`;
}

function fullName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
