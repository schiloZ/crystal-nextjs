import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const pageSize = 50;
const metricStyles = [
  ["bg-orange-500", "bg-orange-500"], ["bg-red-600", "bg-red-600"], ["bg-orange-500", "bg-orange-500"],
  ["bg-red-600", "bg-red-600"], ["bg-emerald-600", "bg-emerald-600"],
];
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
    return <AppShell title="Fréquence et Volumétrie — R07" subtitle="Audit / Rapports / Fréquence">
      <section className="card p-12 text-center"><h2 className="text-2xl font-black text-navy">Aucun audit disponible</h2><p className="mt-2 text-sm font-semibold text-slate-500">Importez et analysez un fichier pour consulter les anomalies de fréquence.</p><a className="btn mt-6 inline-block" href="/import">Importer un fichier</a></section>
    </AppShell>;
  }

  const groups = await prisma.prestation.groupBy({
    by: ["matriculeBeneficiaire", "codeActe"],
    where: { fichierImporteId: file.id, matriculeBeneficiaire: { not: null }, codeActe: { not: null } },
    _count: { id: true },
    _sum: { montantReclame: true, montantPaye: true },
    having: { id: { _count: { gt: 5 } } },
    orderBy: { _count: { id: "desc" } },
  });
  const requestedPage = Math.max(1, Number(searchParams?.page) || 1);
  const totalGroups = groups.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rows = await Promise.all(pageGroups.map(async (group) => {
    const sample = await prisma.prestation.findFirst({
      where: { fichierImporteId: file.id, matriculeBeneficiaire: group.matriculeBeneficiaire, codeActe: group.codeActe },
      orderBy: { dateSoins: "asc" },
    });
    return { group, sample };
  }));
  const suspiciousBeneficiaries = new Set(groups.map((group) => group.matriculeBeneficiaire)).size;
  const suspiciousActs = new Set(groups.map((group) => group.codeActe)).size;
  const totalOccurrences = groups.reduce((sum, group) => sum + group._count.id, 0);
  const totalAmount = groups.reduce((sum, group) => sum + Number(group._sum.montantPaye ?? group._sum.montantReclame ?? 0), 0);
  const maxFrequency = Math.max(...groups.map((group) => group._count.id), 0);
  const metrics = [
    { code: "BS", value: formatNumber(suspiciousBeneficiaries), label: "Bénéficiaires suspects", sub: "Actes répétés > 5 fois" },
    { code: "GR", value: formatNumber(totalGroups), label: "Groupes suspects", sub: "Bénéficiaire + acte" },
    { code: "OC", value: formatNumber(totalOccurrences), label: "Occurrences concernées", sub: "Toutes prestations répétées" },
    { code: "MF", value: formatNumber(maxFrequency), label: "Fréquence maximale", sub: "Pour un même acte" },
    { code: "MT", value: formatMoney(totalAmount), label: "Montant concerné", sub: `${formatNumber(suspiciousActs)} actes distincts` },
  ];
  const actVolume = new Map<string, number>();
  for (const group of groups) if (group.codeActe) actVolume.set(group.codeActe, (actVolume.get(group.codeActe) ?? 0) + group._count.id);
  const bars = [...actVolume.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxBar = Math.max(...bars.map(([, value]) => value), 1);

  return <AppShell title="Fréquence et Volumétrie — R07" subtitle={`Audit / Rapports / Fréquence / ${file.nomFichier}`}>
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

    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
      {metrics.map((item, index) => <MetricCard color={metricStyles[index][0]} item={item} key={item.code} line={metricStyles[index][1]}/>)}
    </section>

    <section className="mt-7 min-w-0 space-y-5">
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-navy">Fréquences anormales par bénéficiaire et acte</h2><span className="badge bg-sky/10 text-sky">{formatNumber(totalGroups)} résultats · Page {currentPage}/{totalPages}</span></div>
        <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-soft">
          {totalGroups === 0 ? <p className="p-12 text-center text-sm font-semibold text-emerald-700">Aucune fréquence anormale détectée pour cet audit.</p> : <table className="table min-w-[980px]">
            <thead><tr><th>Bénéficiaire</th><th>Assuré principal</th><th>Type anomalie</th><th>Nb actes</th><th>Code acte</th><th>Prestataire exemple</th><th>Montant cumulé</th><th>Gravité</th></tr></thead>
            <tbody>{rows.map(({ group, sample }) => <tr className={group._count.id >= 10 ? "bg-red-100/80" : "bg-yellow-100/80"} key={`${group.matriculeBeneficiaire}-${group.codeActe}`}>
              <td className="font-black text-navy">{sample?.nomBeneficiaire ?? group.matriculeBeneficiaire}</td>
              <td>{sample?.nomAssurePrincipal ?? sample?.matriculeAssurePrincipal ?? "-"}</td>
              <td>Répétition du même acte</td>
              <td className="font-black text-red-600">{formatNumber(group._count.id)}</td>
              <td className="font-mono text-xs">{group.codeActe}</td>
              <td>{sample?.prestataire ?? sample?.codePrestataire ?? "-"}</td>
              <td className="font-black text-orange-600">{formatMoney(Number(group._sum.montantPaye ?? group._sum.montantReclame ?? 0))}</td>
              <td className={group._count.id >= 10 ? "font-black text-red-600" : "font-black text-orange-600"}>{group._count.id >= 10 ? "Critique" : "Élevée"}</td>
            </tr>)}</tbody>
          </table>}
        </div>
        {totalPages > 1 && <Pagination currentPage={currentPage} fileId={file.id} totalPages={totalPages} />}
      </div>

      <section className="card min-w-0 p-5">
        <h2 className="font-black text-navy">Actes les plus répétés</h2><p className="text-xs font-semibold text-slate-500">Occurrences dans les groupes suspects</p>
        {bars.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">Aucune fréquence suspecte.</p> : <div className="mt-5 flex h-64 items-end justify-between gap-4">{bars.map(([label, value], index) => <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={label}><span className="text-xs font-black text-navy">{formatNumber(value)}</span><div className="w-full rounded-t-md" style={{ height: `${Math.max(8, (value / maxBar) * 190)}px`, backgroundColor: barColors[index] }}/><span className="w-full truncate text-center text-[10px] font-semibold text-slate-500" title={label}>{label}</span></div>)}</div>}
      </section>
    </section>
  </AppShell>;
}

function MetricCard({ item, color, line }: { item: { code: string; value: string; label: string; sub: string }; color: string; line: string }) { return <article className="card relative min-h-36 overflow-hidden p-6"><span className={`grid h-14 w-14 place-items-center rounded-full text-lg font-black text-white ${color}`}>{item.code}</span><h2 className="mt-5 text-3xl font-black leading-none text-navy">{item.value}</h2><p className="text-sm font-bold leading-tight text-slate-600">{item.label}</p><p className="text-xs font-black leading-tight text-slate-500">{item.sub}</p><span className={`absolute bottom-3 left-5 right-5 h-1 rounded-full ${line}`}/></article>; }
function Pagination({ currentPage, totalPages, fileId }: { currentPage: number; totalPages: number; fileId: number }) { return <nav className="mt-5 flex flex-wrap items-center justify-center gap-2"><PageLink disabled={currentPage === 1} fileId={fileId} label="Précédent" page={currentPage - 1}/>{paginationPages(currentPage, totalPages).map((page, index) => page === "…" ? <span className="px-2 text-slate-400" key={`e-${index}`}>…</span> : <PageLink active={page === currentPage} fileId={fileId} key={page} label={String(page)} page={page}/>)}<PageLink disabled={currentPage === totalPages} fileId={fileId} label="Suivant" page={currentPage + 1}/></nav>; }
function PageLink({ page, fileId, label, active = false, disabled = false }: { page: number; fileId: number; label: string; active?: boolean; disabled?: boolean }) { const style = `rounded-md px-4 py-2 text-sm font-black ${active ? "bg-sky text-white" : disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "border border-line bg-white text-navy hover:border-sky"}`; return disabled ? <span className={style}>{label}</span> : <a className={style} href={`/rapports/frequence?fichier=${fileId}&page=${page}`}>{label}</a>; }
function paginationPages(current: number, total: number): Array<number | "…"> { if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1); const pages: Array<number | "…"> = [1]; if (current > 4) pages.push("…"); for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page); if (current < total - 3) pages.push("…"); pages.push(total); return pages; }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function fullManagerName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
