import type { Gravite } from "@prisma/client";
import { PrintReportButton } from "@/components/print-report-button";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const severityLabels: Record<string, string> = { critique: "Critique", eleve: "Élevée", moyen: "Moyenne", faible: "Faible" };
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
  STATISTIQUE: "Statistiques",
};
const codeLabels: Record<string, string> = {
  CHAMPS_IMPORTANTS_MANQUANTS: "Champs importants manquants",
  BENEFICIAIRE_REFERENTIEL: "Bénéficiaires hors référentiel",
  PRESTATAIRE_REFERENTIEL: "Prestataires hors référentiel",
  ACTE_NON_COUVERT: "Actes non couverts",
  REPETITION_ACTE: "Fréquence excessive",
  DEPASSEMENT_TARIF: "Hors tarif",
  MONTANT_PAYE_SUPERIEUR: "Payé > réclamé",
  MONTANT_NEGATIF: "Montant négatif",
  PLAFOND_ACTE: "Plafond / acte",
  PLAFOND_FAMILLE: "Plafond / famille",
  PLAFOND_INDIVIDUEL: "Plafond individuel",
  HORS_EXERCICE: "Hors exercice",
  DELAI_TARDIF_DEPASSE: "Délai tardif dépassé",
  DATE_SOINS_FUTURE: "Date de soins future",
  ECART_DATE_EXCESSIF: "Écart de dates excessif",
  DOUBLON_FONCTIONNEL: "Doublon fonctionnel",
  DOUBLON_PARTIEL: "Doublon partiel",
  DOUBLON_INTER_MOIS: "Doublon inter-mois",
  DOUBLON_INTER_GESTIONNAIRE: "Doublon inter-gestionnaire",
};
const pageSize = 80;

export default async function Page(props: { searchParams?: Promise<{ fichier?: string }> }) {
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
    return <main className="mx-auto max-w-5xl p-8"><section className="card p-12 text-center"><h1 className="text-2xl font-black text-navy">Aucun audit disponible</h1><p className="mt-2 text-sm font-semibold text-slate-500">Importez un fichier pour générer le rapport complet.</p><a className="btn mt-6 inline-block" href="/import">Importer un fichier</a></section></main>;
  }

  const [prestations, anomalies] = await Promise.all([
    prisma.prestation.findMany({ where: { fichierImporteId: file.id }, orderBy: { id: "asc" } }),
    prisma.anomalie.findMany({ where: { fichierImporteId: file.id, codeAnomalie: { not: "DOUBLON_STRICT" } }, include: { prestation: true }, orderBy: [{ categorie: "asc" }, { montantImpacte: "desc" }] }),
  ]);

  const anomalyByPrestation = new Map<string, typeof anomalies>();
  for (const anomaly of anomalies) {
    if (!anomaly.prestationId) continue;
    const key = anomaly.prestationId.toString();
    anomalyByPrestation.set(key, [...(anomalyByPrestation.get(key) ?? []), anomaly]);
  }

  const totalClaimed = Number(file.montantTotalReclame) || prestations.reduce((sum, item) => sum + Number(item.montantReclame), 0);
  const impactedPrestations = anomalyByPrestation.size;
  const anomalyRate = prestations.length ? (impactedPrestations / prestations.length) * 100 : 0;
  const globalScore = Math.max(0, Math.round(100 - anomalyRate * 2));
  const severityRows = groupBy(anomalies, (item) => item.gravite).map(([severity, rows]) => ({ severity, count: rows.length, amount: sum(rows, (item) => Number(item.montantImpacte)) }));
  const categoryRows = groupBy(anomalies, (item) => item.categorie).map(([category, rows]) => ({ category, count: rows.length, amount: sum(rows, (item) => Number(item.montantImpacte)) })).sort((a, b) => b.amount - a.amount || b.count - a.count);
  const topCategories = categoryRows.slice(0, 10);
  const tardifs = anomalies.filter((item) => ["HORS_EXERCICE", "DELAI_TARDIF_DEPASSE", "DATE_SOINS_FUTURE", "ECART_DATE_EXCESSIF"].includes(item.codeAnomalie));
  const doublons = anomalies.filter((item) => ["DOUBLON_FONCTIONNEL", "DOUBLON_PARTIEL", "DOUBLON_INTER_MOIS", "DOUBLON_INTER_GESTIONNAIRE"].includes(item.codeAnomalie));
  const montants = anomalies.filter((item) => item.categorie === "MONTANT");
  const frequencies = anomalies.filter((item) => item.categorie === "FREQUENCE");
  const policies = policyRows(prestations, anomalyByPrestation);
  const families = familyRows(prestations, anomalyByPrestation);
  const recommendation = recommendationRows(prestations, anomalies, totalClaimed);
  const reference = `AUD-${file.anneeFichier}-${String(file.moisFichier).padStart(2, "0")}-${file.id}`;
  const signature = simpleSignature(`${reference}:${user.id}:${recommendation.net}:${anomalies.length}`);

  return (
    <main className="min-h-screen bg-[#eef8fc] px-5 py-6 text-navy print:bg-white print:px-0 print:py-0">
      <style>{`@page{size:A4;margin:12mm}.report-page{break-after:page}.report-page:last-child{break-after:auto}@media print{.shadow-soft,.card{box-shadow:none!important}body{background:white!important}}`}</style>
      <div className="mx-auto mb-5 flex max-w-[1180px] flex-wrap items-center justify-between gap-3 print:hidden">
        <a className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white" href={`/synthese?fichier=${file.id}`}>Retour synthèse</a>
        <PrintReportButton />
      </div>

      <article className="mx-auto max-w-[1180px] space-y-5 print:max-w-none print:space-y-0">
        <ReportPage title="S1 — Synthèse audit" subtitle={`${file.compagnie.nom} · ${file.filiale.nom} · ${file.nomFichier}`}>
          <Header file={file} reference={reference} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Score global" value={`${globalScore}/100`} tone="sky" />
            <Kpi label="Taux anomalie" value={`${anomalyRate.toFixed(1)}%`} tone="red" />
            <Kpi label="Lignes" value={formatNumber(prestations.length)} tone="navy" />
            <Kpi label="Anomalies" value={formatNumber(anomalies.length)} tone="orange" />
            <Kpi label="Net recommandé" value={formatMoney(recommendation.net)} tone="emerald" />
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <Panel title="Gravités">
              <SimpleTable headers={["Gravité", "Nb", "Montant"]} rows={severityRows.map((row) => [severityLabels[row.severity] ?? row.severity, formatNumber(row.count), formatMoney(row.amount)])} />
            </Panel>
            <Panel title="Récap 10 catégories">
              <SimpleTable headers={["Catégorie", "Nb", "Montant", "Poids"]} rows={topCategories.map((row) => [categoryLabels[row.category] ?? row.category, formatNumber(row.count), formatMoney(row.amount), percent(row.count, anomalies.length)])} />
            </Panel>
          </div>
          <Panel className="mt-5" title="Graphique de répartition">
            <div className="space-y-2">{topCategories.map((row) => <Bar key={row.category} label={categoryLabels[row.category] ?? row.category} value={row.count} max={Math.max(...topCategories.map((item) => item.count), 1)} />)}</div>
          </Panel>
        </ReportPage>

        <ReportPage title="S3 — Tardifs" subtitle="Liste complète avec délai tardif appliqué, jours de retard et motif précis">
          <InfoStrip items={[["Tolérance appliquée", toleranceLabel(file.exercice.dateDebutToleranceTardif, file.exercice.dateFinToleranceTardif)], ["Hors exercice", `${formatDate(file.exercice.dateDebut)} → ${formatDate(file.exercice.dateFin)}`], ["Montant concerné", formatMoney(sum(tardifs, (item) => Number(item.montantImpacte)))]]} />
          <DetailedTable headers={["Prestation", "Bénéficiaire", "Date soins", "Date comptable", "Jours", "Motif", "Montant"]} rows={tardifs.slice(0, pageSize).map((item) => {
            const p = item.prestation;
            return [prestationRef(p, item.id), p?.nomBeneficiaire ?? p?.matriculeBeneficiaire ?? "-", dateOrDash(p?.dateSoins), dateOrDash(p?.dateComptable), tardyDays(item, file), item.description ?? codeLabels[item.codeAnomalie] ?? item.codeAnomalie, formatMoney(Number(item.montantImpacte))];
          })} />
        </ReportPage>

        <ReportPage title="S4 — Doublons" subtitle="Fonctionnels, inter-mois, partiels — sans stricts">
          <InfoStrip items={[["Fonctionnels", formatNumber(doublons.filter((item) => item.codeAnomalie === "DOUBLON_FONCTIONNEL").length)], ["Inter-mois", formatNumber(doublons.filter((item) => item.codeAnomalie === "DOUBLON_INTER_MOIS").length)], ["Partiels", formatNumber(doublons.filter((item) => item.codeAnomalie === "DOUBLON_PARTIEL").length)], ["Impact", formatMoney(sum(doublons, (item) => Number(item.montantImpacte)))]]} />
          <DetailedTable headers={["Type", "Qualification", "Bénéficiaire", "Date", "Acte", "Prestataire", "Impact"]} rows={doublons.slice(0, pageSize).map((item) => {
            const p = item.prestation;
            return [codeLabels[item.codeAnomalie] ?? item.codeAnomalie, duplicateQualification(item, anomalyByPrestation), p?.nomBeneficiaire ?? p?.matriculeBeneficiaire ?? "-", dateOrDash(p?.dateSoins), p?.acte ?? p?.codeActe ?? "-", p?.prestataire ?? p?.codePrestataire ?? "-", formatMoney(Number(item.montantImpacte))];
          })} />
        </ReportPage>

        <ReportPage title="S7 — Montants" subtitle="Hors tarif, plafonds et contrôles paramétrés par police + collège">
          <InfoStrip items={["DEPASSEMENT_TARIF", "PLAFOND_ACTE", "PLAFOND_FAMILLE", "PLAFOND_INDIVIDUEL", "MONTANT_PAYE_SUPERIEUR"].map((code) => [codeLabels[code] ?? code, `${formatNumber(montants.filter((item) => item.codeAnomalie === code).length)} · ${formatMoney(sum(montants.filter((item) => item.codeAnomalie === code), (item) => Number(item.montantImpacte)))}`])} />
          <DetailedTable headers={["Règle", "Police", "Collège", "Bénéficiaire", "Acte/Famille", "Réclamé", "Impact"]} rows={montants.slice(0, pageSize).map((item) => {
            const p = item.prestation;
            return [codeLabels[item.codeAnomalie] ?? item.codeAnomalie, p?.police ?? "-", p?.college ?? p?.numeroCollege ?? "-", p?.nomBeneficiaire ?? "-", p?.acte ?? p?.famillePrestation ?? p?.codeActe ?? "-", formatMoney(Number(p?.montantReclame ?? 0)), formatMoney(Number(item.montantImpacte))];
          })} />
        </ReportPage>

        <ReportPage title="S9 — Fréquences" subtitle="Dépassements mensuels par acte et par famille, action par règle">
          <DetailedTable headers={["Bénéficiaire", "Acte", "Famille", "Mois", "Montant", "Gravité", "Action"]} rows={frequencies.slice(0, pageSize).map((item) => {
            const p = item.prestation;
            return [p?.nomBeneficiaire ?? p?.matriculeBeneficiaire ?? "-", p?.acte ?? p?.codeActe ?? "-", p?.famillePrestation ?? "-", monthLabel(file.moisFichier, file.anneeFichier), formatMoney(Number(item.montantImpacte)), severityLabels[item.gravite] ?? item.gravite, item.gravite === "critique" ? "REJETER" : "ALERTER"];
          })} />
        </ReportPage>

        <ReportPage title="S13 — Polices" subtitle="Récap par police/souscripteur avec taux anomalie et drill-down">
          <DetailedTable headers={["Police", "Souscripteur", "Lignes", "Montant", "Anomalies", "Taux"]} rows={policies.slice(0, pageSize).map((row) => [row.police, row.souscripteur, formatNumber(row.count), formatMoney(row.amount), formatNumber(row.anomalies), percent(row.anomalies, row.count)])} />
        </ReportPage>

        <ReportPage title="S14 — Familles" subtitle="Répartition par famille de prestation, volume et taux anomalie">
          <DetailedTable headers={["Famille", "Volume", "% volume", "Montant", "Anomalies", "Taux anomalie"]} rows={families.slice(0, pageSize).map((row) => [row.family, formatNumber(row.count), percent(row.count, prestations.length), formatMoney(row.amount), formatNumber(row.anomalies), percent(row.anomalies, row.count)])} />
        </ReportPage>

        <ReportPage title="S15 — Recommandation officielle" subtitle="Document signé avec décompte détaillé">
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <Panel title="Décompte détaillé">
              <SimpleTable headers={["Nature rejet", "Nb", "Montant", "% total"]} rows={recommendation.rows.map((row) => [codeLabels[row.code] ?? humanize(row.code), formatNumber(row.count), formatMoney(row.amount), percent(row.amount, totalClaimed)])} />
            </Panel>
            <Panel title="Décision financière">
              <FinanceLine label="Montant total réclamé" value={formatMoney(totalClaimed)} />
              <FinanceLine label="Total rejets recommandés" value={`- ${formatMoney(recommendation.rejected)}`} color="text-red-600" />
              <FinanceLine label="Montant net à payer" value={formatMoney(recommendation.net)} color="text-emerald-700" big />
              <div className="mt-5 rounded-lg bg-navy p-4 text-white">
                <p className="text-xs font-black uppercase text-sky">Signature de contrôle</p>
                <p className="mt-2 break-all text-sm font-black">{signature}</p>
                <p className="mt-3 text-xs font-semibold text-blue-100">Généré par {user.name} · {formatDate(new Date())}</p>
              </div>
            </Panel>
          </div>
        </ReportPage>
      </article>
    </main>
  );
}

function Header({ file, reference }: { file: any; reference: string }) {
  return <div className="mb-5 rounded-lg bg-navy p-5 text-white"><h1 className="text-2xl font-black">RAPPORT COMPLET D'AUDIT CRYSTAL</h1><p className="mt-2 text-sm font-semibold text-blue-100">{file.compagnie.nom} · {file.filiale.nom} · {fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom)} · {monthLabel(file.moisFichier, file.anneeFichier)}</p><p className="mt-1 text-xs font-semibold text-blue-200">Référence : {reference} · Exercice {formatDate(file.exercice.dateDebut)} au {formatDate(file.exercice.dateFin)}</p></div>;
}
function ReportPage({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="report-page card mb-5 min-h-[1060px] p-6 print:mb-0 print:min-h-0 print:rounded-none print:border-0"><div className="mb-5 border-b border-line pb-3"><h2 className="text-2xl font-black text-navy">{title}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p></div>{children}</section>; }
function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) { return <section className={`rounded-lg border border-line bg-white p-4 ${className}`}><h3 className="mb-3 text-lg font-black text-navy">{title}</h3>{children}</section>; }
function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) { const colors: Record<string, string> = { sky: "border-sky text-sky", red: "border-red-500 text-red-600", navy: "border-navy text-navy", orange: "border-orange-500 text-orange-600", emerald: "border-emerald-600 text-emerald-700" }; return <div className={`rounded-lg border-l-4 bg-white p-4 shadow-soft ${colors[tone]}`}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function SimpleTable({ headers, rows }: { headers: string[]; rows: Array<Array<React.ReactNode>> }) { return <table className="table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td className="text-center text-slate-500" colSpan={headers.length}>Aucune donnée.</td></tr>}</tbody></table>; }
function DetailedTable(props: { headers: string[]; rows: Array<Array<React.ReactNode>> }) { return <div className="overflow-hidden rounded-lg border border-line bg-white"><SimpleTable {...props} /></div>; }
function InfoStrip({ items }: { items: string[][] }) { return <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">{items.map(([label, value]) => <div className="rounded-lg border border-line bg-white p-4" key={label}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-lg font-black text-navy">{value}</p></div>)}</div>; }
function Bar({ label, value, max }: { label: string; value: number; max: number }) { return <div><div className="mb-1 flex justify-between text-xs font-black text-slate-600"><span>{label}</span><span>{formatNumber(value)}</span></div><div className="h-3 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-sky" style={{ width: `${Math.max(4, value / max * 100)}%` }} /></div></div>; }
function FinanceLine({ label, value, color = "text-navy", big = false }: { label: string; value: string; color?: string; big?: boolean }) { return <div className="flex items-center justify-between border-b border-line py-4"><span className="font-bold text-slate-600">{label}</span><b className={`${color} ${big ? "text-2xl" : "text-lg"}`}>{value}</b></div>; }
function policyRows(prestations: any[], anomalyByPrestation: Map<string, unknown[]>) { return [...groupBy(prestations, (item) => `${item.police ?? "Sans police"}|${item.souscripteur ?? "Sans souscripteur"}`)].map(([key, rows]) => { const [police, souscripteur] = key.split("|"); return { police, souscripteur, count: rows.length, amount: sum(rows, (item) => Number(item.montantReclame)), anomalies: rows.filter((item) => anomalyByPrestation.has(item.id.toString())).length }; }).sort((a, b) => b.anomalies - a.anomalies || b.amount - a.amount); }
function familyRows(prestations: any[], anomalyByPrestation: Map<string, unknown[]>) { return [...groupBy(prestations, (item) => item.famillePrestation ?? "Sans famille")].map(([family, rows]) => ({ family, count: rows.length, amount: sum(rows, (item) => Number(item.montantReclame)), anomalies: rows.filter((item) => anomalyByPrestation.has(item.id.toString())).length })).sort((a, b) => b.count - a.count); }
function recommendationRows(prestations: any[], anomalies: any[], totalClaimed: number) { const prestationById = new Map(prestations.map((item) => [item.id.toString(), item])); const primary = new Map<string, any>(); for (const anomaly of anomalies) { if (!anomaly.prestationId) continue; const key = anomaly.prestationId.toString(); const prestation = prestationById.get(key); const amount = recommendedRejection(anomaly.codeAnomalie, Number(anomaly.montantImpacte), amountOf(prestation)); if (amount <= 0) continue; const current = primary.get(key); const currentAmount = current ? recommendedRejection(current.codeAnomalie, Number(current.montantImpacte), amountOf(prestation)) : -1; if (!current || amount > currentAmount) primary.set(key, anomaly); } const grouped = new Map<string, { code: string; count: number; amount: number }>(); for (const [prestationId, anomaly] of primary) { const prestation = prestationById.get(prestationId); const amount = recommendedRejection(anomaly.codeAnomalie, Number(anomaly.montantImpacte), amountOf(prestation)); const row = grouped.get(anomaly.codeAnomalie) ?? { code: anomaly.codeAnomalie, count: 0, amount: 0 }; row.count += 1; row.amount += amount; grouped.set(anomaly.codeAnomalie, row); } const rows = [...grouped.values()].sort((a, b) => b.amount - a.amount); const rejected = Math.min(totalClaimed, sum(rows, (item) => item.amount)); return { rows, rejected, net: Math.max(0, totalClaimed - rejected) }; }
function recommendedRejection(code: string, impact: number, prestationAmount: number) { const full = new Set(["DOUBLON_FONCTIONNEL", "DOUBLON_INTER_MOIS", "DOUBLON_INTER_GESTIONNAIRE", "HORS_EXERCICE", "DELAI_TARDIF_DEPASSE", "DATE_SOINS_FUTURE", "MONTANT_NEGATIF"]); const partial = new Set(["DOUBLON_PARTIEL", "DEPASSEMENT_TARIF", "MONTANT_PAYE_SUPERIEUR", "PLAFOND_ACTE", "PLAFOND_FAMILLE", "PLAFOND_INDIVIDUEL"]); if (full.has(code)) return Math.max(0, prestationAmount); if (partial.has(code)) return Math.max(0, Math.min(prestationAmount, impact)); return 0; }
function duplicateQualification(anomaly: any, anomalyByPrestation: Map<string, any[]>) { const rows = anomaly.prestationId ? anomalyByPrestation.get(anomaly.prestationId.toString()) ?? [] : []; const hasTardif = rows.some((item) => ["HORS_EXERCICE", "DELAI_TARDIF_DEPASSE"].includes(item.codeAnomalie)); return hasTardif ? "TARDIF + VALIDE" : "VALIDE"; }
function tardyDays(anomaly: any, file: any) { const p = anomaly.prestation; if (!p) return "-"; const toleranceStart = file.exercice.dateDebutToleranceTardif ? startOfDay(file.exercice.dateDebutToleranceTardif) : null; const toleranceEnd = file.exercice.dateFinToleranceTardif ? endOfDay(file.exercice.dateFinToleranceTardif) : null; if (anomaly.codeAnomalie === "DELAI_TARDIF_DEPASSE" && p.dateComptable && toleranceStart && p.dateComptable < toleranceStart) return `${Math.ceil((toleranceStart.getTime() - p.dateComptable.getTime()) / 86_400_000)}j`; if (anomaly.codeAnomalie === "DELAI_TARDIF_DEPASSE" && p.dateComptable && toleranceEnd && p.dateComptable > toleranceEnd) return `${Math.ceil((p.dateComptable.getTime() - toleranceEnd.getTime()) / 86_400_000)}j`; if (p.dateSoins && p.dateSoins < file.exercice.dateDebut) return `${Math.ceil((file.exercice.dateDebut.getTime() - p.dateSoins.getTime()) / 86_400_000)}j`; if (p.dateSoins && p.dateSoins > file.exercice.dateFin) return `${Math.ceil((p.dateSoins.getTime() - file.exercice.dateFin.getTime()) / 86_400_000)}j`; return "-"; }
function groupBy<T>(rows: T[], key: (row: T) => string) { const grouped = new Map<string, T[]>(); for (const row of rows) grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]); return [...grouped.entries()]; }
function sum<T>(rows: T[], value: (row: T) => number) { return rows.reduce((total, row) => total + value(row), 0); }
function amountOf(prestation?: any) { return Number(prestation?.montantPaye || prestation?.montantReclame || 0); }
function percent(value: number, total: number) { return total ? `${((value / total) * 100).toFixed(1)}%` : "0.0%"; }
function prestationRef(prestation: any, fallback: bigint | number) { return prestation?.numeroPrestation ?? `PRE-${prestation?.id ?? fallback}`; }
function dateOrDash(value?: Date | null) { return value ? formatDate(value) : "-"; }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function monthLabel(month: number, year: number) { return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))); }
function fullManagerName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
function humanize(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function simpleSignature(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return `CR-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`; }
function endOfDay(value: Date) { const date = new Date(value); date.setUTCHours(23, 59, 59, 999); return date; }
function startOfDay(value: Date) { const date = new Date(value); date.setUTCHours(0, 0, 0, 0); return date; }
function toleranceLabel(start: Date | null, end: Date | null) { return start && end ? `${formatDate(start)} → ${formatDate(end)}` : start ? `À partir du ${formatDate(start)}` : end ? `Jusqu'au ${formatDate(end)}` : "Non configurée"; }
