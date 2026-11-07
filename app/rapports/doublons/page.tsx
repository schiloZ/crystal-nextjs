import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { functionalDuplicateKey } from "@/lib/duplicate-detection";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const pageSize = 50;
const types = ["fonctionnel", "partiel", "inter-mois", "inter-gestionnaire"] as const;
type DuplicateType = (typeof types)[number];
type LoadedPrestation = Awaited<ReturnType<typeof loadCompanyPrestations>>[number];
type DuplicateGroup = { key: string; first: LoadedPrestation; duplicate: LoadedPrestation; occurrences: number; excess: number };

const typeLabels: Record<DuplicateType, string> = {
  fonctionnel: "Doublons fonctionnels",
  partiel: "Doublons partiels",
  "inter-mois": "Inter-mois",
  "inter-gestionnaire": "Inter-gestionnaires",
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
    return <AppShell title="Rapport des doublons — R03" subtitle="Audit / Rapports / Doublons">
      <section className="card p-12 text-center"><h2 className="text-2xl font-black text-navy">Aucun audit disponible</h2><p className="mt-2 text-sm font-semibold text-slate-500">Importez et analysez un fichier pour consulter les doublons.</p><a className="btn mt-6 inline-block" href="/import">Importer un fichier</a></section>
    </AppShell>;
  }

  const selectedType = types.includes(searchParams?.type as DuplicateType) ? searchParams?.type as DuplicateType : "fonctionnel";
  const companyPrestations = await loadCompanyPrestations(file.compagnieId);
  const currentPrestations = companyPrestations.filter((item) => item.fichierImporteId === file.id);
  const externalPrestations = companyPrestations.filter((item) => item.fichierImporteId !== file.id);
  const groupsByType: Record<DuplicateType, DuplicateGroup[]> = {
    fonctionnel: functionalGroups(currentPrestations),
    partiel: partialGroups(currentPrestations),
    "inter-mois": crossFileGroups(currentPrestations, externalPrestations, (match) => match.fichier.moisFichier !== file.moisFichier || match.fichier.anneeFichier !== file.anneeFichier),
    "inter-gestionnaire": crossFileGroups(currentPrestations, externalPrestations, (match) => match.gestionnaireId !== file.gestionnaireId),
  };
  const activeGroups = groupsByType[selectedType];
  const requestedPage = Math.max(1, Number(searchParams?.page) || 1);
  const totalPages = Math.max(1, Math.ceil(activeGroups.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const rows = activeGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalExcess = activeGroups.reduce((sum, group) => sum + group.excess, 0);
  const totalGroups = types.reduce((sum, type) => sum + groupsByType[type].length, 0);
  const kpis = [
    { icon: "DF", value: formatNumber(groupsByType.fonctionnel.length), label: "Doublons fonctionnels", sub: "Même clé métier", color: "#dc2626" },
    { icon: "DP", value: formatNumber(groupsByType.partiel.length), label: "Doublons partiels", sub: "Même soin, montant différent", color: "#7c3aed" },
    { icon: "IM", value: formatNumber(groupsByType["inter-mois"].length), label: "Doublons inter-mois", sub: "Correspondance autre période", color: "#d97706" },
    { icon: "IG", value: formatNumber(groupsByType["inter-gestionnaire"].length), label: "Inter-gestionnaires", sub: "Correspondance autre gestionnaire", color: "#059669" },
  ];

  return <AppShell title="Rapport des doublons — R03" subtitle={`Audit / Rapports / Doublons / ${file.nomFichier}`}>
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

    <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-navy px-6 py-4 text-white">
      <div><h2 className="text-xl font-black">{file.nomFichier}</h2><p className="mt-1 text-sm font-semibold text-blue-100">{file.compagnie.nom} · {file.filiale.nom} · {fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom)} · {monthLabel(file.moisFichier, file.anneeFichier)}</p></div>
      <div className="text-right"><p className="text-xl font-black text-sky">{formatNumber(totalGroups)} groupes détectés</p><p className="text-xs font-semibold text-blue-100">{formatMoney(totalExcess)} en trop dans la vue active</p></div>
    </section>

    <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{kpis.map((item) => <KpiCard item={item} key={item.icon}/>)}</section>

    <nav className="mb-5 grid grid-cols-1 gap-1 md:grid-cols-4">
      {types.map((type) => <a className={`rounded-t-lg px-5 py-4 text-center text-sm font-bold ${selectedType === type ? "border-b-4 border-sky bg-white text-navy" : "bg-[#dceefa] text-slate-500"}`} href={`/rapports/doublons?fichier=${file.id}&type=${type}&page=1`} key={type}>{typeLabels[type]} ({formatNumber(groupsByType[type].length)})</a>)}
    </nav>

    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-black text-navy">{typeLabels[selectedType]}</h2><p className="text-xs font-semibold text-slate-500">{ruleDescription(selectedType)}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <a className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-soft" href={`/api/exports/doublons?fichiers=${file.id}`}>Télécharger tous les doublons</a>
          <span className="badge bg-sky/10 text-sky">{formatNumber(activeGroups.length)} résultats · Page {currentPage}/{totalPages}</span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-soft">
        {activeGroups.length === 0 ? <p className="p-12 text-center text-sm font-semibold text-emerald-700">Aucun {typeLabels[selectedType].toLowerCase()} détecté pour cet audit.</p> : <table className="table">
          <thead><tr><th>N° Prest. sélectionnée</th><th>N° Prest. correspondante</th><th>Occurrences</th><th>Bénéficiaire</th><th>Date soins</th><th>Acte</th><th>Prestataire</th><th>Période / Gestionnaire correspondant</th><th>Montant</th><th>En trop</th></tr></thead>
          <tbody>{rows.map((group) => <tr className={selectedType === "inter-gestionnaire" ? "bg-red-100/80" : "bg-yellow-100/80"} key={group.key}>
            <td className="font-mono text-xs font-bold text-navy">{group.first.numeroPrestation ?? `PRE-${group.first.id}`}</td>
            <td className="font-mono text-xs font-bold text-navy">{group.duplicate.numeroPrestation ?? `PRE-${group.duplicate.id}`}</td>
            <td className="font-black text-red-600">{formatNumber(group.occurrences)}</td>
            <td className="font-black text-navy">{group.first.nomBeneficiaire ?? group.first.matriculeBeneficiaire ?? "-"}</td>
            <td>{group.first.dateSoins ? formatDate(group.first.dateSoins) : "-"}</td>
            <td>{group.first.acte ?? group.first.codeActe ?? "-"}</td>
            <td>{group.first.prestataire ?? group.first.codePrestataire ?? "-"}</td>
            <td><span className="font-black text-navy">{monthLabel(group.duplicate.fichier.moisFichier, group.duplicate.fichier.anneeFichier)}</span><br/><span className="text-xs text-slate-500">{fullManagerName(group.duplicate.fichier.gestionnaire.prenoms, group.duplicate.fichier.gestionnaire.nom)}</span></td>
            <td>{formatMoney(amountOf(group.first))}</td>
            <td className="font-black text-red-600">{formatMoney(group.excess)}</td>
          </tr>)}</tbody>
        </table>}
      </div>
      {totalPages > 1 && <Pagination currentPage={currentPage} fileId={file.id} totalPages={totalPages} type={selectedType}/>}
    </section>
  </AppShell>;
}

function loadCompanyPrestations(compagnieId: number) {
  return prisma.prestation.findMany({
    where: { compagnieId },
    include: { fichier: { include: { gestionnaire: true } } },
    orderBy: { id: "asc" },
  });
}

function functionalGroups(prestations: LoadedPrestation[]) {
  const grouped = signatureMap(prestations);
  for (const [key, matches] of grouped) {
    if (matches.length < 2) grouped.delete(key);
  }
  return groupsFromMap(grouped, "functional");
}

function partialGroups(prestations: LoadedPrestation[]) {
  const grouped = new Map<string, LoadedPrestation[]>();
  for (const prestation of prestations) {
    const signature = partialDuplicateKey(prestation);
    if (!signature) continue;
    const matches = grouped.get(signature) ?? [];
    matches.push(prestation);
    grouped.set(signature, matches);
  }
  for (const [key, matches] of grouped) {
    const amounts = new Set(matches.map(amountOf).map((amount) => amount.toFixed(2)));
    if (matches.length < 2 || amounts.size < 2) grouped.delete(key);
  }
  const groups: DuplicateGroup[] = [];
  for (const [key, matches] of grouped) {
    const ordered = [...matches].sort((left, right) => amountOf(left) - amountOf(right) || Number(left.id - right.id));
    groups.push({ key: `partial-${key}`, first: ordered[0], duplicate: ordered[1], occurrences: ordered.length, excess: ordered.slice(1).reduce((sum, item) => sum + amountOf(item), 0) });
  }
  return groups.sort((left, right) => right.excess - left.excess);
}

function crossFileGroups(current: LoadedPrestation[], external: LoadedPrestation[], predicate: (match: LoadedPrestation) => boolean) {
  const externalBySignature = signatureMap(external);
  const groups: DuplicateGroup[] = [];
  for (const prestation of current) {
    const signature = functionalDuplicateKey(prestation);
    if (!signature) continue;
    const matches = (externalBySignature.get(signature) ?? []).filter(predicate);
    if (!matches.length) continue;
    groups.push({ key: `${signature}-${prestation.id}`, first: prestation, duplicate: matches[0], occurrences: matches.length + 1, excess: matches.reduce((sum, item) => sum + amountOf(item), 0) });
  }
  return groups.sort((left, right) => right.excess - left.excess);
}

function signatureMap(prestations: LoadedPrestation[]) {
  const grouped = new Map<string, LoadedPrestation[]>();
  for (const prestation of prestations) {
    const signature = functionalDuplicateKey(prestation);
    if (!signature) continue;
    const matches = grouped.get(signature) ?? [];
    matches.push(prestation);
    grouped.set(signature, matches);
  }
  return grouped;
}

function groupsFromMap(grouped: Map<string, LoadedPrestation[]>, prefix: string) {
  const groups: DuplicateGroup[] = [];
  for (const [key, matches] of grouped) {
    if (matches.length < 2) continue;
    groups.push({ key: `${prefix}-${key}`, first: matches[0], duplicate: matches[1], occurrences: matches.length, excess: matches.slice(1).reduce((sum, item) => sum + amountOf(item), 0) });
  }
  return groups.sort((left, right) => right.excess - left.excess);
}

function KpiCard({ item }: { item: { icon: string; value: string; label: string; sub: string; color: string } }) { return <article className="relative overflow-hidden rounded-lg border border-line bg-white p-5 shadow-soft"><div className="mb-4 grid h-14 w-14 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: item.color }}>{item.icon}</div><h3 className="text-3xl font-black leading-none text-navy">{item.value}</h3><p className="mt-3 text-sm font-black text-navy">{item.label}</p><p className="text-xs font-semibold text-slate-500">{item.sub}</p><div className="absolute bottom-0 left-4 right-4 h-1" style={{ backgroundColor: item.color }}/></article>; }
function Pagination({ currentPage, totalPages, fileId, type }: { currentPage: number; totalPages: number; fileId: number; type: DuplicateType }) { return <nav className="mt-5 flex flex-wrap items-center justify-center gap-2"><PageLink disabled={currentPage === 1} fileId={fileId} label="Précédent" page={currentPage - 1} type={type}/>{paginationPages(currentPage, totalPages).map((page, index) => page === "…" ? <span className="px-2 text-slate-400" key={`e-${index}`}>…</span> : <PageLink active={page === currentPage} fileId={fileId} key={page} label={String(page)} page={page} type={type}/>)}<PageLink disabled={currentPage === totalPages} fileId={fileId} label="Suivant" page={currentPage + 1} type={type}/></nav>; }
function PageLink({ page, fileId, label, type, active = false, disabled = false }: { page: number; fileId: number; label: string; type: DuplicateType; active?: boolean; disabled?: boolean }) { const style = `rounded-md px-4 py-2 text-sm font-black ${active ? "bg-sky text-white" : disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "border border-line bg-white text-navy hover:border-sky"}`; return disabled ? <span className={style}>{label}</span> : <a className={style} href={`/rapports/doublons?fichier=${fileId}&type=${type}&page=${page}`}>{label}</a>; }
function paginationPages(current: number, total: number): Array<number | "…"> { if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1); const pages: Array<number | "…"> = [1]; if (current > 4) pages.push("…"); for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page); if (current < total - 3) pages.push("…"); pages.push(total); return pages; }
function ruleDescription(type: DuplicateType) { return type === "fonctionnel" ? "Même bénéficiaire, date, acte, prestataire et montant. Le numéro de prestation n'est pas utilisé comme critère bloquant." : type === "partiel" ? "Même bénéficiaire, date, acte et prestataire, mais avec des montants différents." : type === "inter-mois" ? "Même signature fonctionnelle trouvée dans un autre mois de la compagnie." : "Même signature fonctionnelle trouvée dans un fichier rattaché à un autre gestionnaire."; }
function amountOf(prestation: LoadedPrestation) { return Number(prestation.montantPaye || prestation.montantReclame); }
function partialDuplicateKey(prestation: LoadedPrestation) {
  const beneficiary = normalize(prestation.matriculeBeneficiaire) || normalize(`${prestation.nomBeneficiaire ?? ""} ${prestation.prenomsBeneficiaire ?? ""}`);
  const act = normalize(prestation.codeActe) || normalize(prestation.acte);
  const provider = normalize(prestation.codePrestataire) || normalize(prestation.prestataire);
  const date = prestation.dateSoins ? prestation.dateSoins.toISOString().slice(0, 10) : "";
  if (!beneficiary || !date || !act || !provider) return null;
  return [beneficiary, date, act, provider].join("|");
}
function normalize(value: string | null) { return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, " "); }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function monthLabel(month: number, year: number) { return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))); }
function fullManagerName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
