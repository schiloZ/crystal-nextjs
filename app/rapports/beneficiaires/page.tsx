import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const pageSize = 50;
const kpiColors = ["#dc2626", "#dc2626", "#d97706", "#d97706", "#7c3aed"];

export default async function Page(props: { searchParams?: Promise<{ fichier?: string; page?: string }> }) {
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
    return <AppShell title="Anomalies bénéficiaires — R05" subtitle="Audit / Rapports / Bénéficiaires">
      <section className="card p-12 text-center"><h2 className="text-2xl font-black text-navy">Aucun audit disponible</h2><p className="mt-2 text-sm font-semibold text-slate-500">Importez et analysez un fichier pour consulter les anomalies bénéficiaires.</p><a className="btn mt-6 inline-block" href="/import">Importer un fichier</a></section>
    </AppShell>;
  }

  const anomalyWhere = { fichierImporteId: file.id, codeAnomalie: "BENEFICIAIRE_REFERENTIEL" };
  const requestedPage = Math.max(1, Number(searchParams?.page) || 1);
  const [totalRows, refsTotal, refsActive, amountAggregate] = await Promise.all([
    prisma.anomalie.count({ where: anomalyWhere }),
    prisma.refAssure.count({ where: { compagnieId: file.compagnieId } }),
    prisma.refAssure.count({ where: { compagnieId: file.compagnieId, actif: true } }),
    prisma.anomalie.aggregate({ where: anomalyWhere, _sum: { montantImpacte: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const anomalies = await prisma.anomalie.findMany({
    where: anomalyWhere,
    include: { prestation: true },
    orderBy: { prestation: { dateSoins: "asc" } },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });
  const matricules = anomalies.map((item) => item.prestation?.matriculeBeneficiaire).filter(Boolean) as string[];
  const references = matricules.length ? await prisma.refAssure.findMany({ where: { compagnieId: file.compagnieId, matricule: { in: matricules } } }) : [];
  const referencesByMatricule = new Map(references.map((reference) => [reference.matricule, reference]));
  const rows = anomalies.flatMap((anomaly) => {
    const prestation = anomaly.prestation;
    if (!prestation) return [];
    const reference = prestation.matriculeBeneficiaire ? referencesByMatricule.get(prestation.matriculeBeneficiaire) : undefined;
    return [{ anomaly, prestation, reference, type: reference && !reference.actif ? "Bénéficiaire inactif" : "Bénéficiaire hors référentiel" }];
  });
  const inactiveCount = rows.filter((row) => row.reference && !row.reference.actif).length;
  const absentCount = totalRows - inactiveCount;
  const totalAmount = Number(amountAggregate._sum.montantImpacte ?? 0);
  const kpis = [
    { icon: "HR", value: formatNumber(absentCount), label: "Hors référentiel", sub: "Matricules inexistants" },
    { icon: "IN", value: formatNumber(inactiveCount), label: "Bénéficiaires inactifs", sub: "Présents mais désactivés" },
    { icon: "RF", value: formatNumber(refsTotal), label: "Référentiel assuré", sub: `${formatNumber(refsActive)} actifs` },
    { icon: "MT", value: formatMoney(totalAmount), label: "Montant concerné", sub: "Toutes anomalies bénéficiaires" },
    { icon: "TX", value: `${file.nbLignesTotal ? ((totalRows / file.nbLignesTotal) * 100).toFixed(1) : "0.0"}%`, label: "Taux de détection", sub: "Sur les lignes importées" },
  ];

  return <AppShell title="Anomalies bénéficiaires — R05" subtitle={`Audit / Rapports / Bénéficiaires / ${file.nomFichier}`}>
    <section className="mb-5 flex flex-wrap justify-end gap-3">
      <ModalForm title="Filtres du rapport" trigger={<button className="btn">Filtres</button>}>
        <form className="space-y-4 p-5">
          <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Audit à consulter</span><select className="input" defaultValue={file.id} name="fichier">{files.map((item) => <option key={item.id} value={item.id}>{item.nomFichier} · {item.filiale.nom} · {formatDate(item.dateImport)}</option>)}</select></label>
          <button className="w-full rounded-lg bg-sky px-5 py-3 text-sm font-black text-white">Afficher le rapport</button>
        </form>
      </ModalForm>
      <a className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white" href={`/synthese?fichier=${file.id}`}>Voir la synthèse</a>
    </section>

    <section className="mb-6 rounded-lg border border-sky/20 bg-sky/5 px-5 py-4">
      <p className="text-sm font-black text-sky">Contrôle conditionnel — refAssures : {formatNumber(refsActive)} assurés actifs — {file.compagnie.nom}</p>
      <p className="mt-1 text-xs font-semibold text-slate-600">{file.nomFichier} · {file.filiale.nom} · {fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom)}</p>
    </section>

    <div className="mb-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {kpis.map((item, index) => <KpiCard color={kpiColors[index]} item={item} key={item.icon}/>)}
    </div>

    <section>
      <div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-lg font-black text-navy">Liste des anomalies bénéficiaires</h2><span className="badge bg-sky/10 text-sky">{formatNumber(totalRows)} résultats · Page {currentPage}/{totalPages}</span></div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-soft">
        {totalRows === 0 ? <p className="p-12 text-center text-sm font-semibold text-emerald-700">Aucune anomalie bénéficiaire détectée pour cet audit.</p> : <table className="table">
          <thead><tr><th>Matricule</th><th>Assuré principal</th><th>Bénéficiaire</th><th>Type anomalie</th><th>Date soins</th><th>Montant</th><th>Gravité</th><th>Action</th></tr></thead>
          <tbody>{rows.map(({ anomaly, prestation, type, reference }) => {
            const critical = anomaly.gravite === "critique";
            return <tr className={critical ? "bg-red-100/80" : "bg-yellow-100/80"} key={anomaly.id.toString()}>
              <td className="font-mono text-xs font-bold text-navy">{prestation.matriculeBeneficiaire ?? "-"}</td>
              <td className="font-black text-navy">{prestation.nomAssurePrincipal ?? prestation.matriculeAssurePrincipal ?? "-"}</td>
              <td>{beneficiaryName(prestation.nomBeneficiaire, prestation.prenomsBeneficiaire, reference?.nom)}</td>
              <td>{type}</td>
              <td>{prestation.dateSoins ? formatDate(prestation.dateSoins) : "-"}</td>
              <td className="font-black text-orange-600">{formatMoney(Number(prestation.montantPaye || prestation.montantReclame))}</td>
              <td className={`font-black ${critical ? "text-red-600" : "text-orange-600"}`}>{severityLabel(anomaly.gravite)}</td>
              <td className={`font-black ${reference ? "text-sky" : "text-red-600"}`}>{reference ? "Vérifier" : "Rejeter"}</td>
            </tr>;
          })}</tbody>
        </table>}
      </div>
      {totalPages > 1 && <Pagination currentPage={currentPage} fileId={file.id} totalPages={totalPages} />}
    </section>
  </AppShell>;
}

function KpiCard({ item, color }: { item: { icon: string; value: string; label: string; sub: string }; color: string }) { return <article className="relative overflow-hidden rounded-lg border border-line bg-white p-5 shadow-soft"><div className="mb-4 grid h-14 w-14 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: color }}>{item.icon}</div><h3 className="text-3xl font-black leading-none text-navy">{item.value}</h3><p className="mt-3 text-sm font-black text-navy">{item.label}</p><p className="text-xs font-semibold text-slate-500">{item.sub}</p><div className="absolute bottom-0 left-4 right-4 h-1" style={{ backgroundColor: color }}/></article>; }
function Pagination({ currentPage, totalPages, fileId }: { currentPage: number; totalPages: number; fileId: number }) { return <nav className="mt-5 flex flex-wrap items-center justify-center gap-2"><PageLink disabled={currentPage === 1} fileId={fileId} label="Précédent" page={currentPage - 1}/>{paginationPages(currentPage, totalPages).map((page, index) => page === "…" ? <span className="px-2 text-slate-400" key={`e-${index}`}>…</span> : <PageLink active={page === currentPage} fileId={fileId} key={page} label={String(page)} page={page}/>)}<PageLink disabled={currentPage === totalPages} fileId={fileId} label="Suivant" page={currentPage + 1}/></nav>; }
function PageLink({ page, fileId, label, active = false, disabled = false }: { page: number; fileId: number; label: string; active?: boolean; disabled?: boolean }) { const style = `rounded-md px-4 py-2 text-sm font-black ${active ? "bg-sky text-white" : disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "border border-line bg-white text-navy hover:border-sky"}`; return disabled ? <span className={style}>{label}</span> : <a className={style} href={`/rapports/beneficiaires?fichier=${fileId}&page=${page}`}>{label}</a>; }
function paginationPages(current: number, total: number): Array<number | "…"> { if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1); const pages: Array<number | "…"> = [1]; if (current > 4) pages.push("…"); for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page); if (current < total - 3) pages.push("…"); pages.push(total); return pages; }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function fullManagerName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
function beneficiaryName(nom: string | null, prenoms: string | null, fallback?: string) { return `${nom ?? ""} ${prenoms ?? ""}`.trim() || fallback || "-"; }
function severityLabel(value: string) { return value === "critique" ? "Critique" : value === "eleve" ? "Élevée" : value === "moyen" ? "Moyenne" : "Faible"; }
