import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const pageSize = 5;
const validTypes = ["TOUS", "DATE_SOINS_FUTURE", "HORS_EXERCICE", "ECART_DATE_EXCESSIF"] as const;
type TemporalType = (typeof validTypes)[number];
const barColors = ["#38bdf8", "#0ea5e9", "#818cf8", "#34d399", "#fb923c"];

const typeDetails: Record<TemporalType, { label: string; short: string }> = {
  TOUS: { label: "Toutes les anomalies", short: "Tous" },
  DATE_SOINS_FUTURE: { label: "Dates de soins futures", short: "Dates futures" },
  HORS_EXERCICE: { label: "Prestations hors exercice", short: "Hors exercice" },
  ECART_DATE_EXCESSIF: { label: "Écarts de dates excessifs", short: "Écarts > 90 jours" },
};

export default async function Page(
  props: { searchParams?: Promise<{ fichier?: string; page?: string; type?: string }> }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  const scope = user.role === "super_admin" ? {} : { compagnieId: user.compagnieId };
  const files = await prisma.fichierImporte.findMany({
    where: scope,
    include: { compagnie: true, filiale: true, gestionnaire: true, exercice: true },
    orderBy: { dateImport: "desc" },
    take: 30,
  });
  const file = files.find((item) => item.id === Number(searchParams?.fichier)) ?? files[0] ?? null;

  if (!file) {
    return <AppShell title="Contrôles temporels — R10" subtitle="Audit / Rapports / Temporel">
      <section className="card p-12 text-center"><h2 className="text-2xl font-black text-navy">Aucun audit disponible</h2><p className="mt-2 text-sm font-semibold text-slate-500">Importez et analysez un fichier pour consulter les contrôles temporels.</p><a className="btn mt-6 inline-block" href="/import">Importer un fichier</a></section>
    </AppShell>;
  }

  const selectedType = validTypes.includes(searchParams?.type as TemporalType) ? searchParams?.type as TemporalType : "TOUS";
  const baseWhere: Prisma.AnomalieWhereInput = { fichierImporteId: file.id, categorie: "TEMPOREL" };
  const selectedWhere: Prisma.AnomalieWhereInput = selectedType === "TOUS" ? baseWhere : { ...baseWhere, codeAnomalie: selectedType };
  const [grouped, beforeCount, afterCount, totalRows, allTemporal] = await Promise.all([
    prisma.anomalie.groupBy({ by: ["codeAnomalie"], where: baseWhere, _count: { id: true }, _sum: { montantImpacte: true } }),
    prisma.anomalie.count({ where: { ...baseWhere, codeAnomalie: "HORS_EXERCICE", prestation: { is: { dateSoins: { lt: file.exercice.dateDebut } } } } }),
    prisma.anomalie.count({ where: { ...baseWhere, codeAnomalie: "HORS_EXERCICE", prestation: { is: { dateSoins: { gt: file.exercice.dateFin } } } } }),
    prisma.anomalie.count({ where: selectedWhere }),
    prisma.anomalie.findMany({ where: baseWhere, select: { codeAnomalie: true, prestation: { select: { dateSoins: true } } } }),
  ]);
  const stats = new Map(grouped.map((item) => [item.codeAnomalie, { count: item._count.id, amount: Number(item._sum.montantImpacte ?? 0) }]));
  const totalTemporal = grouped.reduce((sum, item) => sum + item._count.id, 0);
  const totalAmount = grouped.reduce((sum, item) => sum + Number(item._sum.montantImpacte ?? 0), 0);
  const requestedPage = Math.max(1, Number(searchParams?.page) || 1);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const anomalies = await prisma.anomalie.findMany({
    where: selectedWhere,
    include: { prestation: true },
    orderBy: [{ gravite: "asc" }, { prestation: { dateSoins: "asc" } }],
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });
  const weekCounts = [0, 0, 0, 0, 0];
  for (const anomaly of allTemporal) {
    const date = anomaly.prestation?.dateSoins;
    if (date) weekCounts[Math.min(4, Math.floor((date.getUTCDate() - 1) / 7))] += 1;
  }
  const maxWeek = Math.max(...weekCounts, 1);
  const metrics = [
    { code: "DF", value: formatNumber(stats.get("DATE_SOINS_FUTURE")?.count ?? 0), label: "Dates futures", sub: "Soins après aujourd’hui", color: "#dc2626" },
    { code: "AV", value: formatNumber(beforeCount), label: "Avant exercice", sub: `Avant le ${formatDate(file.exercice.dateDebut)}`, color: "#d97706" },
    { code: "AP", value: formatNumber(afterCount), label: "Après exercice", sub: `Après le ${formatDate(file.exercice.dateFin)}`, color: "#d97706" },
    { code: "EE", value: formatNumber(stats.get("ECART_DATE_EXCESSIF")?.count ?? 0), label: "Écarts excessifs", sub: "Soins/comptable > 90j", color: "#7c3aed" },
    { code: "MT", value: formatMoney(totalAmount), label: "Montant concerné", sub: `${formatNumber(totalTemporal)} anomalies`, color: "#0284c7" },
  ];

  return <AppShell title="Contrôles temporels — R10" subtitle={`Audit / Rapports / Temporel / ${file.nomFichier}`}>
    <section className="mb-5 flex flex-wrap justify-end gap-3">
      <ModalForm title="Filtres du rapport" trigger={<button className="btn">Filtres</button>}>
        <form className="space-y-4 p-5">
          <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Audit à consulter</span><select className="input" defaultValue={file.id} name="fichier">{files.map((item) => <option key={item.id} value={item.id}>{item.nomFichier} · {item.filiale.nom} · {formatDate(item.dateImport)}</option>)}</select></label>
          <input name="type" type="hidden" value={selectedType} />
          <button className="w-full rounded-lg bg-sky px-5 py-3 text-sm font-black text-white">Afficher le rapport</button>
        </form>
      </ModalForm>
      <a className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white" href={`/synthese?fichier=${file.id}`}>Voir la synthèse</a>
      <a className="rounded-lg bg-orange-600 px-5 py-3 text-sm font-black text-white" href={`/rapports/tardifs?fichier=${file.id}`}>Rapport tardifs</a>
    </section>

    <section className="mb-5 rounded-lg bg-navy px-6 py-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{file.nomFichier}</h2><p className="mt-1 text-sm font-semibold text-blue-100">{file.compagnie.nom} · {file.filiale.nom} · Exercice {formatDate(file.exercice.dateDebut)} au {formatDate(file.exercice.dateFin)}</p></div><div className="text-right"><p className="text-2xl font-black">{formatNumber(totalTemporal)}</p><p className="text-xs font-bold uppercase text-blue-100">anomalies temporelles</p></div></div>
    </section>

    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {metrics.map((item) => <KpiCard item={item} key={item.code}/>)}
    </section>

    <nav className="mt-7 grid grid-cols-2 gap-1 lg:grid-cols-4">
      {validTypes.map((type) => {
        const count = type === "TOUS" ? totalTemporal : stats.get(type)?.count ?? 0;
        return <a className={`rounded-md px-4 py-3 text-center text-sm font-black ${selectedType === type ? "bg-sky text-white" : "bg-white text-slate-500"}`} href={`/rapports/temporel?fichier=${file.id}&type=${type}&page=1`} key={type}>{typeDetails[type].short} ({formatNumber(count)})</a>;
      })}
    </nav>

    <section className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black text-navy">{typeDetails[selectedType].label}</h2><span className="badge bg-sky/10 text-sky">{formatNumber(totalRows)} résultats · Page {currentPage}/{totalPages}</span></div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-soft">
        {totalRows === 0 ? <p className="p-12 text-center text-sm font-semibold text-emerald-700">Aucune anomalie temporelle de ce type pour cet audit.</p> : <table className="table min-w-[1100px]">
          <thead><tr><th>N° Prestation</th><th>Bénéficiaire</th><th>Assuré principal</th><th>Date soins</th><th>Date comptable</th><th>Écart</th><th>Type anomalie</th><th>Montant</th><th>Décision</th></tr></thead>
          <tbody>{anomalies.map((anomaly) => {
            const prestation = anomaly.prestation;
            const days = dateGap(prestation?.dateSoins, prestation?.dateComptable);
            const critical = anomaly.gravite === "critique";
            return <tr className={critical ? "bg-red-100/80" : "bg-yellow-100/80"} key={anomaly.id.toString()}>
              <td className="font-mono text-xs font-bold text-navy">{prestation?.numeroPrestation ?? `PRE-${prestation?.id ?? anomaly.id}`}</td>
              <td className="font-black text-navy">{prestation?.nomBeneficiaire ?? prestation?.matriculeBeneficiaire ?? "-"}</td>
              <td>{prestation?.nomAssurePrincipal ?? prestation?.matriculeAssurePrincipal ?? "-"}</td>
              <td>{prestation?.dateSoins ? formatDate(prestation.dateSoins) : "-"}</td>
              <td>{prestation?.dateComptable ? formatDate(prestation.dateComptable) : "-"}</td>
              <td className="font-black text-red-600">{days === null ? "-" : `${days}j`}</td>
              <td className={critical ? "font-black text-red-600" : "font-black text-orange-600"}>{typeDetails[anomaly.codeAnomalie as Exclude<TemporalType, "TOUS">]?.label ?? anomaly.description ?? anomaly.codeAnomalie}</td>
              <td className="font-black text-orange-600">{formatMoney(Number(prestation?.montantPaye || prestation?.montantReclame || anomaly.montantImpacte))}</td>
              <td className={critical ? "font-black text-red-600" : "font-black text-orange-600"}>{decision(anomaly.codeAnomalie)}</td>
            </tr>;
          })}</tbody>
        </table>}
      </div>
      {totalPages > 1 && <Pagination currentPage={currentPage} fileId={file.id} totalPages={totalPages} type={selectedType} />}
    </section>

    <section className="mt-9">
      <h2 className="mb-3 text-xl font-black text-navy">Répartition des anomalies temporelles par semaine du mois</h2>
      <div className="card h-64 p-6"><div className="flex h-full items-end justify-between gap-5">{weekCounts.map((value, index) => <div className="flex min-w-0 flex-1 flex-col items-center gap-3" key={index}><span className="text-xs font-black text-navy">{formatNumber(value)}</span><div className="w-full max-w-48 rounded-t-md" style={{ height: `${Math.max(value ? 8 : 2, (value / maxWeek) * 165)}px`, backgroundColor: barColors[index] }}/><span className="text-xs font-semibold text-slate-500">Sem. {index + 1}</span></div>)}</div></div>
    </section>
  </AppShell>;
}

function KpiCard({ item }: { item: { code: string; value: string; label: string; sub: string; color: string } }) { return <article className="relative min-h-36 overflow-hidden rounded-lg border border-line bg-white p-5 shadow-soft"><span className="grid h-14 w-14 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: item.color }}>{item.code}</span><h2 className="mt-4 text-3xl font-black leading-none text-navy">{item.value}</h2><p className="mt-2 text-sm font-black text-navy">{item.label}</p><p className="truncate text-xs font-semibold text-slate-500">{item.sub}</p><span className="absolute bottom-0 left-4 right-4 h-1" style={{ backgroundColor: item.color }}/></article>; }
function Pagination({ currentPage, totalPages, fileId, type }: { currentPage: number; totalPages: number; fileId: number; type: TemporalType }) { return <nav className="mt-5 flex flex-wrap items-center justify-center gap-2"><PageLink disabled={currentPage === 1} fileId={fileId} label="Précédent" page={currentPage - 1} type={type}/>{paginationPages(currentPage, totalPages).map((page, index) => page === "…" ? <span className="px-2 text-slate-400" key={`e-${index}`}>…</span> : <PageLink active={page === currentPage} fileId={fileId} key={page} label={String(page)} page={page} type={type}/>)}<PageLink disabled={currentPage === totalPages} fileId={fileId} label="Suivant" page={currentPage + 1} type={type}/></nav>; }
function PageLink({ page, fileId, label, type, active = false, disabled = false }: { page: number; fileId: number; label: string; type: TemporalType; active?: boolean; disabled?: boolean }) { const style = `rounded-md px-4 py-2 text-sm font-black ${active ? "bg-sky text-white" : disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "border border-line bg-white text-navy hover:border-sky"}`; return disabled ? <span className={style}>{label}</span> : <a className={style} href={`/rapports/temporel?fichier=${fileId}&type=${type}&page=${page}`}>{label}</a>; }
function paginationPages(current: number, total: number): Array<number | "…"> { if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1); const pages: Array<number | "…"> = [1]; if (current > 4) pages.push("…"); for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page); if (current < total - 3) pages.push("…"); pages.push(total); return pages; }
function decision(code: string) { return code === "DATE_SOINS_FUTURE" ? "REJETER" : code === "HORS_EXERCICE" ? "TARDIF" : "VÉRIFIER"; }
function dateGap(first?: Date | null, second?: Date | null) { return first && second ? Math.round(Math.abs(second.getTime() - first.getTime()) / 86_400_000) : null; }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
