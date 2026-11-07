import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const kpiColors = ["#dc2626", "#d97706", "#0284c7", "#059669"];
const pageSize = 50;

export default async function Page(
  props: { searchParams?: Promise<{ fichier?: string; page?: string; mode?: string }> }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  const scope = user.role === "super_admin" ? {} : { compagnieId: user.compagnieId };
  const files = await prisma.fichierImporte.findMany({
    where: scope,
    include: { filiale: true, gestionnaire: true, exercice: true },
    orderBy: { dateImport: "desc" },
    take: 30,
  });
  const file = files.find((item) => item.id === Number(searchParams?.fichier)) ?? files[0] ?? null;

  if (!file) {
    return <AppShell title="Prestations tardives — R02" subtitle="Audit / Rapports / Tardifs">
      <section className="card p-12 text-center"><h2 className="text-2xl font-black text-navy">Aucun audit disponible</h2><p className="mt-2 text-sm font-semibold text-slate-500">Importez et analysez un fichier pour consulter les prestations tardives.</p><a className="btn mt-6 inline-block" href="/import">Importer un fichier</a></section>
    </AppShell>;
  }

  const hasTolerance = Boolean(file.exercice.dateDebutToleranceTardif || file.exercice.dateFinToleranceTardif);
  const mode = searchParams?.mode === "exercice" ? "exercice" : hasTolerance ? "tolerance" : "exercice";
  const toleranceStart = file.exercice.dateDebutToleranceTardif ? startOfDay(file.exercice.dateDebutToleranceTardif) : null;
  const toleranceEnd = file.exercice.dateFinToleranceTardif ? endOfDay(file.exercice.dateFinToleranceTardif) : null;
  const prestations = await prisma.prestation.findMany({
    where: mode === "tolerance"
      ? { fichierImporteId: file.id, dateComptable: { not: null } }
      : { fichierImporteId: file.id, dateSoins: { not: null } },
    orderBy: { dateSoins: "asc" },
  });
  const allRows = prestations.flatMap((prestation) => {
    if (!prestation.dateSoins) return [];
    if (mode === "tolerance") {
      if (!prestation.dateComptable) return [];
      if (toleranceStart && prestation.dateComptable < toleranceStart) {
        const days = Math.ceil((toleranceStart.getTime() - prestation.dateComptable.getTime()) / 86_400_000);
        return [{ prestation, before: true, days, amount: Number(prestation.montantPaye || prestation.montantReclame), reason: `Comptabilisé ${days} jours avant la tolérance` }];
      }
      if (toleranceEnd && prestation.dateComptable > toleranceEnd) {
        const days = Math.ceil((prestation.dateComptable.getTime() - toleranceEnd.getTime()) / 86_400_000);
        return [{ prestation, before: false, days, amount: Number(prestation.montantPaye || prestation.montantReclame), reason: `Comptabilisé ${days} jours après la tolérance` }];
      }
      return [];
    }
    if (prestation.dateSoins >= file.exercice.dateDebut && prestation.dateSoins <= file.exercice.dateFin) return [];
    const before = prestation.dateSoins < file.exercice.dateDebut;
    const boundary = before ? file.exercice.dateDebut : file.exercice.dateFin;
    const days = Math.max(1, Math.ceil(Math.abs(prestation.dateSoins.getTime() - boundary.getTime()) / 86_400_000));
    return [{ prestation, before, days, amount: Number(prestation.montantPaye || prestation.montantReclame), reason: before ? "Avant exercice" : "Après exercice" }];
  });
  const requestedPage = Math.max(1, Number(searchParams?.page) || 1);
  const totalRows = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const rows = allRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const beforeCount = allRows.filter((row) => row.before).length;
  const afterCount = mode === "exercice" ? totalRows - beforeCount : allRows.filter((row) => !row.before).length;
  const total = allRows.reduce((sum, row) => sum + row.amount, 0);
  const average = totalRows ? total / totalRows : 0;
  const kpis = [
    { icon: mode === "exercice" ? "AV" : "AV", value: formatNumber(beforeCount), label: mode === "exercice" ? "Soins avant exercice" : "Avant tolérance", sub: mode === "exercice" ? `Antérieurs au ${formatDate(file.exercice.dateDebut)}` : toleranceStart ? `Avant le ${formatDate(toleranceStart)}` : "Début non configuré" },
    { icon: mode === "exercice" ? "AP" : "AP", value: formatNumber(afterCount), label: mode === "exercice" ? "Soins après exercice" : "Après tolérance", sub: mode === "exercice" ? `Postérieurs au ${formatDate(file.exercice.dateFin)}` : toleranceEnd ? `Après le ${formatDate(toleranceEnd)}` : "Fin non configurée" },
    { icon: "MM", value: formatMoney(average), label: "Montant moyen/tardif", sub: "Par prestation" },
    { icon: "GN", value: file.gestionnaire.actif ? "OUI" : "NON", label: "Gestionnaire actif", sub: fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom) },
  ];

  return <AppShell title="Prestations tardives — R02" subtitle={`Audit / Rapports / Tardifs / ${file.nomFichier}`}>
    <section className="mb-5 flex flex-wrap justify-end gap-3">
      <ModalForm title="Filtres du rapport" trigger={<button className="btn">Filtres</button>}>
        <form className="space-y-4 p-5">
          <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Audit à consulter</span><select className="input" defaultValue={file.id} name="fichier">{files.map((item) => <option key={item.id} value={item.id}>{item.nomFichier} · {item.filiale.nom} · {formatDate(item.dateImport)}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Type de tardif</span><select className="input" defaultValue={mode} name="mode"><option value="exercice">Hors exercice</option>{hasTolerance && <option value="tolerance">Hors période de tolérance</option>}</select></label>
          <div className="rounded-lg border border-line bg-slate-50 px-4 py-3"><span className="block text-xs font-black uppercase text-slate-500">Tolérance de l’exercice</span><span className="mt-1 block text-sm font-black text-navy">{toleranceLabel(file.exercice.dateDebutToleranceTardif, file.exercice.dateFinToleranceTardif)}</span></div>
          <button className="w-full rounded-lg bg-sky px-5 py-3 text-sm font-black text-white">Afficher le rapport</button>
        </form>
      </ModalForm>
      <a className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white" href={`/synthese?fichier=${file.id}`}>Voir la synthèse</a>
    </section>

    <section className="mb-5 flex flex-wrap items-center gap-5 border-l-8 border-orange-500 bg-yellow-100 px-5 py-4">
      <div className="min-w-80 flex-1">
        <h2 className="text-xl font-black text-orange-600">{formatNumber(totalRows)} PRESTATIONS TARDIVES — {mode === "exercice" ? `HORS EXERCICE [${formatDate(file.exercice.dateDebut)} → ${formatDate(file.exercice.dateFin)}]` : `HORS PÉRIODE DE TOLÉRANCE [${toleranceLabel(file.exercice.dateDebutToleranceTardif, file.exercice.dateFinToleranceTardif)}]`}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-700">{file.nomFichier} · {file.filiale.nom} · {fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom)}</p>
      </div>
      <a className="rounded-lg bg-orange-600 px-8 py-3 text-sm font-black text-white" href={`/api/exports/tardifs?fichier=${file.id}&mode=${mode}`}>Exporter rapport</a>
      <div className="min-w-48 text-right"><p className="text-2xl font-black text-red-600">{formatMoney(total)}</p><p className="text-xs font-semibold text-slate-500">Montant total concerné</p></div>
    </section>

    <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((item, index) => <KpiCard color={kpiColors[index]} item={item} key={item.icon}/>)}
    </div>

    <section>
      <div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-lg font-black text-navy">Liste détaillée des prestations tardives</h2><span className="badge bg-sky/10 text-sky">{formatNumber(totalRows)} résultats · Page {currentPage}/{totalPages}</span></div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-soft">
        {totalRows === 0 ? <p className="p-12 text-center text-sm font-semibold text-emerald-700">Aucune prestation ne dépasse le seuil tardif sélectionné.</p> : <table className="table">
          <thead><tr><th>N Presta.</th><th>Assuré principal</th><th>Bénéficiaire</th><th>Date soins</th><th>Date comptable</th><th>Écart</th><th>Prestataire</th><th>Acte</th><th>Montant</th><th>Motif</th></tr></thead>
          <tbody>{rows.map(({ prestation, before, days, reason }) => <tr className={before || mode === "tolerance" && !before ? "bg-red-100/80" : "bg-yellow-100/80"} key={prestation.id.toString()}>
            <td className="font-mono text-xs font-bold text-navy">{prestation.numeroPrestation ?? `PRE-${prestation.id}`}</td>
            <td className="font-black text-navy">{prestation.nomAssurePrincipal ?? prestation.matriculeAssurePrincipal ?? "-"}</td>
            <td>{prestation.nomBeneficiaire ?? prestation.matriculeBeneficiaire ?? "-"}</td>
            <td>{formatDate(prestation.dateSoins!)}</td>
            <td>{prestation.dateComptable ? formatDate(prestation.dateComptable) : "-"}</td>
            <td className="font-black text-red-600">{mode === "exercice" && before ? "-" : "+"}{days}j</td>
            <td>{prestation.prestataire ?? prestation.codePrestataire ?? "-"}</td>
            <td className="font-mono text-xs">{prestation.codeActe ?? prestation.acte ?? "-"}</td>
            <td className="font-black text-orange-600">{formatMoney(Number(prestation.montantPaye || prestation.montantReclame))}</td>
            <td className="font-black text-red-600">{reason}</td>
          </tr>)}</tbody>
        </table>}
      </div>
      {totalPages > 1 && <Pagination currentPage={currentPage} fileId={file.id} mode={mode} totalPages={totalPages} />}
    </section>
  </AppShell>;
}

function KpiCard({ item, color }: { item: { icon: string; value: string; label: string; sub: string }; color: string }) {
  return <article className="relative overflow-hidden rounded-lg border border-line bg-white p-5 shadow-soft"><div className="mb-4 grid h-14 w-14 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: color }}>{item.icon}</div><h3 className="text-3xl font-black leading-none text-navy">{item.value}</h3><p className="mt-3 text-sm font-black text-navy">{item.label}</p><p className="truncate text-xs font-semibold text-slate-500">{item.sub}</p><div className="absolute bottom-0 left-4 right-4 h-1" style={{ backgroundColor: color }}/></article>;
}
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function fullManagerName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }

function Pagination({ currentPage, totalPages, fileId, mode }: { currentPage: number; totalPages: number; fileId: number; mode: string }) {
  const pages = paginationPages(currentPage, totalPages);
  return <nav className="mt-5 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
    <PageLink disabled={currentPage === 1} fileId={fileId} label="Précédent" mode={mode} page={currentPage - 1} />
    {pages.map((page, index) => page === "…" ? <span className="px-2 text-sm font-black text-slate-400" key={`ellipsis-${index}`}>…</span> : <PageLink active={page === currentPage} fileId={fileId} key={page} label={String(page)} mode={mode} page={page} />)}
    <PageLink disabled={currentPage === totalPages} fileId={fileId} label="Suivant" mode={mode} page={currentPage + 1} />
  </nav>;
}

function PageLink({ page, fileId, label, mode, active = false, disabled = false }: { page: number; fileId: number; label: string; mode: string; active?: boolean; disabled?: boolean }) {
  const className = `rounded-md px-4 py-2 text-sm font-black ${active ? "bg-sky text-white" : disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "border border-line bg-white text-navy hover:border-sky"}`;
  return disabled ? <span className={className}>{label}</span> : <a className={className} href={`/rapports/tardifs?fichier=${fileId}&mode=${mode}&page=${page}`}>{label}</a>;
}

function paginationPages(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: Array<number | "…"> = [1];
  if (current > 4) pages.push("…");
  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page);
  if (current < total - 3) pages.push("…");
  pages.push(total);
  return pages;
}

function endOfDay(value: Date) { const date = new Date(value); date.setUTCHours(23, 59, 59, 999); return date; }
function startOfDay(value: Date) { const date = new Date(value); date.setUTCHours(0, 0, 0, 0); return date; }
function toleranceLabel(start: Date | null, end: Date | null) { return start && end ? `${formatDate(start)} → ${formatDate(end)}` : start ? `À partir du ${formatDate(start)}` : end ? `Jusqu'au ${formatDate(end)}` : "Non configurée"; }
