import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export default async function HistoriquePage({ searchParams }: { searchParams?: { action?: string } }) {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const action = actionParam(searchParams?.action);
  const scope = current.role === "super_admin" ? {} : { compagnieId: current.compagnieId };
  const where = { ...scope, ...(action ? { action } : {}) };

  const [history, companies, totals] = await Promise.all([
    prisma.historiqueImportation.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.compagnie.findMany({
      where: current.role === "super_admin" ? {} : { id: current.compagnieId },
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    }),
    Promise.all([
      prisma.historiqueImportation.count({ where: scope }),
      prisma.historiqueImportation.count({ where: { ...scope, action: "ajout" } }),
      prisma.historiqueImportation.count({ where: { ...scope, action: "suppression" } }),
    ]),
  ]);
  const companyNames = new Map(companies.map((company) => [company.id, company.nom]));

  return (
    <AppShell title="Historique des importations" subtitle="Administration / Historique imports">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric label="Actions enregistrées" value={totals[0]} tone="sky" />
        <Metric label="Ajouts de fichiers" value={totals[1]} tone="emerald" />
        <Metric label="Suppressions" value={totals[2]} tone="red" />
      </section>

      <section className="mt-6">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
            <div>
              <h2 className="text-lg font-black text-navy">Journal des actions</h2>
              <p className="text-xs font-semibold text-slate-500">Qui a ajouté ou supprimé des données d'importation</p>
            </div>
            <div className="flex gap-2">
              <FilterLink active={!action} href="/historique" label="Tout" />
              <FilterLink active={action === "ajout"} href="/historique?action=ajout" label="Ajouts" />
              <FilterLink active={action === "suppression"} href="/historique?action=suppression" label="Suppressions" />
            </div>
          </div>
          {history.length === 0 ? (
            <p className="p-10 text-center text-sm font-semibold text-slate-500">Aucune action trouvée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table min-w-[980px]">
                <thead><tr><th>Action</th><th>Fichier</th><th>Utilisateur</th><th>Compagnie</th><th>Lignes</th><th>Anomalies</th><th>Date</th></tr></thead>
                <tbody>
                  {history.map((item, index) => (
                    <tr className={index % 2 ? "bg-sky/10" : "bg-white"} key={item.id}>
                      <td><span className={`badge ${item.action === "suppression" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{actionLabel(item.action)}</span></td>
                      <td className="font-black text-navy">{item.nomFichier}</td>
                      <td><b className="block text-navy">{item.utilisateurNom}</b><span className="text-xs font-semibold text-slate-500">{item.utilisateurEmail}</span></td>
                      <td>{companyNames.get(item.compagnieId) ?? "Compagnie"}</td>
                      <td>{formatNumber(item.nbLignesTotal)}</td>
                      <td>{formatNumber(item.nbAnomalies)}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "sky" | "emerald" | "red" }) {
  const colors = { sky: "text-sky border-t-sky", emerald: "text-emerald-600 border-t-emerald-600", red: "text-red-600 border-t-red-600" };
  return <article className={`card border-t-[6px] p-5 ${colors[tone]}`}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className={`mt-2 text-3xl font-black ${colors[tone].split(" ")[0]}`}>{formatNumber(value)}</p></article>;
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return <a className={`rounded-md px-3 py-2 text-xs font-black ${active ? "bg-sky text-white" : "bg-sky/10 text-sky"}`} href={href}>{label}</a>;
}

function actionParam(value?: string) {
  return value === "ajout" || value === "suppression" ? value : undefined;
}

function actionLabel(action: string) {
  return action === "suppression" ? "Suppression" : "Ajout";
}

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR");
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
