import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { createBranch, createOrganizationUser } from "./actions";

export default async function OrganisationPage() {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const companyWhere = current.role === "super_admin" ? {} : { id: current.compagnieId };
  const companies = await prisma.compagnie.findMany({
    where: companyWhere,
    include: {
      filiales: { orderBy: { nom: "asc" } },
      utilisateurs: { include: { filiale: true }, orderBy: { nom: "asc" } },
    },
    orderBy: { nom: "asc" },
  });
  const branches = companies.flatMap((company) => company.filiales.map((branch) => ({ ...branch, compagnieNom: company.nom })));
  const users = companies.flatMap((company) => company.utilisateurs.map((user) => ({ ...user, compagnieNom: company.nom })));
  const canCreateOrganization = current.role === "super_admin";

  return (
    <AppShell title="Compagnies, filiales et utilisateurs" subtitle="Administration / Organisation">
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-4 bg-sky px-5 py-4 text-white">
            <h2 className="text-lg font-black">Filiales ({branches.length})</h2>
            {canCreateOrganization && (
              <ModalForm
                description="Rattacher une nouvelle filiale à une compagnie."
                title="Créer une filiale"
                trigger={<button className="rounded-md bg-white px-4 py-2 text-xs font-black text-sky">+ Créer</button>}
              >
                <form action={createBranch} className="grid grid-cols-2 gap-3 p-5">
                  <SelectCompany companies={companies} />
                  <Field name="code" label="Code" placeholder="ABJ" />
                  <Field name="nom" label="Nom de la filiale" placeholder="NSIA CI Abidjan" />
                  <Field name="ville" label="Ville" placeholder="Abidjan" />
                  <Field name="email" label="Email" placeholder="filiale@compagnie.ci" type="email" />
                  <button className="col-span-2 rounded-lg bg-emerald-600 py-3 font-black text-white">Créer la filiale</button>
                </form>
              </ModalForm>
            )}
          </div>
          <table className="table">
            <thead><tr><th>Code</th><th>Filiale</th><th>Compagnie</th><th>Ville</th><th>Statut</th></tr></thead>
            <tbody>{branches.map((branch, index) => <tr className={index % 2 ? "bg-sky/10" : ""} key={branch.id}><td className="font-mono font-black text-sky">{branch.code}</td><td className="font-black text-navy">{branch.nom}</td><td>{branch.compagnieNom}</td><td>{branch.ville ?? "-"}</td><td className="font-black text-emerald-600">{branch.actif ? "ACTIVE" : "INACTIVE"}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
          <div className="flex items-center justify-between gap-4 bg-navy px-5 py-4 text-white">
            <h2 className="text-lg font-black">Utilisateurs ({users.length})</h2>
            {canCreateOrganization && (
              <ModalForm
                description="Créer un accès pour une filiale."
                title="Créer un utilisateur de filiale"
                trigger={<button className="rounded-md bg-white px-4 py-2 text-xs font-black text-navy">+ Créer</button>}
              >
                <form action={createOrganizationUser} className="space-y-3 p-5">
                  <div className="grid grid-cols-2 gap-3"><Field name="prenoms" label="Prénoms" placeholder="Ange Marie" /><Field name="nom" label="Nom" placeholder="KONAN" /></div>
                  <Field name="email" label="Email" placeholder="utilisateur@compagnie.ci" type="email" />
                  <Field name="password" label="Mot de passe initial" placeholder="12 caractères min., lettres et chiffres" type="password" />
                  <label className="block"><span className="text-xs font-black text-navy">Rôle</span><select className="input mt-1" name="role"><option value="admin_filiale">Administrateur filiale</option><option value="auditeur">Auditeur</option><option value="lecteur">Lecteur</option></select></label>
                  <label className="block"><span className="text-xs font-black text-navy">Filiale</span><select className="input mt-1" name="filialeId" required>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.compagnieNom} — {branch.nom}</option>)}</select></label>
                  <button className="w-full rounded-lg bg-emerald-600 py-3 font-black text-white">Créer le compte</button>
                </form>
              </ModalForm>
            )}
          </div>
          <table className="table">
            <thead><tr><th>Utilisateur</th><th>Email</th><th>Rôle</th><th>Compagnie</th><th>Filiale</th></tr></thead>
            <tbody>{users.map((user, index) => <tr className={index % 2 ? "bg-sky/10" : ""} key={user.id}><td className="font-black text-navy">{user.prenoms} {user.nom}</td><td>{user.email}</td><td className="font-black text-sky">{user.role}</td><td>{user.compagnieNom}</td><td>{user.filiale?.nom ?? "Siège compagnie"}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function Field({ name, label, placeholder, type = "text" }: { name: string; label: string; placeholder: string; type?: string }) {
  return <label className="block"><span className="text-xs font-black text-navy">{label}</span><input className="input mt-1" name={name} placeholder={placeholder} required={name !== "ville" && name !== "email"} type={type} /></label>;
}

function SelectCompany({ companies }: { companies: Array<{ id: number; nom: string }> }) {
  return <label className="col-span-2 block"><span className="text-xs font-black text-navy">Compagnie</span><select className="input mt-1" name="compagnieId" required>{companies.map((company) => <option key={company.id} value={company.id}>{company.nom}</option>)}</select></label>;
}
