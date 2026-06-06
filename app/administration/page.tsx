import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AppShell } from "@/components/app-shell";
import { CompanyForm } from "./company-form";

export default async function AdministrationPage() {
  await requireRole(["super_admin"]);
  const companies = await prisma.compagnie.findMany({
    include: {
      filiales: { select: { id: true } },
      utilisateurs: { select: { id: true, role: true } },
    },
    orderBy: { nom: "asc" },
  });

  return (
    <AppShell title="Administration CRYSTAL" subtitle="Administration / Compagnies">
      <section className="grid gap-6 xl:grid-cols-[1fr_430px]">
        <div>
          <div className="mb-5 grid grid-cols-3 gap-4">
            <div className="metric"><p className="text-xs font-black text-slate-500">COMPAGNIES</p><b className="text-3xl text-navy">{companies.length}</b></div>
            <div className="metric"><p className="text-xs font-black text-slate-500">FILIALES</p><b className="text-3xl text-navy">{companies.reduce((sum, item) => sum + item.filiales.length, 0)}</b></div>
            <div className="metric"><p className="text-xs font-black text-slate-500">UTILISATEURS</p><b className="text-3xl text-navy">{companies.reduce((sum, item) => sum + item.utilisateurs.length, 0)}</b></div>
          </div>
          <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
            <table className="table">
              <thead><tr><th>Code</th><th>Compagnie</th><th>Ville</th><th>Filiales</th><th>Utilisateurs</th><th>Statut</th></tr></thead>
              <tbody>
                {companies.map((company, index) => (
                  <tr className={index % 2 ? "bg-sky/10" : "bg-white"} key={company.id}>
                    <td className="font-mono font-black text-sky">{company.code}</td>
                    <td className="font-black text-navy">{company.nom}</td>
                    <td>{company.ville ?? "-"}</td>
                    <td>{company.filiales.length}</td>
                    <td>{company.utilisateurs.length}</td>
                    <td className={company.actif ? "font-black text-emerald-600" : "font-black text-red-600"}>{company.actif ? "ACTIVE" : "INACTIVE"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="card overflow-hidden">
          <h2 className="bg-navy px-6 py-4 text-lg font-black text-white">Créer une compagnie</h2>
          <CompanyForm />
        </aside>
      </section>
    </AppShell>
  );
}
