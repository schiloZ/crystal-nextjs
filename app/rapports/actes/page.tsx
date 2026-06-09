import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const pageSize = 50;
const validTypes = ["ACTE_NON_RENSEIGNE", "ACTE_NON_COUVERT", "REPETITION_ACTE", "DEPASSEMENT_TARIF"] as const;
type ActType = (typeof validTypes)[number];

const typeDetails: Record<ActType, { code: string; label: string; sub: string; color: string }> = {
  ACTE_NON_RENSEIGNE: { code: "NR", label: "Actes non renseignés", sub: "Code et libellé absents", color: "#dc2626" },
  ACTE_NON_COUVERT: { code: "NC", label: "Actes non couverts", sub: "Absents ou inactifs", color: "#dc2626" },
  REPETITION_ACTE: { code: "RS", label: "Répétitions suspectes", sub: "Même acte > 5 fois", color: "#d97706" },
  DEPASSEMENT_TARIF: { code: "HT", label: "Dépassements tarifaires", sub: "Tarif conventionné dépassé", color: "#d97706" },
};

export default async function Page({ searchParams }: { searchParams?: { fichier?: string; page?: string; type?: string } }) {
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
    return <AppShell title="Anomalies actes médicaux — R09" subtitle="Audit / Rapports / Actes médicaux">
      <section className="card p-12 text-center"><h2 className="text-2xl font-black text-navy">Aucun audit disponible</h2><p className="mt-2 text-sm font-semibold text-slate-500">Importez et analysez un fichier pour consulter les anomalies liées aux actes.</p><a className="btn mt-6 inline-block" href="/import">Importer un fichier</a></section>
    </AppShell>;
  }

  const selectedType = validTypes.includes(searchParams?.type as ActType) ? searchParams?.type as ActType : "ACTE_NON_COUVERT";
  const countQueries = validTypes.map((type) => prisma.anomalie.count({ where: anomalyWhere(file.id, type) }));
  const [nonRenseigne, nonCouvert, repetitions, depassements] = await Promise.all(countQueries);
  const counts: Record<ActType, number> = { ACTE_NON_RENSEIGNE: nonRenseigne, ACTE_NON_COUVERT: nonCouvert, REPETITION_ACTE: repetitions, DEPASSEMENT_TARIF: depassements };
  const totalSelected = counts[selectedType];
  const requestedPage = Math.max(1, Number(searchParams?.page) || 1);
  const totalPages = Math.max(1, Math.ceil(totalSelected / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);

  const [anomalies, topActs, totalActLines, distinctActCodes] = await Promise.all([
    prisma.anomalie.findMany({
      where: anomalyWhere(file.id, selectedType),
      include: { prestation: true },
      orderBy: [{ gravite: "asc" }, { montantImpacte: "desc" }],
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.prestation.groupBy({
      by: ["codeActe", "acte", "famillePrestation"],
      where: { fichierImporteId: file.id, OR: [{ codeActe: { not: null } }, { acte: { not: null } }] },
      _count: { id: true },
      _sum: { montantReclame: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.prestation.count({ where: { fichierImporteId: file.id, OR: [{ codeActe: { not: null } }, { acte: { not: null } }] } }),
    prisma.prestation.groupBy({ by: ["codeActe", "acte"], where: { fichierImporteId: file.id, OR: [{ codeActe: { not: null } }, { acte: { not: null } }] } }),
  ]);

  const actCodes = [...new Set([
    ...anomalies.map((item) => item.prestation?.codeActe),
    ...topActs.map((item) => item.codeActe),
  ].filter(Boolean) as string[])];
  const references = actCodes.length ? await prisma.refActe.findMany({ where: { compagnieId: file.compagnieId, codeActe: { in: actCodes } } }) : [];
  const refsByCode = new Map(references.map((reference) => [reference.codeActe, reference]));
  const totalAnomalies = validTypes.reduce((sum, type) => sum + counts[type], 0);
  const amountImpacted = await prisma.anomalie.aggregate({
    where: { fichierImporteId: file.id, OR: validTypes.map((type) => anomalyWhere(file.id, type)) },
    _sum: { montantImpacte: true },
  });
  const metrics = validTypes.map((type) => ({ ...typeDetails[type], value: formatNumber(counts[type]) }));

  return <AppShell title="Anomalies actes médicaux — R09" subtitle={`Audit / Rapports / Actes médicaux / ${file.nomFichier}`}>
    <section className="mb-5 flex flex-wrap justify-end gap-3">
      <ModalForm title="Filtres du rapport" trigger={<button className="btn">Filtres</button>}>
        <form className="space-y-4 p-5">
          <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Audit à consulter</span><select className="input" defaultValue={file.id} name="fichier">{files.map((item) => <option key={item.id} value={item.id}>{item.nomFichier} · {item.filiale.nom} · {formatDate(item.dateImport)}</option>)}</select></label>
          <input name="type" type="hidden" value={selectedType} />
          <button className="w-full rounded-lg bg-sky px-5 py-3 text-sm font-black text-white">Afficher le rapport</button>
        </form>
      </ModalForm>
      <a className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white" href={`/synthese?fichier=${file.id}`}>Voir la synthèse</a>
    </section>

    <section className="mb-5 rounded-lg bg-navy px-6 py-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{file.nomFichier}</h2><p className="mt-1 text-sm font-semibold text-blue-100">{file.compagnie.nom} · {file.filiale.nom} · {fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom)}</p></div><div className="text-right"><p className="text-2xl font-black">{formatNumber(totalAnomalies)}</p><p className="text-xs font-bold uppercase text-blue-100">anomalies liées aux actes</p></div></div>
    </section>

    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((item) => <KpiCard item={item} key={item.code}/>)}
    </section>

    <nav className="mt-7 grid grid-cols-1 gap-1 md:grid-cols-4">
      {validTypes.map((type) => <a className={`rounded-t-md px-5 py-4 text-center text-sm font-black ${selectedType === type ? "bg-sky text-white" : "bg-white text-slate-500"}`} href={`/rapports/actes?fichier=${file.id}&type=${type}&page=1`} key={type}>{typeDetails[type].label} ({formatNumber(counts[type])})</a>)}
    </nav>

    <section>
      <div className="flex items-center justify-between bg-white px-5 py-3"><h2 className="font-black text-navy">{typeDetails[selectedType].label}</h2><span className="badge bg-sky/10 text-sky">{formatNumber(totalSelected)} résultats · Page {currentPage}/{totalPages}</span></div>
      <div className="overflow-x-auto rounded-b-lg border border-line bg-white shadow-soft">
        {totalSelected === 0 ? <p className="p-12 text-center text-sm font-semibold text-emerald-700">Aucune anomalie de ce type détectée pour cet audit.</p> : <table className="table">
          <thead><tr><th>Bénéficiaire</th><th>Assuré principal</th><th>Code acte</th><th>Libellé acte</th><th>Famille</th><th>Montant</th><th>Anomalie</th><th>Gravité</th></tr></thead>
          <tbody>{anomalies.map((anomaly) => {
            const prestation = anomaly.prestation;
            const reference = prestation?.codeActe ? refsByCode.get(prestation.codeActe) : undefined;
            const critical = anomaly.gravite === "critique";
            return <tr className={critical ? "bg-red-100/80" : "bg-yellow-100/80"} key={anomaly.id.toString()}>
              <td className="font-black text-navy">{prestation?.nomBeneficiaire ?? prestation?.matriculeBeneficiaire ?? "-"}</td>
              <td>{prestation?.nomAssurePrincipal ?? prestation?.matriculeAssurePrincipal ?? "-"}</td>
              <td className="font-mono text-xs font-bold text-navy">{prestation?.codeActe ?? "SANS CODE"}</td>
              <td>{prestation?.acte ?? reference?.libelle ?? "-"}</td>
              <td>{prestation?.famillePrestation ?? reference?.famille ?? "-"}</td>
              <td className="font-black text-orange-600">{formatMoney(Number(prestation?.montantReclame ?? anomaly.montantImpacte))}</td>
              <td className="font-black text-red-600">{typeDetails[selectedType].label}</td>
              <td className={critical ? "font-black text-red-600" : "font-black text-orange-600"}>{severityLabel(anomaly.gravite)}</td>
            </tr>;
          })}</tbody>
        </table>}
      </div>
      {totalPages > 1 && <Pagination currentPage={currentPage} fileId={file.id} totalPages={totalPages} type={selectedType} />}
    </section>

    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-black text-navy">Top actes les plus facturés — Analyse statistique</h2><p className="text-xs font-semibold text-slate-500">{formatNumber(totalActLines)} lignes · {formatNumber(distinctActCodes.length)} actes distincts · {formatMoney(Number(amountImpacted._sum.montantImpacte ?? 0))} impactés</p></div></div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-soft">
        {topActs.length === 0 ? <p className="p-12 text-center text-sm font-semibold text-slate-500">Aucun acte renseigné dans cet audit.</p> : <table className="table">
          <thead><tr><th>Code acte</th><th>Libellé</th><th>Famille</th><th>Nb lignes</th><th>Montant total</th><th>Moy/acte</th><th>Tarif conv.</th><th>Alerte</th></tr></thead>
          <tbody>{topActs.map((row, index) => {
            const reference = row.codeActe ? refsByCode.get(row.codeActe) : undefined;
            const total = Number(row._sum.montantReclame ?? 0);
            const average = row._count.id ? total / row._count.id : 0;
            const tariff = Number(reference?.tarifConventionne ?? 0);
            const alert = !reference ? "NON RÉF." : tariff > 0 && average > tariff ? "TARIF" : reference.couvert && reference.actif ? "OK" : "NON COUVERT";
            return <tr className={index % 2 ? "bg-sky/10" : "bg-white"} key={`${row.codeActe}-${row.acte}-${index}`}><td className="font-mono text-xs font-bold text-navy">{row.codeActe ?? "SANS CODE"}</td><td className="font-black text-navy">{row.acte ?? reference?.libelle ?? "-"}</td><td>{row.famillePrestation ?? reference?.famille ?? "-"}</td><td>{formatNumber(row._count.id)}</td><td>{formatMoney(total)}</td><td>{formatMoney(average)}</td><td>{reference ? formatMoney(tariff) : "-"}</td><td className={`font-black ${alert === "OK" ? "text-emerald-600" : alert === "TARIF" ? "text-orange-600" : "text-red-600"}`}>{alert}</td></tr>;
          })}</tbody>
        </table>}
      </div>
    </section>
  </AppShell>;
}

function anomalyWhere(fileId: number, type: ActType): Prisma.AnomalieWhereInput {
  if (type === "ACTE_NON_RENSEIGNE") return { fichierImporteId: fileId, codeAnomalie: "CHAMPS_IMPORTANTS_MANQUANTS", prestation: { is: { codeActe: null, acte: null } } };
  return { fichierImporteId: fileId, codeAnomalie: type };
}

function KpiCard({ item }: { item: { code: string; value: string; label: string; sub: string; color: string } }) { return <article className="relative min-h-36 overflow-hidden rounded-lg border border-line bg-white p-5 shadow-soft"><span className="grid h-14 w-14 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: item.color }}>{item.code}</span><h2 className="mt-4 text-3xl font-black leading-none text-navy">{item.value}</h2><p className="mt-2 text-sm font-black text-navy">{item.label}</p><p className="text-xs font-semibold text-slate-500">{item.sub}</p><span className="absolute bottom-0 left-4 right-4 h-1" style={{ backgroundColor: item.color }}/></article>; }
function Pagination({ currentPage, totalPages, fileId, type }: { currentPage: number; totalPages: number; fileId: number; type: ActType }) { return <nav className="mt-5 flex flex-wrap items-center justify-center gap-2"><PageLink disabled={currentPage === 1} fileId={fileId} label="Précédent" page={currentPage - 1} type={type}/>{paginationPages(currentPage, totalPages).map((page, index) => page === "…" ? <span className="px-2 text-slate-400" key={`e-${index}`}>…</span> : <PageLink active={page === currentPage} fileId={fileId} key={page} label={String(page)} page={page} type={type}/>)}<PageLink disabled={currentPage === totalPages} fileId={fileId} label="Suivant" page={currentPage + 1} type={type}/></nav>; }
function PageLink({ page, fileId, label, type, active = false, disabled = false }: { page: number; fileId: number; label: string; type: ActType; active?: boolean; disabled?: boolean }) { const style = `rounded-md px-4 py-2 text-sm font-black ${active ? "bg-sky text-white" : disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "border border-line bg-white text-navy hover:border-sky"}`; return disabled ? <span className={style}>{label}</span> : <a className={style} href={`/rapports/actes?fichier=${fileId}&type=${type}&page=${page}`}>{label}</a>; }
function paginationPages(current: number, total: number): Array<number | "…"> { if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1); const pages: Array<number | "…"> = [1]; if (current > 4) pages.push("…"); for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page); if (current < total - 3) pages.push("…"); pages.push(total); return pages; }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function fullManagerName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
function severityLabel(value: string) { return value === "critique" ? "Critique" : value === "eleve" ? "Élevée" : value === "moyen" ? "Moyenne" : "Faible"; }
