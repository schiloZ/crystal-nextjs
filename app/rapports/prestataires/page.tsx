import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const pageSize = 50;
const kpiColors = ["#dc2626", "#dc2626", "#d97706", "#059669"];
const barColors = ["#38bdf8", "#0ea5e9", "#818cf8", "#34d399", "#fb923c", "#f472b6"];

export default async function Page({ searchParams }: { searchParams?: { fichier?: string; page?: string } }) {
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
    return <AppShell title="Anomalies prestataires — R06" subtitle="Audit / Rapports / Prestataires">
      <section className="card p-12 text-center"><h2 className="text-2xl font-black text-navy">Aucun audit disponible</h2><p className="mt-2 text-sm font-semibold text-slate-500">Importez et analysez un fichier pour consulter les anomalies prestataires.</p><a className="btn mt-6 inline-block" href="/import">Importer un fichier</a></section>
    </AppShell>;
  }

  const anomalyWhere = { fichierImporteId: file.id, codeAnomalie: "PRESTATAIRE_REFERENTIEL" };
  const anomalyPrestations = await prisma.anomalie.findMany({
    where: anomalyWhere,
    include: { prestation: true },
  });
  const codes = [...new Set(anomalyPrestations.map((item) => item.prestation?.codePrestataire).filter(Boolean) as string[])];
  const references = codes.length ? await prisma.refPrestataire.findMany({ where: { compagnieId: file.compagnieId, code: { in: codes } } }) : [];
  const referenceByCode = new Map(references.map((reference) => [reference.code, reference]));
  const grouped = new Map<string, { code: string; name: string; count: number; amount: number; gravite: string; status: string; type: string }>();
  for (const anomaly of anomalyPrestations) {
    const prestation = anomaly.prestation;
    const code = prestation?.codePrestataire ?? "SANS-CODE";
    const reference = referenceByCode.get(code);
    const existing = grouped.get(code) ?? {
      code,
      name: prestation?.prestataire ?? reference?.nom ?? "Prestataire non renseigné",
      count: 0,
      amount: 0,
      gravite: anomaly.gravite,
      status: reference ? reference.statut : "Non référencé",
      type: reference && !reference.actif ? "Prestataire inactif" : reference ? `Statut ${reference.statut}` : "Hors réseau référentiel",
    };
    existing.count += 1;
    existing.amount += Number(prestation?.montantPaye || prestation?.montantReclame || anomaly.montantImpacte);
    if (anomaly.gravite === "critique") existing.gravite = "critique";
    grouped.set(code, existing);
  }
  const allGroups = [...grouped.values()].sort((left, right) => right.count - left.count || right.amount - left.amount);
  const totalGroups = allGroups.length;
  const requestedPage = Math.max(1, Number(searchParams?.page) || 1);
  const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const rows = allGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const inactiveCount = allGroups.filter((item) => ["radie", "suspendu"].includes(item.status) || item.type === "Prestataire inactif").length;
  const outsideNetwork = allGroups.filter((item) => item.status === "Non référencé").length;
  const affectedLines = allGroups.reduce((sum, item) => sum + item.count, 0);
  const totalAmount = allGroups.reduce((sum, item) => sum + item.amount, 0);

  const volume = await prisma.prestation.groupBy({
    by: ["codePrestataire", "prestataire"],
    where: { fichierImporteId: file.id, codePrestataire: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 6,
  });
  const maxVolume = Math.max(...volume.map((item) => item._count.id), 1);
  const kpis = [
    { icon: "HR", value: formatNumber(outsideNetwork), label: "Hors réseau", sub: "Non référencés" },
    { icon: "RS", value: formatNumber(inactiveCount), label: "Radiés/Suspendus", sub: "Inactifs" },
    { icon: "LI", value: formatNumber(affectedLines), label: "Lignes concernées", sub: `${formatNumber(totalGroups)} prestataires` },
    { icon: "MT", value: formatMoney(totalAmount), label: "Montant concerné", sub: "Prestations en anomalie" },
  ];

  return <AppShell title="Anomalies prestataires — R06" subtitle={`Audit / Rapports / Prestataires / ${file.nomFichier}`}>
    <section className="mb-5 flex flex-wrap justify-end gap-3">
      <ModalForm title="Filtres du rapport" trigger={<button className="btn">Filtres</button>}>
        <form className="space-y-4 p-5">
          <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Audit à consulter</span><select className="input" defaultValue={file.id} name="fichier">{files.map((item) => <option key={item.id} value={item.id}>{item.nomFichier} · {item.filiale.nom} · {formatDate(item.dateImport)}</option>)}</select></label>
          <button className="w-full rounded-lg bg-sky px-5 py-3 text-sm font-black text-white">Afficher le rapport</button>
        </form>
      </ModalForm>
      <a className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white" href={`/synthese?fichier=${file.id}`}>Voir la synthèse</a>
    </section>

    <section className="mb-5 rounded-lg bg-navy px-6 py-4 text-white"><h2 className="text-xl font-black">{file.nomFichier}</h2><p className="mt-1 text-sm font-semibold text-blue-100">{file.compagnie.nom} · {file.filiale.nom} · {fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom)}</p></section>

    <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((item, index) => <KpiCard color={kpiColors[index]} item={item} key={item.icon}/>)}
    </div>

    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.45fr_0.75fr]">
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-navy">Prestataires avec anomalies</h2><span className="badge bg-sky/10 text-sky">{formatNumber(totalGroups)} résultats · Page {currentPage}/{totalPages}</span></div>
        <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-soft">
          {totalGroups === 0 ? <p className="p-12 text-center text-sm font-semibold text-emerald-700">Aucune anomalie prestataire détectée pour cet audit.</p> : <table className="table">
            <thead><tr><th>Code</th><th>Prestataire</th><th>Type anomalie</th><th>Nb lignes</th><th>Montant</th><th>Réseau</th><th>Gravité</th></tr></thead>
            <tbody>{rows.map((row) => {
              const critical = row.gravite === "critique";
              const agreed = row.status === "agree";
              return <tr className={critical ? "bg-red-100/80" : "bg-sky/10"} key={row.code}><td className="font-mono text-xs font-bold text-navy">{row.code}</td><td className="font-black text-navy">{row.name}</td><td>{row.type}</td><td>{formatNumber(row.count)}</td><td className="font-black text-orange-600">{formatMoney(row.amount)}</td><td className={`font-black ${agreed ? "text-emerald-700" : "text-red-600"}`}>{row.status}</td><td className={`font-black ${critical ? "text-red-600" : "text-orange-600"}`}>{severityLabel(row.gravite)}</td></tr>;
            })}</tbody>
          </table>}
        </div>
        {totalPages > 1 && <Pagination currentPage={currentPage} fileId={file.id} totalPages={totalPages} />}
      </section>

      <aside className="card p-5">
        <h2 className="font-black text-navy">Top prestataires par volume</h2><p className="text-xs font-semibold text-slate-500">Toutes prestations du fichier</p>
        {volume.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">Aucune donnée prestataire.</p> : <div className="mt-5 flex h-64 items-end justify-between gap-4">{volume.map((item, index) => <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={`${item.codePrestataire}-${index}`}><span className="text-xs font-black text-navy">{formatNumber(item._count.id)}</span><div className="w-full rounded-t-md" style={{ height: `${Math.max(8, (item._count.id / maxVolume) * 190)}px`, backgroundColor: barColors[index] }}/><span className="w-full truncate text-center text-[10px] font-semibold text-slate-500" title={item.prestataire ?? item.codePrestataire ?? ""}>{item.prestataire ?? item.codePrestataire}</span></div>)}</div>}
      </aside>
    </div>
  </AppShell>;
}

function KpiCard({ item, color }: { item: { icon: string; value: string; label: string; sub: string }; color: string }) { return <article className="relative overflow-hidden rounded-lg border border-line bg-white p-5 shadow-soft"><div className="mb-4 grid h-14 w-14 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: color }}>{item.icon}</div><h3 className="text-3xl font-black leading-none text-navy">{item.value}</h3><p className="mt-3 text-sm font-black text-navy">{item.label}</p><p className="text-xs font-semibold text-slate-500">{item.sub}</p><div className="absolute bottom-0 left-4 right-4 h-1" style={{ backgroundColor: color }}/></article>; }
function Pagination({ currentPage, totalPages, fileId }: { currentPage: number; totalPages: number; fileId: number }) { return <nav className="mt-5 flex flex-wrap items-center justify-center gap-2"><PageLink disabled={currentPage === 1} fileId={fileId} label="Précédent" page={currentPage - 1}/>{paginationPages(currentPage, totalPages).map((page, index) => page === "…" ? <span className="px-2 text-slate-400" key={`e-${index}`}>…</span> : <PageLink active={page === currentPage} fileId={fileId} key={page} label={String(page)} page={page}/>)}<PageLink disabled={currentPage === totalPages} fileId={fileId} label="Suivant" page={currentPage + 1}/></nav>; }
function PageLink({ page, fileId, label, active = false, disabled = false }: { page: number; fileId: number; label: string; active?: boolean; disabled?: boolean }) { const style = `rounded-md px-4 py-2 text-sm font-black ${active ? "bg-sky text-white" : disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "border border-line bg-white text-navy hover:border-sky"}`; return disabled ? <span className={style}>{label}</span> : <a className={style} href={`/rapports/prestataires?fichier=${fileId}&page=${page}`}>{label}</a>; }
function paginationPages(current: number, total: number): Array<number | "…"> { if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1); const pages: Array<number | "…"> = [1]; if (current > 4) pages.push("…"); for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page); if (current < total - 3) pages.push("…"); pages.push(total); return pages; }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function fullManagerName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
function severityLabel(value: string) { return value === "critique" ? "Critique" : value === "eleve" ? "Élevée" : value === "moyen" ? "Moyenne" : "Faible"; }
