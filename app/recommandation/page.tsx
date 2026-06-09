import type { Gravite } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const codeLabels: Record<string, string> = {
  DOUBLON_FONCTIONNEL: "Doublons fonctionnels",
  DOUBLON_PARTIEL: "Doublons partiels",
  DOUBLON_INTER_MOIS: "Doublons inter-mois",
  DOUBLON_INTER_GESTIONNAIRE: "Doublons inter-gestionnaires",
  HORS_EXERCICE: "Prestations hors exercice",
  DELAI_TARDIF_DEPASSE: "Délai tardif dépassé",
  DATE_SOINS_FUTURE: "Dates de soins futures",
  ECART_DATE_EXCESSIF: "Écarts de dates excessifs",
  BENEFICIAIRE_REFERENTIEL: "Bénéficiaires hors référentiel",
  PRESTATAIRE_REFERENTIEL: "Prestataires hors référentiel",
  ACTE_NON_COUVERT: "Actes non couverts",
  DEPASSEMENT_TARIF: "Dépassements tarifaires",
  MONTANT_PAYE_SUPERIEUR: "Montants payés supérieurs",
  MONTANT_NEGATIF: "Montants négatifs",
  REPETITION_ACTE: "Répétitions d’actes",
  CHAMPS_IMPORTANTS_MANQUANTS: "Champs importants manquants",
};
const severityWeight: Record<Gravite, number> = { critique: 4, eleve: 3, moyen: 2, faible: 1 };

export default async function Page({ searchParams }: { searchParams?: { fichier?: string } }) {
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
    return <AppShell title="Recommandation de paiement — R15" subtitle="Audit / Rapport final">
      <section className="card p-12 text-center"><h2 className="text-2xl font-black text-navy">Aucun audit disponible</h2><p className="mt-2 text-sm font-semibold text-slate-500">Importez et analysez un fichier pour produire une recommandation de paiement.</p><a className="btn mt-6 inline-block" href="/import">Importer un fichier</a></section>
    </AppShell>;
  }

  const [prestations, anomalies] = await Promise.all([
    prisma.prestation.findMany({ where: { fichierImporteId: file.id }, select: { id: true, montantReclame: true, montantPaye: true } }),
    prisma.anomalie.findMany({ where: { fichierImporteId: file.id, codeAnomalie: { not: "DOUBLON_STRICT" } }, orderBy: [{ gravite: "asc" }, { montantImpacte: "desc" }] }),
  ]);
  const prestationById = new Map(prestations.map((item) => [item.id.toString(), item]));
  const primaryByPrestation = new Map<string, (typeof anomalies)[number]>();
  for (const anomaly of anomalies) {
    if (!anomaly.prestationId) continue;
    const key = anomaly.prestationId.toString();
    const prestation = prestationById.get(key);
    const candidateAmount = recommendedRejection(anomaly.codeAnomalie, Number(anomaly.montantImpacte), Number(prestation?.montantPaye || prestation?.montantReclame || 0));
    if (candidateAmount <= 0) continue;
    const current = primaryByPrestation.get(key);
    const currentAmount = current ? recommendedRejection(current.codeAnomalie, Number(current.montantImpacte), Number(prestation?.montantPaye || prestation?.montantReclame || 0)) : -1;
    if (!current || candidateAmount > currentAmount || (candidateAmount === currentAmount && severityWeight[anomaly.gravite] > severityWeight[current.gravite])) primaryByPrestation.set(key, anomaly);
  }
  const grouped = new Map<string, { code: string; count: number; amount: number; severity: Gravite }>();
  for (const [prestationId, anomaly] of primaryByPrestation) {
    const prestation = prestationById.get(prestationId);
    const amount = recommendedRejection(anomaly.codeAnomalie, Number(anomaly.montantImpacte), Number(prestation?.montantPaye || prestation?.montantReclame || 0));
    const current = grouped.get(anomaly.codeAnomalie) ?? { code: anomaly.codeAnomalie, count: 0, amount: 0, severity: anomaly.gravite };
    current.count += 1;
    current.amount += amount;
    if (severityWeight[anomaly.gravite] > severityWeight[current.severity]) current.severity = anomaly.gravite;
    grouped.set(anomaly.codeAnomalie, current);
  }
  const rows = [...grouped.values()].sort((left, right) => right.amount - left.amount || right.count - left.count);
  const totalClaimed = Number(file.montantTotalReclame) || prestations.reduce((sum, item) => sum + Number(item.montantReclame), 0);
  const totalRejected = Math.min(totalClaimed, rows.reduce((sum, item) => sum + item.amount, 0));
  const netRecommended = Math.max(0, totalClaimed - totalRejected);
  const savingRate = totalClaimed ? (totalRejected / totalClaimed) * 100 : 0;
  const verificationCount = new Set(anomalies.filter((anomaly) => anomaly.prestationId && recommendedRejection(anomaly.codeAnomalie, Number(anomaly.montantImpacte), Number(prestationById.get(anomaly.prestationId.toString())?.montantPaye || prestationById.get(anomaly.prestationId.toString())?.montantReclame || 0)) === 0).map((anomaly) => anomaly.prestationId!.toString())).size;
  const reference = `AUD-${file.anneeFichier}-${String(file.moisFichier).padStart(2, "0")}-${file.id}`;
  const signature = simpleSignature(`${reference}:${user.id}:${netRecommended}:${anomalies.length}`);

  return <AppShell title="Recommandation de paiement — R15" subtitle={`Audit / ${file.gestionnaire.nom} / Rapport final`}>
    <section className="mb-5 flex flex-wrap justify-end gap-3">
      <ModalForm title="Choisir l'audit" trigger={<button className="btn">Filtres</button>}>
        <form className="space-y-4 p-5">
          <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Audit à consulter</span><select className="input" defaultValue={file.id} name="fichier">{files.map((item) => <option key={item.id} value={item.id}>{item.nomFichier} · {item.filiale.nom} · {formatDate(item.dateImport)}</option>)}</select></label>
          <button className="w-full rounded-lg bg-sky px-5 py-3 text-sm font-black text-white">Générer la recommandation</button>
        </form>
      </ModalForm>
      <a className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white" href={`/synthese?fichier=${file.id}`}>Voir la synthèse</a>
      <a className="rounded-lg bg-sky px-5 py-3 text-sm font-black text-white" href={`/rapport-complet?fichier=${file.id}`}>Rapport PDF complet</a>
    </section>

    <section className="mb-5 rounded-lg bg-navy px-7 py-5 text-white">
      <h2 className="text-2xl font-black">RAPPORT FINAL DE RECOMMANDATION DE PAIEMENT</h2>
      <p className="mt-2 text-sm font-semibold text-blue-100">{fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom)} · Période : {monthLabel(file.moisFichier, file.anneeFichier)} · Filiale : {file.filiale.nom} · Réf : {reference}</p>
      <p className="mt-1 text-sm font-semibold text-blue-100">Responsable : {user.name} · Généré le {formatDate(new Date())} · Statut : {file.statut === "valide" ? "VALIDÉ" : "PROPOSITION"}</p>
    </section>

    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.3fr_0.95fr]">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-black text-navy">Décompte détaillé des rejets recommandés</h2><span className="badge bg-red-100 text-red-700">{formatNumber(primaryByPrestation.size)} lignes concernées</span></div>
        <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-soft">
          {rows.length === 0 ? <p className="p-12 text-center text-sm font-semibold text-emerald-700">Aucun rejet recommandé pour cet audit.</p> : <table className="table">
            <thead><tr><th>Nature du rejet principal</th><th>Nb</th><th>Montant rejeté</th><th>% total</th><th>Gravité</th></tr></thead>
            <tbody>{rows.map((row, index) => <tr className={row.severity === "critique" ? "bg-red-100/75" : index % 2 ? "bg-sky/10" : "bg-white"} key={row.code}><td className="font-black text-navy">{codeLabels[row.code] ?? humanize(row.code)}</td><td>{formatNumber(row.count)}</td><td className="font-black text-red-600">{formatMoney(row.amount)}</td><td>{totalClaimed ? `${((row.amount / totalClaimed) * 100).toFixed(2)}%` : "0.00%"}</td><td className={row.severity === "critique" ? "font-black text-red-600" : "font-black text-orange-600"}>{severityLabel(row.severity)}</td></tr>)}</tbody>
            <tfoot><tr className="bg-red-100"><td className="font-black text-red-700">TOTAL REJETS RECOMMANDÉS</td><td className="font-black text-red-700">{formatNumber(primaryByPrestation.size)}</td><td className="font-black text-red-700">{formatMoney(totalRejected)}</td><td className="font-black text-red-700">{savingRate.toFixed(2)}%</td><td/></tr></tfoot>
          </table>}
        </div>
        <div className="mt-5 rounded-lg border-l-4 border-sky bg-white p-5 shadow-soft"><h3 className="font-black text-navy">Méthode de calcul</h3><p className="mt-2 text-sm font-semibold text-slate-600">Chaque prestation est comptée une seule fois. Le rejet chiffré le plus important est retenu sans dépasser le montant de la prestation. Les anomalies de référentiel, d’intégrité, de fréquence et d’écart de dates restent à vérifier et ne réduisent pas automatiquement le paiement.</p><p className="mt-2 text-sm font-black text-orange-600">{formatNumber(verificationCount)} prestations nécessitent une vérification complémentaire.</p></div>
      </section>

      <aside className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="rounded-lg bg-navy text-white"><div className="flex items-center justify-between gap-4 px-5 py-4"><span className="font-semibold">Montant total réclamé</span><b className="text-2xl">{formatMoney(totalClaimed)}</b></div></div>
        <FinanceRow color="text-red-600" label="Total rejets recommandés" value={`- ${formatMoney(totalRejected)}`}/>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-5"><span className="font-black text-slate-600">MONTANT NET À PAYER</span><b className="text-3xl text-emerald-700">{formatMoney(netRecommended)}</b></div>
        <div className="mt-3 rounded-lg bg-emerald-100 px-5 py-3 text-center font-black text-emerald-700">Économie recommandée : {formatMoney(totalRejected)} ({savingRate.toFixed(2)}%)</div>

        <div className="mt-8 rounded-lg bg-slate-50 px-5 py-4">
          <p className="font-black text-slate-600">Préparé par :</p>
          <h3 className="mt-1 text-xl font-black text-navy">{user.name}</h3>
          <p className="text-sm font-semibold text-slate-500">{roleLabel(user.role)} · {user.compagnieNom}</p>
          <p className="mt-3 break-all text-xs font-semibold text-slate-500">Signature de contrôle : {signature}</p>
        </div>

        <a className="mt-6 block w-full rounded-lg bg-sky px-5 py-4 text-center font-black text-white" href={`/rapport-complet?fichier=${file.id}`}>Générer le rapport PDF complet</a>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><button className="rounded-lg bg-orange-600 px-5 py-4 font-black text-white" type="button">Envoyer au gestionnaire</button><button className="rounded-lg bg-emerald-600 px-5 py-4 font-black text-white" type="button">Transmettre compagnie</button></div>
      </aside>
    </div>

    <footer className="mt-10 flex flex-wrap justify-between gap-3 border-t border-line pt-4 text-xs font-semibold text-slate-500"><span>CRYSTAL — RECOMMANDATION PAIEMENT</span><span>ARIEL INDUSTRIES SARL — Confidentiel</span><span>{reference}</span></footer>
  </AppShell>;
}

function recommendedRejection(code: string, impact: number, prestationAmount: number) {
  const fullRejectionCodes = new Set(["DOUBLON_FONCTIONNEL", "DOUBLON_INTER_MOIS", "DOUBLON_INTER_GESTIONNAIRE", "HORS_EXERCICE", "DELAI_TARDIF_DEPASSE", "DATE_SOINS_FUTURE", "MONTANT_NEGATIF"]);
  const partialRejectionCodes = new Set(["DOUBLON_PARTIEL", "DEPASSEMENT_TARIF", "MONTANT_PAYE_SUPERIEUR"]);
  if (fullRejectionCodes.has(code)) return Math.max(0, prestationAmount);
  if (partialRejectionCodes.has(code)) return Math.max(0, Math.min(prestationAmount, impact));
  return 0;
}
function FinanceRow({ label, value, color }: { label: string; value: string; color: string }) { return <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-5"><span className="font-semibold text-slate-700">{label}</span><b className={color}>{value}</b></div>; }
function simpleSignature(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return `CR-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`; }
function roleLabel(role: string) { return role === "super_admin" ? "Administrateur CRYSTAL" : role === "admin_compagnie" ? "Super utilisateur compagnie" : role === "admin_filiale" ? "Administrateur filiale" : role === "auditeur" ? "Auditeur" : "Lecteur"; }
function humanize(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function severityLabel(value: string) { return value === "critique" ? "Critique" : value === "eleve" ? "Élevée" : value === "moyen" ? "Moyenne" : "Faible"; }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function monthLabel(month: number, year: number) { return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))); }
function fullManagerName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
