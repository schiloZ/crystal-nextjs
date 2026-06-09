import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const pageSize = 50;
const anomalyTypes = ["DEPASSEMENT_TARIF", "MONTANT_PAYE_SUPERIEUR", "MONTANT_NEGATIF"] as const;
const validTypes = [...anomalyTypes, "TICKET_MODERATEUR", "PLAFONDS"] as const;
const kpiColors = ["#dc2626", "#dc2626", "#d97706", "#0284c7", "#7c3aed"];
type MontantType = typeof validTypes[number];
type DetailRow = { key: string; beneficiary: string; principal: string; codeActe: string; claimed: number; comparison: number; comparisonLabel: string; impact: number; ratio: number; severity: string; rowClass: string };

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
    return <AppShell title="Montants et plafonds — R08" subtitle="Audit / Rapports / Montants">
      <section className="card p-12 text-center"><h2 className="text-2xl font-black text-navy">Aucun audit disponible</h2><p className="mt-2 text-sm font-semibold text-slate-500">Importez et analysez un fichier pour consulter les anomalies de montants.</p><a className="btn mt-6 inline-block" href="/import">Importer un fichier</a></section>
    </AppShell>;
  }

  const selectedType = validTypes.includes(searchParams?.type as MontantType) ? searchParams?.type as MontantType : "DEPASSEMENT_TARIF";
  const baseWhere = { fichierImporteId: file.id, categorie: "MONTANT" as const };
  const [grouped, checkedPrestations, plafondRules] = await Promise.all([
    prisma.anomalie.groupBy({
      by: ["codeAnomalie"],
      where: baseWhere,
      _count: { id: true },
      _sum: { montantImpacte: true },
    }),
    prisma.prestation.findMany({
      where: { fichierImporteId: file.id },
      orderBy: { id: "asc" },
    }),
    prisma.refPlafond.findMany({
      where: { compagnieId: file.compagnieId, actif: true },
      orderBy: { id: "desc" },
    }),
  ]);
  const ticketRows = buildTicketRows(checkedPrestations);
  const plafondRows = buildPlafondRows(checkedPrestations, plafondRules);
  const stats = new Map(grouped.map((item) => [item.codeAnomalie, { count: item._count.id, amount: Number(item._sum.montantImpacte ?? 0) }]));
  stats.set("TICKET_MODERATEUR", { count: ticketRows.length, amount: ticketRows.reduce((sum, item) => sum + item.impact, 0) });
  stats.set("PLAFONDS", { count: plafondRows.length, amount: plafondRows.reduce((sum, item) => sum + item.impact, 0) });
  const selectedStats = stats.get(selectedType) ?? { count: 0, amount: 0 };
  const requestedPage = Math.max(1, Number(searchParams?.page) || 1);
  const totalPages = Math.max(1, Math.ceil(selectedStats.count / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const isStoredAnomaly = anomalyTypes.includes(selectedType as typeof anomalyTypes[number]);
  const anomalies = isStoredAnomaly ? await prisma.anomalie.findMany({
    where: { ...baseWhere, codeAnomalie: selectedType },
    include: { prestation: true },
    orderBy: { montantImpacte: "desc" },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  }) : [];
  const actCodes = anomalies.map((item) => item.prestation?.codeActe).filter(Boolean) as string[];
  const refs = actCodes.length ? await prisma.refActe.findMany({ where: { compagnieId: file.compagnieId, codeActe: { in: actCodes } } }) : [];
  const refsByCode = new Map(refs.map((ref) => [ref.codeActe, ref]));
  const detailRows = isStoredAnomaly
    ? anomalies.map((anomaly): DetailRow => {
      const prestation = anomaly.prestation;
      const reference = prestation?.codeActe ? refsByCode.get(prestation.codeActe) : undefined;
      const claimed = Number(prestation?.montantReclame ?? 0);
      const paid = Number(prestation?.montantPaye ?? 0);
      const comparison = selectedType === "DEPASSEMENT_TARIF" ? Number(reference?.tarifConventionne ?? 0) : paid;
      const impact = Number(anomaly.montantImpacte);
      return {
        key: anomaly.id.toString(),
        beneficiary: beneficiaryName(prestation),
        principal: prestation?.nomAssurePrincipal ?? prestation?.matriculeAssurePrincipal ?? "-",
        codeActe: prestation?.codeActe ?? prestation?.acte ?? "-",
        claimed,
        comparison,
        comparisonLabel: selectedType === "DEPASSEMENT_TARIF" ? "Tarif conv." : "Montant payé",
        impact,
        ratio: comparison ? (impact / Math.abs(comparison)) * 100 : 0,
        severity: anomaly.gravite,
        rowClass: anomaly.gravite === "critique" ? "bg-red-100/80" : "bg-yellow-100/80",
      };
    })
    : (selectedType === "TICKET_MODERATEUR" ? ticketRows : plafondRows).slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalCount = Array.from(stats.values()).reduce((sum, item) => sum + item.count, 0);
  const totalAmount = Array.from(stats.values()).reduce((sum, item) => sum + item.amount, 0);
  const tabs = [
    { type: "DEPASSEMENT_TARIF", label: "Hors tarif", count: stats.get("DEPASSEMENT_TARIF")?.count ?? 0 },
    { type: "MONTANT_PAYE_SUPERIEUR", label: "Payé > réclamé", count: stats.get("MONTANT_PAYE_SUPERIEUR")?.count ?? 0 },
    { type: "MONTANT_NEGATIF", label: "Montants négatifs", count: stats.get("MONTANT_NEGATIF")?.count ?? 0 },
    { type: "TICKET_MODERATEUR", label: "Ticket modérateur", count: stats.get("TICKET_MODERATEUR")?.count ?? 0 },
    { type: "PLAFONDS", label: "Plafonds", count: stats.get("PLAFONDS")?.count ?? 0 },
  ];
  const kpis = [
    { icon: "HT", value: formatNumber(stats.get("DEPASSEMENT_TARIF")?.count ?? 0), label: "Hors tarif", sub: formatMoney(stats.get("DEPASSEMENT_TARIF")?.amount ?? 0) },
    { icon: "PR", value: formatNumber(stats.get("MONTANT_PAYE_SUPERIEUR")?.count ?? 0), label: "Payé > réclamé", sub: formatMoney(stats.get("MONTANT_PAYE_SUPERIEUR")?.amount ?? 0) },
    { icon: "TM", value: formatNumber(stats.get("TICKET_MODERATEUR")?.count ?? 0), label: "Ticket modérateur", sub: formatMoney(stats.get("TICKET_MODERATEUR")?.amount ?? 0) },
    { icon: "PL", value: formatNumber(stats.get("PLAFONDS")?.count ?? 0), label: "Plafonds dépassés", sub: formatMoney(stats.get("PLAFONDS")?.amount ?? 0) },
    { icon: "MI", value: formatMoney(totalAmount), label: "Montant impacté", sub: `${formatNumber(totalCount)} anomalie(s)` },
  ];

  return <AppShell title="Montants et plafonds — R08" subtitle={`Audit / Rapports / Montants / ${file.nomFichier}`}>
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

    <section className="mb-5 rounded-lg bg-navy px-6 py-4 text-white"><h2 className="text-xl font-black">{file.nomFichier}</h2><p className="mt-1 text-sm font-semibold text-blue-100">{file.compagnie.nom} · {file.filiale.nom} · {fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom)} · {formatMoney(totalAmount)} impactés</p></section>

    <div className="mb-5 grid grid-cols-2 gap-1 lg:grid-cols-5">
      {tabs.map((tab) => <a className={`rounded-md px-5 py-4 text-center text-sm font-bold ${selectedType === tab.type ? "bg-sky text-white" : "bg-white text-slate-500"}`} href={`/rapports/montants?fichier=${file.id}&type=${tab.type}&page=1`} key={tab.label}>{tab.label} ({formatNumber(tab.count)})</a>)}
    </div>

    <div className="mb-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {kpis.map((item, index) => <KpiCard color={kpiColors[index]} item={item} key={item.icon}/>)}
    </div>

    <section>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-navy">{typeLabel(selectedType)}</h2><span className="badge bg-sky/10 text-sky">{formatNumber(selectedStats.count)} résultats · Page {currentPage}/{totalPages}</span></div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-soft">
        {selectedStats.count === 0 ? <p className="p-12 text-center text-sm font-semibold text-emerald-700">Aucune anomalie de ce type détectée pour cet audit.</p> : <table className="table">
          <thead><tr><th>Bénéficiaire</th><th>Assuré principal</th><th>Acte / règle</th><th>Mnt réclamé</th><th>{comparisonHeader(selectedType)}</th><th>Écart</th><th>Écart %</th><th>Gravité</th></tr></thead>
          <tbody>{detailRows.map((row) => <tr className={row.rowClass} key={row.key}>
            <td className="font-black text-navy">{row.beneficiary}</td>
            <td>{row.principal}</td>
            <td className="font-mono text-xs">{row.codeActe}</td>
            <td>{formatMoney(row.claimed)}</td>
            <td><span className="font-semibold text-slate-500">{row.comparisonLabel}</span> · {formatMoney(row.comparison)}</td>
            <td className="font-black text-red-600">{formatMoney(row.impact)}</td>
            <td className="font-black text-red-600">{row.ratio ? `${row.ratio.toFixed(1)}%` : "-"}</td>
            <td className="font-black text-orange-600">{severityLabel(row.severity)}</td>
          </tr>)}</tbody>
        </table>}
      </div>
      {totalPages > 1 && <Pagination currentPage={currentPage} fileId={file.id} totalPages={totalPages} type={selectedType} />}
    </section>
  </AppShell>;
}

function KpiCard({ item, color }: { item: { icon: string; value: string; label: string; sub: string }; color: string }) { return <article className="relative overflow-hidden rounded-lg border border-line bg-white p-5 shadow-soft"><div className="mb-4 grid h-14 w-14 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: color }}>{item.icon}</div><h3 className="text-3xl font-black leading-none text-navy">{item.value}</h3><p className="mt-3 text-sm font-black text-navy">{item.label}</p><p className="text-xs font-semibold text-slate-500">{item.sub}</p><div className="absolute bottom-0 left-4 right-4 h-1" style={{ backgroundColor: color }}/></article>; }
function Pagination({ currentPage, totalPages, fileId, type }: { currentPage: number; totalPages: number; fileId: number; type: string }) { return <nav className="mt-5 flex flex-wrap items-center justify-center gap-2"><PageLink disabled={currentPage === 1} fileId={fileId} label="Précédent" page={currentPage - 1} type={type}/>{paginationPages(currentPage, totalPages).map((page, index) => page === "…" ? <span className="px-2 text-slate-400" key={`e-${index}`}>…</span> : <PageLink active={page === currentPage} fileId={fileId} key={page} label={String(page)} page={page} type={type}/>)}<PageLink disabled={currentPage === totalPages} fileId={fileId} label="Suivant" page={currentPage + 1} type={type}/></nav>; }
function PageLink({ page, fileId, label, type, active = false, disabled = false }: { page: number; fileId: number; label: string; type: string; active?: boolean; disabled?: boolean }) { const style = `rounded-md px-4 py-2 text-sm font-black ${active ? "bg-sky text-white" : disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "border border-line bg-white text-navy hover:border-sky"}`; return disabled ? <span className={style}>{label}</span> : <a className={style} href={`/rapports/montants?fichier=${fileId}&type=${type}&page=${page}`}>{label}</a>; }
function paginationPages(current: number, total: number): Array<number | "…"> { if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1); const pages: Array<number | "…"> = [1]; if (current > 4) pages.push("…"); for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page); if (current < total - 3) pages.push("…"); pages.push(total); return pages; }
function typeLabel(type: string) { return type === "DEPASSEMENT_TARIF" ? "Dépassements de tarifs conventionnés" : type === "MONTANT_PAYE_SUPERIEUR" ? "Montants payés supérieurs aux montants réclamés" : type === "MONTANT_NEGATIF" ? "Montants négatifs" : type === "TICKET_MODERATEUR" ? "Écarts sur ticket modérateur" : "Dépassements de plafonds"; }
function comparisonHeader(type: string) { return type === "TICKET_MODERATEUR" ? "Ticket attendu" : type === "PLAFONDS" ? "Plafond" : "Mnt payé / Tarif"; }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function fullManagerName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
function severityLabel(value: string) { return value === "critique" ? "Critique" : value === "eleve" ? "Élevée" : value === "moyen" ? "Moyenne" : "Faible"; }
function beneficiaryName(prestation: { nomBeneficiaire?: string | null; prenomsBeneficiaire?: string | null; matriculeBeneficiaire?: string | null } | null | undefined) { return `${prestation?.nomBeneficiaire ?? ""} ${prestation?.prenomsBeneficiaire ?? ""}`.trim() || prestation?.matriculeBeneficiaire || "-"; }
function buildTicketRows(prestations: Awaited<ReturnType<typeof prisma.prestation.findMany>>): DetailRow[] {
  return prestations.flatMap((prestation) => {
    const base = Number(prestation.baseRemboursement || prestation.montantReclame || 0);
    const rate = Number(prestation.ticketModerateur || 0);
    const actual = Number(prestation.montantTicketModerateur || 0);
    if (base <= 0 || rate <= 0) return [];
    const expected = rate <= 1 ? base * rate : rate <= 100 ? base * (rate / 100) : rate;
    const impact = Math.abs(actual - expected);
    if (impact <= 1) return [];
    return [{
      key: `ticket-${prestation.id.toString()}`,
      beneficiary: beneficiaryName(prestation),
      principal: prestation.nomAssurePrincipal ?? prestation.matriculeAssurePrincipal ?? "-",
      codeActe: prestation.codeActe ?? prestation.acte ?? "-",
      claimed: Number(prestation.montantReclame ?? 0),
      comparison: expected,
      comparisonLabel: `${rate}${rate <= 1 ? "" : rate <= 100 ? "%" : " F"}`,
      impact,
      ratio: expected ? (impact / Math.abs(expected)) * 100 : 0,
      severity: impact > 10_000 ? "eleve" : "moyen",
      rowClass: impact > 10_000 ? "bg-yellow-100/80" : "bg-sky/10",
    }];
  }).sort((a, b) => b.impact - a.impact);
}
function buildPlafondRows(prestations: Awaited<ReturnType<typeof prisma.prestation.findMany>>, rules: Awaited<ReturnType<typeof prisma.refPlafond.findMany>>): DetailRow[] {
  return prestations.flatMap((prestation) => {
    const rule = bestPlafondRule(prestation, rules);
    if (!rule) return [];
    const claimed = Number(prestation.montantReclame ?? 0);
    const ceiling = Number(rule.montantPlafond ?? 0);
    const impact = claimed - ceiling;
    if (ceiling <= 0 || impact <= 0) return [];
    return [{
      key: `plafond-${prestation.id.toString()}-${rule.id}`,
      beneficiary: beneficiaryName(prestation),
      principal: prestation.nomAssurePrincipal ?? prestation.matriculeAssurePrincipal ?? "-",
      codeActe: `${prestation.codeActe ?? prestation.acte ?? "-"} · ${rule.libelle}`,
      claimed,
      comparison: ceiling,
      comparisonLabel: rule.typePlafond,
      impact,
      ratio: ceiling ? (impact / Math.abs(ceiling)) * 100 : 0,
      severity: impact > 25_000 ? "critique" : "eleve",
      rowClass: impact > 25_000 ? "bg-red-100/80" : "bg-yellow-100/80",
    }];
  }).sort((a, b) => b.impact - a.impact);
}
function bestPlafondRule(prestation: Awaited<ReturnType<typeof prisma.prestation.findMany>>[number], rules: Awaited<ReturnType<typeof prisma.refPlafond.findMany>>) {
  let best: typeof rules[number] | null = null;
  let bestScore = -1;
  for (const rule of rules) {
    let score = 0;
    if (rule.police) {
      if (![prestation.police, prestation.policeInterne].includes(rule.police)) continue;
      score += 3;
    }
    if (rule.numeroCollege) {
      if (rule.numeroCollege !== prestation.numeroCollege) continue;
      score += 2;
    }
    if (rule.codeActe) {
      if (rule.codeActe !== prestation.codeActe) continue;
      score += 5;
    }
    if (rule.famille) {
      if (!sameText(rule.famille, prestation.codeFamillePrestation) && !sameText(rule.famille, prestation.famillePrestation)) continue;
      score += 4;
    }
    if (!rule.police && !rule.numeroCollege && !rule.codeActe && !rule.famille) score = 1;
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best;
}
function sameText(left: string | null | undefined, right: string | null | undefined) { return normalize(left) === normalize(right); }
function normalize(value: string | null | undefined) { return (value ?? "").trim().toLowerCase(); }
