import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/current-user";
import { getAuditSummary } from "@/lib/audit-summary";

const kpiColors = ["#38bdf8", "#059669", "#dc2626", "#d97706", "#7c3aed", "#0284c7"];

export default async function Page({ searchParams }: { searchParams?: { fichier?: string } }) {
  const user = await getCurrentUser();
  const data = await getAuditSummary(user, Number(searchParams?.fichier) || undefined);
  const file = data.selected;

  if (!file) {
    return <AppShell title="Synthèse de l'audit — R01" subtitle="Audit / Synthèse">
      <section className="card p-12 text-center">
        <h2 className="text-2xl font-black text-navy">Aucun audit disponible</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Importez un fichier de prestations et lancez son audit pour générer la synthèse.</p>
        <a className="btn mt-6 inline-block" href="/import">Importer un fichier</a>
      </section>
    </AppShell>;
  }

  const rate = Number(file.tauxAnomalie);
  const kpis = [
    { icon: "LG", value: formatNumber(file.nbLignesTotal), label: "Total lignes" },
    { icon: "OK", value: formatNumber(file.nbLignesValides), label: "Lignes valides" },
    { icon: "AN", value: formatNumber(file.nbLignesAnomalies), label: "Lignes avec anomalies" },
    { icon: "TR", value: formatNumber(file.nbLignesTardives), label: "Tardifs" },
    { icon: "DO", value: formatNumber(data.duplicateCount), label: "Doublons" },
    { icon: "TX", value: `${rate.toFixed(1)}%`, label: "Taux anomalie" },
  ];

  return <AppShell title="Synthèse de l'audit — R01" subtitle={`Audit / ${file.gestionnaire.nom} / ${file.exercice.codeExercice}`}>
    <form className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white px-5 py-4 shadow-soft">
      <label className="min-w-80 flex-1"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Audit à consulter</span><select className="input" defaultValue={file.id} name="fichier">{data.files.map((item) => <option key={item.id} value={item.id}>{item.nomFichier} · {item.filiale.nom} · {formatDate(item.dateImport)}</option>)}</select></label>
      <button className="btn">Afficher la synthèse</button>
    </form>

    <section className="mb-5 rounded-lg bg-navy px-6 py-4 text-white">
      <div className="flex items-center justify-between gap-5">
        <div>
          <h2 className="text-xl font-black">{fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom)}</h2>
          <p className="mt-1 text-sm font-semibold text-blue-100">{file.compagnie.nom} — {file.filiale.nom} — {file.nomFichier}</p>
          <p className="mt-1 text-xs font-semibold text-blue-200">Exercice : {formatDate(file.exercice.dateDebut)} au {formatDate(file.exercice.dateFin)} · Importé le {formatDate(file.dateImport)} · {formatNumber(data.anomalyCount)} détections d'anomalies</p>
        </div>
        <div className="flex gap-3">
          <a className="rounded-lg bg-sky px-8 py-3 text-sm font-black text-white" href={`/rapport-complet?fichier=${file.id}`}>Export PDF</a>
          <button className="rounded-lg bg-emerald-600 px-8 py-3 text-sm font-black text-white">Export Excel</button>
        </div>
      </div>
    </section>

    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((item, index) => <Kpi item={{ ...item, color: kpiColors[index] }} key={item.icon}/>)}
    </div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_1fr]">
      <section>
        <h2 className="mb-3 text-lg font-black text-navy">Détail des anomalies par catégorie</h2>
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
          {data.rows.length === 0 ? <p className="p-10 text-center text-sm font-semibold text-emerald-700">Aucune anomalie détectée pour cet audit.</p> : <table className="table">
            <thead><tr><th>Catégorie</th><th>Type</th><th>Nb</th><th>Montant impacté</th><th>Gravité</th><th>Statut</th></tr></thead>
            <tbody>{data.rows.map((row, index) => {
              const critical = row.severity === "critique";
              return <tr className={critical ? "bg-red-100/75" : index % 2 ? "bg-white" : "bg-yellow-100/70"} key={`${row.category}-${row.type}`}>
                <td className="font-black text-navy">{row.category}</td><td>{row.type}</td><td>{formatNumber(row.count)}</td><td className="font-black text-orange-600">{formatMoney(row.amount)}</td>
                <td className={`font-black ${critical ? "text-red-600" : "text-orange-600"}`}>{severityLabel(row.severity)}</td><td className="font-black text-navy">Détectée</td>
              </tr>;
            })}</tbody>
          </table>}
        </div>
      </section>

      <aside className="space-y-5">
        <section>
          <h2 className="mb-3 text-lg font-black text-navy">Récapitulatif financier</h2>
          <div className="space-y-2">
            <FinanceRow label="Total réclamé" value={formatMoney(Number(file.montantTotalReclame))} />
            {data.finance.map((item) => <FinanceRow color="text-red-600" key={item.label} label={item.label} value={`-${formatMoney(item.amount)}`} />)}
            <div className="flex items-center justify-between rounded-lg bg-navy px-5 py-4 text-white shadow-soft"><span className="font-black text-sky">MONTANT NET RECOMMANDÉ</span><b className="text-2xl">{formatMoney(Number(file.montantNetRecommande))}</b></div>
          </div>
        </section>
        <section>
          <h2 className="mb-4 text-lg font-black text-navy">Progression audit</h2>
          <div className="space-y-4">{data.progress.map((item) => <div key={item.label}><div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700"><span>{item.label}</span><span className={item.value === 100 ? "font-black text-emerald-700" : "font-black text-slate-400"}>{item.value}%</span></div><div className="h-3 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${item.value}%` }}/></div></div>)}</div>
        </section>
      </aside>
    </div>
  </AppShell>;
}

function Kpi({ item }: { item: { icon: string; value: string; label: string; color: string } }) {
  return <article className="relative overflow-hidden rounded-lg border border-line bg-white p-5 shadow-soft"><div className="mb-3 grid h-14 w-14 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: item.color }}>{item.icon}</div><h3 className="text-3xl font-black leading-none text-navy">{item.value}</h3><p className="mt-2 text-sm font-black text-navy">{item.label}</p><div className="absolute bottom-0 left-4 right-4 h-1" style={{ backgroundColor: item.color }}/></article>;
}
function FinanceRow({ label, value, color = "text-navy" }: { label: string; value: string; color?: string }) { return <div className="flex items-center justify-between rounded-lg bg-white px-5 py-3 shadow-soft"><span className="font-semibold text-slate-700">{label}</span><b className={color}>{value}</b></div>; }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function fullManagerName(prenoms: string | null, nom: string) { return `${prenoms ?? ""} ${nom}`.trim(); }
function severityLabel(value: string) { return value === "critique" ? "Critique" : value === "eleve" ? "Élevée" : value === "moyen" ? "Moyenne" : "Faible"; }
