import { FileDown, Filter, Layers, Printer, Settings2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PrintReportButton } from "@/components/print-report-button";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const duplicateCodes = ["DOUBLON_FONCTIONNEL", "DOUBLON_PARTIEL", "DOUBLON_INTER_MOIS", "DOUBLON_INTER_GESTIONNAIRE"];
const categories = ["INTEGRITE", "BENEFICIAIRE", "PRESTATAIRE", "DOUBLON", "FREQUENCE", "MONTANT", "ACTE", "TEMPOREL", "CONTRACTUEL", "STATISTIQUE"];
const categoryLabels: Record<string, string> = {
  INTEGRITE: "Intégrité",
  BENEFICIAIRE: "Bénéficiaires",
  PRESTATAIRE: "Prestataires",
  DOUBLON: "Doublons",
  FREQUENCE: "Fréquences",
  MONTANT: "Montants",
  ACTE: "Actes",
  TEMPOREL: "Temporels",
  CONTRACTUEL: "Contractuel",
  STATISTIQUE: "Statistique",
};

export default async function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const user = await getCurrentUser();
  const params = parseParams(searchParams);
  const companyId = user.role === "super_admin" ? params.compagnieId : user.compagnieId;
  const baseCompanyWhere = user.role === "super_admin" ? {} : { compagnieId: user.compagnieId };

  const [companies, branches, managers, exercises] = await Promise.all([
    prisma.compagnie.findMany({ where: user.role === "super_admin" ? {} : { id: user.compagnieId }, orderBy: { nom: "asc" } }),
    prisma.filiale.findMany({ where: companyId ? { compagnieId: companyId } : baseCompanyWhere, orderBy: { nom: "asc" } }),
    prisma.gestionnaire.findMany({ where: companyId ? { compagnieId: companyId } : baseCompanyWhere, orderBy: { nom: "asc" } }),
    prisma.exerciceComptable.findMany({ where: companyId ? { compagnieId: companyId } : baseCompanyWhere, orderBy: { dateDebut: "desc" } }),
  ]);

  const fileWhere = {
    ...(companyId ? { compagnieId: companyId } : baseCompanyWhere),
    ...(params.filialeId ? { filialeId: params.filialeId } : {}),
    ...(params.gestionnaireId ? { gestionnaireId: params.gestionnaireId } : {}),
    ...(params.exerciceId ? { exerciceId: params.exerciceId } : {}),
    ...(params.debut || params.finEnd ? { dateImport: { gte: params.debut ?? undefined, lte: params.finEnd ?? undefined } } : {}),
  };
  const availableFiles = await prisma.fichierImporte.findMany({
    where: fileWhere,
    include: { compagnie: true, filiale: true, gestionnaire: true, exercice: true },
    orderBy: [{ anneeFichier: "desc" }, { moisFichier: "desc" }, { dateImport: "desc" }],
    take: 120,
  });
  const selectedFiles = params.fileIds.length ? availableFiles.filter((file) => params.fileIds.includes(file.id)) : availableFiles;
  const selectedFileIds = selectedFiles.map((file) => file.id);
  const anomalyWhere = { fichierImporteId: selectedFileIds.length ? { in: selectedFileIds } : { in: [-1] }, codeAnomalie: { not: "DOUBLON_STRICT" } };
  const prestationWhere = { fichierImporteId: selectedFileIds.length ? { in: selectedFileIds } : { in: [-1] } };

  const [lineCount, amountAgg, anomalyCount, categoryGroups, severityGroups, duplicateCount, duplicateAmountAgg, managerGroups, policyGroups, familyGroups] = await Promise.all([
    prisma.prestation.count({ where: prestationWhere }),
    prisma.prestation.aggregate({ where: prestationWhere, _sum: { montantReclame: true, montantPaye: true } }),
    prisma.anomalie.count({ where: anomalyWhere }),
    prisma.anomalie.groupBy({ by: ["categorie"], where: anomalyWhere, _count: { id: true }, _sum: { montantImpacte: true } }),
    prisma.anomalie.groupBy({ by: ["gravite"], where: anomalyWhere, _count: { id: true }, _sum: { montantImpacte: true } }),
    prisma.anomalie.count({ where: { ...anomalyWhere, codeAnomalie: { in: duplicateCodes } } }),
    prisma.anomalie.aggregate({ where: { ...anomalyWhere, codeAnomalie: { in: duplicateCodes } }, _sum: { montantImpacte: true } }),
    prisma.prestation.groupBy({ by: ["gestionnaireId"], where: prestationWhere, _count: { id: true }, _sum: { montantReclame: true } }),
    prisma.prestation.groupBy({ by: ["police", "souscripteur"], where: prestationWhere, _count: { id: true }, _sum: { montantReclame: true }, orderBy: { _count: { id: "desc" } }, take: 12 }),
    prisma.prestation.groupBy({ by: ["famillePrestation"], where: prestationWhere, _count: { id: true }, _sum: { montantReclame: true }, orderBy: { _count: { id: "desc" } }, take: 12 }),
  ]);
  const anomalyRate = lineCount ? (anomalyCount / lineCount) * 100 : 0;
  const exportQuery = buildExportQuery(params, selectedFileIds, companyId);
  const singleFileReport = selectedFileIds.length === 1 ? `/rapport-complet?fichier=${selectedFileIds[0]}` : "";
  const managerNames = new Map(managers.map((manager) => [manager.id, fullName(manager.prenoms, manager.nom)]));

  return (
    <AppShell title="Générateur de rapport d'audit" subtitle="Audit / Rapport paramétrable">
      <section className="card mb-6 overflow-hidden">
        <div className="flex items-center gap-3 bg-navy px-6 py-4 text-white">
          <Filter size={20} />
          <div><h2 className="text-lg font-black">Périmètre du rapport</h2><p className="text-xs font-semibold text-blue-100">Par gestionnaire, exercice, fichiers, période, filiale ou compagnie</p></div>
        </div>
        <form className="grid gap-4 p-5 lg:grid-cols-4" method="get">
          {user.role === "super_admin" && <Select label="Compagnie" name="compagnie" value={String(companyId ?? "")} options={companies.map((item) => ({ value: item.id, label: item.nom }))} />}
          <Select label="Exercice" name="exercice" value={String(params.exerciceId ?? "")} options={exercises.map((item) => ({ value: item.id, label: item.codeExercice }))} />
          <Select label="Filiale" name="filiale" value={String(params.filialeId ?? "")} options={branches.map((item) => ({ value: item.id, label: item.nom }))} />
          <Select label="Gestionnaire" name="gestionnaire" value={String(params.gestionnaireId ?? "")} options={managers.map((item) => ({ value: item.id, label: fullName(item.prenoms, item.nom) }))} />
          <label><span className="mb-1 block text-xs font-black uppercase text-slate-500">Début import</span><input className="input" defaultValue={params.debutRaw} name="debut" type="date" /></label>
          <label><span className="mb-1 block text-xs font-black uppercase text-slate-500">Fin import</span><input className="input" defaultValue={params.finRaw} name="fin" type="date" /></label>
          <div className="lg:col-span-2">
            <span className="mb-1 block text-xs font-black uppercase text-slate-500">Fichiers de prestations</span>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-line bg-white p-2">
              {availableFiles.length === 0 ? <p className="px-2 py-3 text-sm font-semibold text-slate-500">Aucun fichier sur ce périmètre.</p> : availableFiles.map((file) => {
                const checked = params.fileIds.length ? params.fileIds.includes(file.id) : true;
                return <label className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold hover:bg-sky/10" key={file.id}><input defaultChecked={checked} name="fichier" type="checkbox" value={file.id} /><span>{monthLabel(file.moisFichier, file.anneeFichier)} · {file.nomFichier} · {file.gestionnaire.nom}</span></label>;
              })}
            </div>
          </div>
          <div className="flex items-end gap-3 lg:col-span-4">
            <button className="btn inline-flex items-center gap-2"><Settings2 size={17} /> Appliquer</button>
            <a className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white" href={`/api/exports/doublons?${exportQuery}`}><FileDown className="inline" size={17} /> Export Excel doublons</a>
            {singleFileReport ? <a className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white" href={singleFileReport}><Printer className="inline" size={17} /> Rapport PDF fichier</a> : <PrintReportButton />}
          </div>
        </form>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Fichiers" value={formatNumber(selectedFiles.length)} />
        <Kpi label="Lignes" value={formatNumber(lineCount)} />
        <Kpi label="Montant réclamé" value={formatMoney(Number(amountAgg._sum.montantReclame ?? 0))} />
        <Kpi label="Anomalies" value={formatNumber(anomalyCount)} tone="red" />
        <Kpi label="Taux anomalie" value={`${anomalyRate.toFixed(1)}%`} tone="orange" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Panel title="Structure recommandée du rapport">
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ["S1 Synthèse", "KPIs, gravités, score global, taux anomalie, top catégories."],
                ["S3 Tardifs", "Délai appliqué, jours de retard, motif précis."],
                ["S4 Doublons", "Fonctionnels, inter-mois, partiels, sans stricts."],
                ["S7 Montants", "Hors tarif, plafonds acte/famille/individuel par police + collège."],
                ["S9 Fréquences", "Dépassements mensuels par acte et famille avec action."],
                ["S13 Polices", "Récap police/souscripteur, taux anomalie, drill-down."],
                ["S14 Familles", "Volume, montant, taux anomalie par famille."],
                ["S15 Recommandation", "Document officiel signé, décompte détaillé."],
              ].map(([title, text]) => <div className="rounded-lg border border-line bg-white p-4" key={title}><h3 className="font-black text-navy">{title}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{text}</p></div>)}
            </div>
          </Panel>

          <Panel title="Récapitulatif par catégorie">
            <table className="table">
              <thead><tr><th>Catégorie</th><th>Nombre</th><th>Montant impacté</th><th>Poids</th></tr></thead>
              <tbody>{categories.map((category) => {
                const row = categoryGroups.find((item) => item.categorie === category);
                const count = row?._count.id ?? 0;
                const amount = Number(row?._sum.montantImpacte ?? 0);
                return <tr key={category}><td className="font-black text-navy">{categoryLabels[category]}</td><td>{formatNumber(count)}</td><td>{formatMoney(amount)}</td><td>{anomalyCount ? `${((count / anomalyCount) * 100).toFixed(1)}%` : "0.0%"}</td></tr>;
              })}</tbody>
            </table>
          </Panel>

          <Panel title="Récapitulatif par gestionnaire">
            <table className="table">
              <thead><tr><th>Gestionnaire</th><th>Lignes</th><th>Montant réclamé</th></tr></thead>
              <tbody>{managerGroups.map((row) => <tr key={row.gestionnaireId}><td className="font-black text-navy">{managerNames.get(row.gestionnaireId) ?? `Gestionnaire ${row.gestionnaireId}`}</td><td>{formatNumber(row._count.id)}</td><td>{formatMoney(Number(row._sum.montantReclame ?? 0))}</td></tr>)}</tbody>
            </table>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Extraction doublons">
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm font-black text-red-700">{formatNumber(duplicateCount)} doublons repérés</p>
              <p className="mt-1 text-2xl font-black text-red-600">{formatMoney(Number(duplicateAmountAgg._sum.montantImpacte ?? 0))}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Fonctionnels + inter-mois + partiels + inter-gestionnaires</p>
            </div>
            <a className="mt-4 block rounded-lg bg-emerald-600 px-5 py-4 text-center font-black text-white" href={`/api/exports/doublons?${exportQuery}`}>Télécharger la liste Excel</a>
          </Panel>

          <Panel title="Paramètres utiles à ajouter">
            <ul className="space-y-2 text-sm font-semibold text-slate-600">
              <li>Type de date pour la période : import, soins ou comptable.</li>
              <li>Inclure ou exclure les prestations tardives dans les doublons.</li>
              <li>Seuils de fréquence par acte/famille.</li>
              <li>Plafonds par police, collège, acte, famille, bénéficiaire.</li>
              <li>Niveau de détail : synthèse, audit détaillé, annexes Excel.</li>
              <li>Statut du rapport : brouillon, validé auditeur, transmis compagnie.</li>
            </ul>
          </Panel>

          <Panel title="Gravités">
            <table className="table">
              <tbody>{severityGroups.map((row) => <tr key={row.gravite}><td className="font-black text-navy">{severityLabel(row.gravite)}</td><td>{formatNumber(row._count.id)}</td><td>{formatMoney(Number(row._sum.montantImpacte ?? 0))}</td></tr>)}</tbody>
            </table>
          </Panel>
        </aside>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="S13 Polices / souscripteurs">
          <table className="table"><thead><tr><th>Police</th><th>Souscripteur</th><th>Lignes</th><th>Montant</th></tr></thead><tbody>{policyGroups.map((row, index) => <tr key={`${row.police}-${row.souscripteur}-${index}`}><td>{row.police ?? "Sans police"}</td><td>{row.souscripteur ?? "Sans souscripteur"}</td><td>{formatNumber(row._count.id)}</td><td>{formatMoney(Number(row._sum.montantReclame ?? 0))}</td></tr>)}</tbody></table>
        </Panel>
        <Panel title="S14 Familles de prestation">
          <table className="table"><thead><tr><th>Famille</th><th>Volume</th><th>Montant</th><th>% volume</th></tr></thead><tbody>{familyGroups.map((row, index) => <tr key={`${row.famillePrestation}-${index}`}><td>{row.famillePrestation ?? "Sans famille"}</td><td>{formatNumber(row._count.id)}</td><td>{formatMoney(Number(row._sum.montantReclame ?? 0))}</td><td>{lineCount ? `${((row._count.id / lineCount) * 100).toFixed(1)}%` : "0.0%"}</td></tr>)}</tbody></table>
        </Panel>
      </section>
    </AppShell>
  );
}

function Select({ label, name, value, options }: { label: string; name: string; value: string; options: Array<{ value: number; label: string }> }) {
  return <label><span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span><select className="input" defaultValue={value} name={name}><option value="">Tous</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card overflow-hidden"><div className="border-b border-line px-5 py-4"><h2 className="text-lg font-black text-navy">{title}</h2></div><div className="p-5">{children}</div></section>;
}

function Kpi({ label, value, tone = "sky" }: { label: string; value: string; tone?: string }) {
  const colors: Record<string, string> = { sky: "border-sky text-sky", red: "border-red-500 text-red-600", orange: "border-orange-500 text-orange-600" };
  return <article className={`rounded-lg border-l-4 bg-white p-5 shadow-soft ${colors[tone]}`}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>;
}

function parseParams(searchParams?: Record<string, string | string[] | undefined>) {
  const files = arrayParam(searchParams?.fichier).map(Number).filter((item) => Number.isInteger(item) && item > 0);
  const debutRaw = stringParam(searchParams?.debut);
  const finRaw = stringParam(searchParams?.fin);
  return {
    compagnieId: numberParam(searchParams?.compagnie),
    filialeId: numberParam(searchParams?.filiale),
    gestionnaireId: numberParam(searchParams?.gestionnaire),
    exerciceId: numberParam(searchParams?.exercice),
    fileIds: files,
    debutRaw,
    finRaw,
    debut: dateStart(debutRaw),
    finEnd: dateEnd(finRaw),
  };
}

function buildExportQuery(params: ReturnType<typeof parseParams>, fileIds: number[], companyId?: number) {
  const query = new URLSearchParams();
  if (companyId) query.set("compagnie", String(companyId));
  if (params.filialeId) query.set("filiale", String(params.filialeId));
  if (params.gestionnaireId) query.set("gestionnaire", String(params.gestionnaireId));
  if (params.exerciceId) query.set("exercice", String(params.exerciceId));
  if (params.debutRaw) query.set("debut", params.debutRaw);
  if (params.finRaw) query.set("fin", params.finRaw);
  if (fileIds.length) query.set("fichiers", fileIds.join(","));
  return query.toString();
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function arrayParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function numberParam(value: string | string[] | undefined) {
  const number = Number(stringParam(value));
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function dateStart(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateEnd(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function fullName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function monthLabel(month: number, year: number) { return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))); }
function severityLabel(value: string) { return value === "critique" ? "Critique" : value === "eleve" ? "Élevée" : value === "moyen" ? "Moyenne" : "Faible"; }
