import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const pageSize = 5;
const modes = ["prestataires", "beneficiaires", "benford", "clustering"] as const;
type Mode = (typeof modes)[number];
type Entity = { key: string; name: string; lines: number; amount: number; anomalies: number; critical: number; weighted: number; impact: number; score: number; level: string };
const severityWeight: Record<string, number> = { critique: 4, eleve: 3, moyen: 2, faible: 1 };
const benfordExpected = [30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6];

export default async function Page(
  props: { searchParams?: Promise<{ fichier?: string; page?: string; vue?: string }> }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  const scope = user.role === "super_admin" ? {} : { compagnieId: user.compagnieId };
  const files = await prisma.fichierImporte.findMany({
    where: scope,
    include: { compagnie: true, filiale: true, gestionnaire: true },
    orderBy: { dateImport: "desc" },
    take: 30,
  });
  const file = files.find((item) => item.id === Number(searchParams?.fichier)) ?? files[0] ?? null;

  if (!file) {
    return <AppShell title="Scores de risque — R11" subtitle="Audit / Analyse / Scores">
      <section className="card p-12 text-center"><h2 className="text-2xl font-black text-navy">Aucun audit disponible</h2><p className="mt-2 text-sm font-semibold text-slate-500">Importez et analysez un fichier pour calculer les scores de risque.</p><a className="btn mt-6 inline-block" href="/import">Importer un fichier</a></section>
    </AppShell>;
  }

  const mode = modes.includes(searchParams?.vue as Mode) ? searchParams?.vue as Mode : "prestataires";
  const [prestations, anomalies] = await Promise.all([
    prisma.prestation.findMany({
      where: { fichierImporteId: file.id },
      select: { id: true, codePrestataire: true, prestataire: true, matriculeBeneficiaire: true, nomBeneficiaire: true, prenomsBeneficiaire: true, montantReclame: true, montantPaye: true },
    }),
    prisma.anomalie.findMany({
      where: { fichierImporteId: file.id },
      select: { prestationId: true, gravite: true, montantImpacte: true },
    }),
  ]);
  const anomalyByPrestation = new Map<string, { count: number; critical: number; weighted: number; impact: number }>();
  for (const anomaly of anomalies) {
    if (!anomaly.prestationId) continue;
    const key = anomaly.prestationId.toString();
    const current = anomalyByPrestation.get(key) ?? { count: 0, critical: 0, weighted: 0, impact: 0 };
    current.count += 1;
    current.critical += anomaly.gravite === "critique" ? 1 : 0;
    current.weighted += severityWeight[anomaly.gravite] ?? 1;
    current.impact += Number(anomaly.montantImpacte);
    anomalyByPrestation.set(key, current);
  }
  const providers = buildEntities(prestations, anomalyByPrestation, "prestataire");
  const beneficiaries = buildEntities(prestations, anomalyByPrestation, "beneficiaire");
  const activeEntities = mode === "beneficiaires" ? beneficiaries : providers;
  const requestedPage = Math.max(1, Number(searchParams?.page) || 1);
  const totalPages = Math.max(1, Math.ceil(activeEntities.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const rows = activeEntities.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const benford = calculateBenford(prestations.map((item) => Number(item.montantPaye || item.montantReclame)));
  const clusters = [
    { label: "Critique", min: 75, color: "#dc2626" },
    { label: "Élevé", min: 50, color: "#d97706" },
    { label: "Moyen", min: 25, color: "#7c3aed" },
    { label: "Faible", min: 0, color: "#059669" },
  ].map((cluster) => ({ ...cluster, entities: providers.filter((item) => item.score >= cluster.min && (cluster.min === 75 || item.score < cluster.min + 25)) }));
  const riskEntities = providers.filter((item) => item.score >= 50).length;
  const criticalEntities = providers.filter((item) => item.score >= 75).length;
  const averageScore = providers.length ? providers.reduce((sum, item) => sum + item.score, 0) / providers.length : 0;
  const totalImpact = anomalies.reduce((sum, item) => sum + Number(item.montantImpacte), 0);
  const maxDeviation = Math.max(...benford.map((item) => Math.abs(item.deviation)), 0);
  const metrics = [
    { code: "PR", value: formatNumber(providers.length), label: "Prestataires évalués", sub: `${formatNumber(riskEntities)} à risque élevé`, color: "#0284c7" },
    { code: "CR", value: formatNumber(criticalEntities), label: "Risques critiques", sub: "Score supérieur ou égal à 75", color: "#dc2626" },
    { code: "SM", value: `${averageScore.toFixed(1)}/100`, label: "Score moyen", sub: "Ensemble des prestataires", color: "#7c3aed" },
    { code: "MI", value: formatMoney(totalImpact), label: "Montant impacté", sub: `${formatNumber(anomalies.length)} anomalies`, color: "#d97706" },
    { code: "BF", value: `${maxDeviation.toFixed(1)}%`, label: "Écart Benford max.", sub: "Premiers chiffres des montants", color: "#059669" },
  ];

  return <AppShell title="Scores de risque — R11" subtitle={`Audit / Analyse / Scores / ${file.nomFichier}`}>
    <section className="mb-5 flex flex-wrap justify-end gap-3">
      <ModalForm title="Choisir l'audit" trigger={<button className="btn">Filtres</button>}>
        <form className="space-y-4 p-5">
          <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Audit à consulter</span><select className="input" defaultValue={file.id} name="fichier">{files.map((item) => <option key={item.id} value={item.id}>{item.nomFichier} · {item.filiale.nom} · {formatDate(item.dateImport)}</option>)}</select></label>
          <input name="vue" type="hidden" value={mode} />
          <button className="w-full rounded-lg bg-sky px-5 py-3 text-sm font-black text-white">Afficher l’analyse</button>
        </form>
      </ModalForm>
      <a className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white" href={`/synthese?fichier=${file.id}`}>Voir la synthèse</a>
    </section>

    <section className="mb-5 rounded-lg bg-navy px-6 py-4 text-white"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{file.nomFichier}</h2><p className="mt-1 text-sm font-semibold text-blue-100">{file.compagnie.nom} · {file.filiale.nom} · {fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom)}</p></div><div className="text-right"><p className="text-2xl font-black">{averageScore.toFixed(1)}/100</p><p className="text-xs font-bold uppercase text-blue-100">score moyen prestataires</p></div></div></section>

    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">{metrics.map((item) => <KpiCard item={item} key={item.code}/>)}</section>

    <nav className="my-6 grid grid-cols-2 gap-1 lg:grid-cols-4">
      {modes.map((item) => <a className={`rounded-md px-5 py-4 text-center text-sm font-black ${mode === item ? "bg-sky text-white" : "bg-white text-slate-500"}`} href={`/scores?fichier=${file.id}&vue=${item}&page=1`} key={item}>{modeLabel(item)}</a>)}
    </nav>

    {(mode === "prestataires" || mode === "beneficiaires") && <div className="min-w-0 space-y-5">
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black text-navy">Classement {mode === "prestataires" ? "des prestataires" : "des bénéficiaires"} par score de risque</h2><span className="badge bg-sky/10 text-sky">{formatNumber(activeEntities.length)} résultats · Page {currentPage}/{totalPages}</span></div>
        <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-soft">
          {activeEntities.length === 0 ? <p className="p-12 text-center text-sm font-semibold text-slate-500">Aucune entité exploitable pour cet audit.</p> : <table className="table min-w-[1080px]"><thead><tr><th>Rang</th><th>Code / Matricule</th><th>{mode === "prestataires" ? "Prestataire" : "Bénéficiaire"}</th><th>Nb lignes</th><th>Anomalies</th><th>Montant</th><th>Impact</th><th>Score</th><th>Niveau</th></tr></thead><tbody>{rows.map((row, index) => <tr className={row.score >= 75 ? "bg-red-100/80" : row.score >= 50 ? "bg-yellow-100/80" : index % 2 ? "bg-sky/10" : "bg-white"} key={row.key}><td className="font-black text-navy">#{(currentPage - 1) * pageSize + index + 1}</td><td className="font-mono text-xs">{row.key}</td><td className="max-w-[280px] truncate font-black text-navy" title={row.name}>{row.name}</td><td>{formatNumber(row.lines)}</td><td className="font-black text-orange-600">{formatNumber(row.anomalies)}</td><td>{formatMoney(row.amount)}</td><td className="font-black text-red-600">{formatMoney(row.impact)}</td><td className="font-black text-navy">{row.score}/100</td><td className={riskClass(row.score)}>{row.level}</td></tr>)}</tbody></table>}
        </div>
        {totalPages > 1 && <Pagination currentPage={currentPage} fileId={file.id} mode={mode} totalPages={totalPages}/>}
      </section>
      <BenfordPanel benford={benford}/>
    </div>}

    {mode === "benford" && <BenfordView benford={benford}/>}
    {mode === "clustering" && <ClusterView clusters={clusters}/>}
  </AppShell>;
}

function buildEntities(prestations: Array<{ id: bigint; codePrestataire: string | null; prestataire: string | null; matriculeBeneficiaire: string | null; nomBeneficiaire: string | null; prenomsBeneficiaire: string | null; montantReclame: unknown; montantPaye: unknown }>, anomalyMap: Map<string, { count: number; critical: number; weighted: number; impact: number }>, kind: "prestataire" | "beneficiaire") {
  const grouped = new Map<string, Omit<Entity, "score" | "level">>();
  for (const prestation of prestations) {
    const key = kind === "prestataire" ? prestation.codePrestataire ?? prestation.prestataire : prestation.matriculeBeneficiaire ?? prestation.nomBeneficiaire;
    if (!key) continue;
    const name = kind === "prestataire" ? prestation.prestataire ?? prestation.codePrestataire! : `${prestation.nomBeneficiaire ?? ""} ${prestation.prenomsBeneficiaire ?? ""}`.trim() || prestation.matriculeBeneficiaire!;
    const current = grouped.get(key) ?? { key, name, lines: 0, amount: 0, anomalies: 0, critical: 0, weighted: 0, impact: 0 };
    const anomaly = anomalyMap.get(prestation.id.toString());
    current.lines += 1;
    current.amount += Number(prestation.montantPaye || prestation.montantReclame);
    if (anomaly) { current.anomalies += anomaly.count; current.critical += anomaly.critical; current.weighted += anomaly.weighted; current.impact += anomaly.impact; }
    grouped.set(key, current);
  }
  return [...grouped.values()].map((item) => {
    const anomalyRate = item.lines ? Math.min(1, item.anomalies / item.lines) : 0;
    const severityRate = item.lines ? Math.min(1, item.weighted / (item.lines * 4)) : 0;
    const impactRate = item.amount ? Math.min(1, item.impact / item.amount) : 0;
    const score = Math.min(100, Math.round(anomalyRate * 35 + severityRate * 40 + impactRate * 25));
    return { ...item, score, level: riskLabel(score) };
  }).sort((left, right) => right.score - left.score || right.impact - left.impact);
}

function calculateBenford(amounts: number[]) {
  const counts = Array(9).fill(0) as number[];
  for (const amount of amounts) { const digit = Number(String(Math.abs(amount)).replace(/^0+/, "")[0]); if (digit >= 1 && digit <= 9) counts[digit - 1] += 1; }
  const total = counts.reduce((sum, count) => sum + count, 0);
  return counts.map((count, index) => { const actual = total ? (count / total) * 100 : 0; return { digit: index + 1, count, actual, expected: benfordExpected[index], deviation: actual - benfordExpected[index] }; });
}

function BenfordPanel({ benford }: { benford: ReturnType<typeof calculateBenford> }) { const max = Math.max(...benford.map((item) => item.actual), 1); const suspicious = [...benford].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))[0]; return <aside><h2 className="mb-3 text-lg font-black text-navy">Analyse de Benford — Montants</h2><div className="card p-5"><p className="mb-4 text-xs font-semibold text-slate-500">Distribution des premiers chiffres des montants payés</p><div className="flex h-48 items-end gap-3">{benford.map((item) => <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={item.digit}><span className="text-[10px] font-black text-navy">{item.actual.toFixed(1)}%</span><div className="w-full rounded-t-md" style={{ height: `${Math.max(3, (item.actual / max) * 130)}px`, backgroundColor: Math.abs(item.deviation) >= 5 ? "#dc2626" : "#38bdf8" }}/><span className="text-xs font-bold text-slate-600">{item.digit}</span></div>)}</div><p className="mt-5 text-center text-sm font-black text-orange-600">Écart principal : chiffre {suspicious.digit} ({signedPercent(suspicious.deviation)})</p></div></aside>; }
function BenfordView({ benford }: { benford: ReturnType<typeof calculateBenford> }) { return <section><h2 className="mb-3 text-xl font-black text-navy">Analyse détaillée de Benford</h2><div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[0.85fr_1.15fr]"><BenfordPanel benford={benford}/><div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft"><table className="table"><thead><tr><th>Premier chiffre</th><th>Occurrences</th><th>Observé</th><th>Attendu</th><th>Écart</th><th>Signal</th></tr></thead><tbody>{benford.map((item) => <tr className={Math.abs(item.deviation) >= 5 ? "bg-red-100/80" : "bg-white"} key={item.digit}><td className="font-black text-navy">{item.digit}</td><td>{formatNumber(item.count)}</td><td>{item.actual.toFixed(1)}%</td><td>{item.expected.toFixed(1)}%</td><td className="font-black text-orange-600">{signedPercent(item.deviation)}</td><td className={Math.abs(item.deviation) >= 5 ? "font-black text-red-600" : "font-black text-emerald-600"}>{Math.abs(item.deviation) >= 5 ? "À vérifier" : "Conforme"}</td></tr>)}</tbody></table></div></div></section>; }
function ClusterView({ clusters }: { clusters: Array<{ label: string; min: number; color: string; entities: Entity[] }> }) { const max = Math.max(...clusters.map((item) => item.entities.length), 1); return <section><h2 className="mb-3 text-xl font-black text-navy">Clustering des prestataires par niveau de risque</h2><div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">{clusters.map((cluster) => <article className="card p-5" key={cluster.label}><div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: cluster.color }}>{cluster.entities.length}</span><span className="text-xs font-black uppercase" style={{ color: cluster.color }}>{cluster.label}</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full" style={{ width: `${(cluster.entities.length / max) * 100}%`, backgroundColor: cluster.color }}/></div><div className="mt-5 space-y-3">{cluster.entities.slice(0, 5).map((entity) => <div className="flex items-center justify-between gap-3 text-xs" key={entity.key}><span className="truncate font-bold text-navy">{entity.name}</span><span className="font-black" style={{ color: cluster.color }}>{entity.score}</span></div>)}</div></article>)}</div></section>; }
function KpiCard({ item }: { item: { code: string; value: string; label: string; sub: string; color: string } }) { return <article className="relative min-h-36 overflow-hidden rounded-lg border border-line bg-white p-5 shadow-soft"><span className="grid h-14 w-14 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: item.color }}>{item.code}</span><h2 className="mt-4 text-3xl font-black leading-none text-navy">{item.value}</h2><p className="mt-2 text-sm font-black text-navy">{item.label}</p><p className="truncate text-xs font-semibold text-slate-500">{item.sub}</p><span className="absolute bottom-0 left-4 right-4 h-1" style={{ backgroundColor: item.color }}/></article>; }
function Pagination({ currentPage, totalPages, fileId, mode }: { currentPage: number; totalPages: number; fileId: number; mode: Mode }) { return <nav className="mt-5 flex flex-wrap items-center justify-center gap-2"><PageLink disabled={currentPage === 1} fileId={fileId} label="Précédent" mode={mode} page={currentPage - 1}/>{paginationPages(currentPage, totalPages).map((page, index) => page === "…" ? <span className="px-2 text-slate-400" key={`e-${index}`}>…</span> : <PageLink active={page === currentPage} fileId={fileId} key={page} label={String(page)} mode={mode} page={page}/>)}<PageLink disabled={currentPage === totalPages} fileId={fileId} label="Suivant" mode={mode} page={currentPage + 1}/></nav>; }
function PageLink({ page, fileId, label, mode, active = false, disabled = false }: { page: number; fileId: number; label: string; mode: Mode; active?: boolean; disabled?: boolean }) { const style = `rounded-md px-4 py-2 text-sm font-black ${active ? "bg-sky text-white" : disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "border border-line bg-white text-navy hover:border-sky"}`; return disabled ? <span className={style}>{label}</span> : <a className={style} href={`/scores?fichier=${fileId}&vue=${mode}&page=${page}`}>{label}</a>; }
function paginationPages(current: number, total: number): Array<number | "…"> { if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1); const pages: Array<number | "…"> = [1]; if (current > 4) pages.push("…"); for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page); if (current < total - 3) pages.push("…"); pages.push(total); return pages; }
function modeLabel(mode: Mode) { return mode === "prestataires" ? "Prestataires" : mode === "beneficiaires" ? "Bénéficiaires" : mode === "benford" ? "Analyse Benford" : "Clustering"; }
function riskLabel(score: number) { return score >= 75 ? "Critique" : score >= 50 ? "Élevé" : score >= 25 ? "Moyen" : "Faible"; }
function riskClass(score: number) { return score >= 75 ? "font-black text-red-600" : score >= 50 ? "font-black text-orange-600" : score >= 25 ? "font-black text-violet-600" : "font-black text-emerald-600"; }
function signedPercent(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`; }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function fullManagerName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
