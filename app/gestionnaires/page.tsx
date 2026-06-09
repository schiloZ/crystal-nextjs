import { Fragment } from "react";
import { BriefcaseBusiness, CheckCircle2, Files, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { ManagerForm } from "./manager-form";
import { toggleManager, updateManager } from "./actions";

export default async function ManagersPage() {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const companies = await prisma.compagnie.findMany({
    where: current.role === "super_admin" ? {} : { id: current.compagnieId },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });
  const managers = await prisma.gestionnaire.findMany({
    where: current.role === "super_admin" ? {} : { compagnieId: current.compagnieId },
    include: { _count: { select: { fichiers: true } } },
    orderBy: [{ actif: "desc" }, { nom: "asc" }],
  });
  const companyNames = new Map(companies.map((company) => [company.id, company.nom]));

  return (
    <AppShell title="Gestionnaires de prestations" subtitle="Administration / Gestionnaires">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Summary icon={<Users size={21} />} label="Gestionnaires" value={String(managers.length)} tone="sky" />
        <Summary icon={<CheckCircle2 size={21} />} label="Gestionnaires actifs" value={String(managers.filter((item) => item.actif).length)} tone="emerald" />
        <Summary icon={<Files size={21} />} label="Fichiers attachés" value={String(managers.reduce((sum, item) => sum + item._count.fichiers, 0))} tone="orange" />
        <Summary icon={<BriefcaseBusiness size={21} />} label="Compagnies" value={String(companies.length)} tone="violet" />
      </section>

      <section className="mt-6">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-5">
            <div><h2 className="text-lg font-black text-navy">Liste des gestionnaires</h2><p className="text-xs font-semibold text-slate-500">Les gestionnaires actifs sont disponibles lors de l’import d’un fichier</p></div>
            <ModalForm
              description="Ajouter une personne à attacher aux fichiers."
              title="Nouveau gestionnaire"
              trigger={<button className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-black text-white">+ Nouveau gestionnaire</button>}
            >
              <ManagerForm companies={companies} showCompany={current.role === "super_admin"} />
            </ModalForm>
          </div>
          {managers.length === 0 ? <p className="p-10 text-center text-sm font-semibold text-slate-500">Aucun gestionnaire enregistré.</p> : <table className="table">
            <thead><tr><th>Code</th><th>Gestionnaire</th><th>Compagnie</th><th>Coordonnées</th><th>Fichiers</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{managers.map((manager, index) => <Fragment key={manager.id}>
              <tr className={index % 2 ? "bg-sky/10" : "bg-white"}>
                <td className="font-mono font-black text-sky">{manager.code}</td>
                <td><span className="block font-black text-navy">{manager.prenoms} {manager.nom}</span><span className="text-xs font-semibold text-slate-500">{manager.contact ?? "Gestionnaire"}</span></td>
                <td>{companyNames.get(manager.compagnieId) ?? "Compagnie"}</td>
                <td><span className="block">{manager.email ?? "-"}</span><span className="text-xs text-slate-500">{manager.telephone ?? "-"}</span></td>
                <td className="font-black text-navy">{manager._count.fichiers}</td>
                <td><span className={`badge ${manager.actif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{manager.actif ? "Actif" : "Inactif"}</span></td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <ModalForm
                      description={`${manager.code} · ${companyNames.get(manager.compagnieId) ?? "Compagnie"}`}
                      size="lg"
                      title={`Modifier ${manager.prenoms ?? ""} ${manager.nom}`.trim()}
                      trigger={<button className="rounded-md bg-sky/10 px-3 py-2 text-xs font-black text-sky">Modifier</button>}
                    >
                    <form action={updateManager} className="grid gap-3 border-t border-line p-4 lg:grid-cols-3">
                      <input name="id" type="hidden" value={manager.id} />
                      {current.role === "super_admin" && <label><span className="mb-1 block text-xs font-black text-navy">Compagnie</span><select className="input" defaultValue={manager.compagnieId} name="compagnieId" required>{companies.map((company) => <option key={company.id} value={company.id}>{company.nom}</option>)}</select></label>}
                      <Field defaultValue={manager.code} label="Code" name="code" />
                      <Field defaultValue={manager.prenoms ?? ""} label="Prénoms" name="prenoms" />
                      <Field defaultValue={manager.nom} label="Nom" name="nom" />
                      <Field defaultValue={manager.contact ?? ""} label="Fonction / Contact" name="contact" required={false} />
                      <Field defaultValue={manager.telephone ?? ""} label="Téléphone" name="telephone" required={false} />
                      <Field defaultValue={manager.email ?? ""} label="Email" name="email" required={false} type="email" />
                      <div className="flex items-end"><button className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white">Enregistrer les modifications</button></div>
                    </form>
                    </ModalForm>
                    <form action={toggleManager}><input name="id" type="hidden" value={manager.id} /><button className={`rounded-md px-3 py-2 text-xs font-black ${manager.actif ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{manager.actif ? "Désactiver" : "Activer"}</button></form>
                  </div>
                </td>
              </tr>
            </Fragment>)}</tbody>
          </table>}
        </div>
      </section>
    </AppShell>
  );
}

function Summary({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  const colors: Record<string, string> = { sky: "bg-sky", emerald: "bg-emerald-600", orange: "bg-orange-500", violet: "bg-violet-600" };
  return <div className="card flex items-center gap-4 p-5"><span className={`grid h-12 w-12 place-items-center rounded-full text-white ${colors[tone]}`}>{icon}</span><div><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="text-2xl font-black text-navy">{value}</p></div></div>;
}

function Field({ label, name, defaultValue, type = "text", required = true }: { label: string; name: string; defaultValue: string; type?: string; required?: boolean }) {
  return <label><span className="mb-1 block text-xs font-black text-navy">{label}</span><input className="input" defaultValue={defaultValue} name={name} required={required} type={type} /></label>;
}
