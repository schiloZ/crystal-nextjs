import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { companyStatus, companyStatusLabel, type CompanyStatus } from "@/lib/company-access";
import { CompanyForm } from "./company-form";
import { deleteCompany } from "./actions";
import { CompanyAccessForm } from "./company-access-form";

const statusClass: Record<CompanyStatus, string> = {
  active: "text-emerald-600",
  essai: "text-amber-600",
  essai_expire: "text-red-600",
  suspendue: "text-red-600",
};

export default async function AdministrationPage() {
  await requireRole(["super_admin"]);
  const [companies, prestationCounts] = await Promise.all([
    prisma.compagnie.findMany({
      include: {
        filiales: { select: { id: true } },
        utilisateurs: { select: { id: true, role: true } },
        _count: { select: { fichiers: true } },
      },
      orderBy: { nom: "asc" },
    }),
    prisma.prestation.groupBy({ by: ["compagnieId"], _count: { _all: true } }),
  ]);
  const prestationsByCompany = new Map(prestationCounts.map((row) => [row.compagnieId, row._count._all]));

  return (
    <AppShell title="Administration CRYSTAL" subtitle="Administration / Compagnies">
      <section>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="grid flex-1 grid-cols-3 gap-4">
            <div className="metric"><p className="text-xs font-black text-slate-500">COMPAGNIES</p><b className="text-3xl text-navy">{companies.length}</b></div>
            <div className="metric"><p className="text-xs font-black text-slate-500">FILIALES</p><b className="text-3xl text-navy">{companies.reduce((sum, item) => sum + item.filiales.length, 0)}</b></div>
            <div className="metric"><p className="text-xs font-black text-slate-500">UTILISATEURS</p><b className="text-3xl text-navy">{companies.reduce((sum, item) => sum + item.utilisateurs.length, 0)}</b></div>
          </div>
          <div className="flex flex-col gap-2">
            <ModalForm
              description="Créer la compagnie et son premier super utilisateur."
              title="Créer une compagnie"
              trigger={<button className="w-full rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-soft">+ Créer une compagnie</button>}
            >
              <CompanyForm />
            </ModalForm>
            <a className="rounded-lg border border-sky bg-white px-5 py-3 text-center text-sm font-black text-navy shadow-soft hover:bg-sky/10" href="/api/exports/compagnies">
              Exporter en Excel
            </a>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
          <table className="table">
            <thead><tr><th>Code</th><th>Compagnie</th><th>Ville</th><th>Filiales</th><th>Utilisateurs</th><th>Statut</th><th>Fin d&apos;essai</th><th>Actions</th></tr></thead>
            <tbody>
              {companies.map((company, index) => {
                const status = companyStatus(company);
                const hasSuperAdmin = company.utilisateurs.some((user) => user.role === "super_admin");
                const prestations = prestationsByCompany.get(company.id) ?? 0;
                return (
                  <tr className={index % 2 ? "bg-sky/10" : "bg-white"} key={company.id}>
                    <td className="font-mono font-black text-sky">{company.code}</td>
                    <td className="font-black text-navy">{company.nom}</td>
                    <td>{company.ville ?? "-"}</td>
                    <td>{company.filiales.length}</td>
                    <td>{company.utilisateurs.length}</td>
                    <td className={`font-black uppercase ${statusClass[status]}`}>{companyStatusLabel[status]}</td>
                    <td>{company.dateFinEssai ? formatDate(company.dateFinEssai) : "Sans limite"}</td>
                    <td>
                      <div className="flex gap-2">
                        <ModalForm
                          description={`${company.nom} : après la date de fin d'essai, ou si la compagnie est suspendue, ses utilisateurs ne peuvent plus se connecter et sont invités à contacter l'administrateur.`}
                          size="sm"
                          title="Gérer l'accès"
                          trigger={<button className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-black text-navy hover:border-sky" type="button">Accès</button>}
                        >
                          <CompanyAccessForm
                            actif={company.actif}
                            companyId={company.id}
                            companyName={company.nom}
                            dateFinEssai={company.dateFinEssai ? company.dateFinEssai.toISOString().slice(0, 10) : ""}
                            userCount={company.utilisateurs.length}
                          />
                        </ModalForm>
                        {hasSuperAdmin ? (
                          <span className="rounded-md border border-slate-100 px-3 py-1.5 text-xs font-black text-slate-300" title="Cette compagnie contient un super administrateur">Supprimer</span>
                        ) : (
                          <ModalForm
                            description="Suppression définitive et irréversible."
                            size="sm"
                            title={`Supprimer ${company.nom}`}
                            trigger={<button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-black text-red-600 hover:bg-red-50" type="button">Supprimer</button>}
                          >
                            <form action={deleteCompany} className="space-y-4 p-6">
                              <input name="id" type="hidden" value={company.id} />
                              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                                Seront supprimés définitivement : {company.utilisateurs.length} utilisateur(s), {company.filiales.length} filiale(s), {company._count.fichiers} fichier(s) importé(s), {prestations.toLocaleString("fr-FR")} prestation(s) avec leurs anomalies, ainsi que les gestionnaires, exercices, historiques et référentiels.
                              </div>
                              <label className="block text-sm font-bold text-navy">
                                Pour confirmer, saisissez le code <span className="font-mono text-red-600">{company.code}</span>
                                <input autoComplete="off" className="input mt-1 font-mono" name="confirmation" required />
                              </label>
                              <button className="w-full rounded-lg bg-red-600 py-3 text-sm font-black text-white" type="submit">Supprimer définitivement</button>
                            </form>
                          </ModalForm>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}
