import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { ModalForm } from "@/components/modal-form";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { createUser, toggleUserStatus, updateUser } from "./actions";

const roleLabels: Record<UserRole, string> = {
  super_admin: "Administrateur CRYSTAL",
  admin_compagnie: "Administrateur compagnie",
  admin_filiale: "Administrateur filiale",
  auditeur: "Auditeur",
  lecteur: "Lecteur",
};

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "admin_compagnie", label: "Administrateur compagnie" },
  { value: "admin_filiale", label: "Administrateur filiale" },
  { value: "auditeur", label: "Auditeur" },
  { value: "lecteur", label: "Lecteur" },
];

export default async function Page({ searchParams }: { searchParams?: { q?: string } }) {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const canManageUsers = current.role === "super_admin";
  const query = searchParams?.q?.trim() ?? "";
  const scope = current.role === "super_admin" ? {} : { compagnieId: current.compagnieId };
  const searchWhere = query
    ? {
        OR: [
          { nom: { contains: query } },
          { prenoms: { contains: query } },
          { email: { contains: query } },
          { compagnie: { nom: { contains: query } } },
          { filiale: { nom: { contains: query } } },
        ],
      }
    : {};

  const [users, companies, branches, counts] = await Promise.all([
    prisma.utilisateur.findMany({
      where: { ...scope, ...searchWhere },
      include: { compagnie: true, filiale: true },
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
    }),
    prisma.compagnie.findMany({
      where: current.role === "super_admin" ? {} : { id: current.compagnieId },
      orderBy: { nom: "asc" },
    }),
    prisma.filiale.findMany({
      where: current.role === "super_admin" ? {} : { compagnieId: current.compagnieId },
      include: { compagnie: true },
      orderBy: [{ compagnie: { nom: "asc" } }, { nom: "asc" }],
    }),
    Promise.all([
      prisma.utilisateur.count({ where: { ...scope, actif: true } }),
      prisma.utilisateur.count({ where: scope }),
      prisma.utilisateur.count({ where: { ...scope, role: "super_admin" } }),
      prisma.utilisateur.count({ where: { ...scope, role: { in: ["auditeur", "admin_filiale"] } } }),
      prisma.utilisateur.count({ where: { ...scope, role: "lecteur" } }),
    ]),
  ]);

  const metrics = [
    { code: "UA", value: String(counts[0]), label: `Sur ${counts[1]} comptes`, sub: "Utilisateurs actifs", color: "bg-sky", line: "bg-sky" },
    { code: "SA", value: String(counts[2]), label: "Accès total", sub: "Super admins", color: "bg-red-600", line: "bg-red-600" },
    { code: "AU", value: String(counts[3]), label: "Accès audit", sub: "Auditeurs & admins filiale", color: "bg-emerald-600", line: "bg-emerald-600" },
    { code: "LE", value: String(counts[4]), label: "Consultation", sub: "Lecteurs actifs", color: "bg-slate-500", line: "bg-slate-500" },
  ];

  return (
    <AppShell title="Gestion des utilisateurs" subtitle="Configuration / Utilisateurs">
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {metrics.map((item) => <MetricCard item={item} key={item.code} />)}
      </section>

      <section className="mt-7">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row">
          <form className="flex flex-col gap-4 lg:flex-row">
            <input className="input lg:w-[390px]" defaultValue={query} name="q" placeholder="Rechercher un utilisateur..." />
            <button className="btn min-w-36">Rechercher</button>
          </form>
          {canManageUsers && (
            <ModalForm
              description="Renseigner les informations du compte."
              size="lg"
              title="Créer un utilisateur"
              trigger={<button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-soft">+ Créer un utilisateur</button>}
            >
              <UserForm action={createUser} branches={branches} companies={companies} submitLabel="Créer le compte" />
            </ModalForm>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
          <table className="table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Compagnie/Filiale</th>
                <th>Dernière connexion</th>
                <th>Statut</th>
                {canManageUsers && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.length ? users.map((user, index) => (
                <tr className={index % 2 ? "bg-sky/10" : "bg-white"} key={user.id}>
                  <td className="font-black text-navy">{fullName(user.prenoms, user.nom)}</td>
                  <td className="font-mono text-xs font-bold text-slate-700">{user.email}</td>
                  <td>{roleLabels[user.role]}</td>
                  <td>
                    <b className="block text-navy">{user.compagnie.nom}</b>
                    <span className="text-xs font-semibold text-slate-500">{user.filiale?.nom ?? "Siège compagnie"}</span>
                  </td>
                  <td>{user.derniereConnexion ? formatDate(user.derniereConnexion) : "-"}</td>
                  <td><StatusBadge active={user.actif} /></td>
                  {canManageUsers && (
                    <td>
                      <div className="flex justify-end gap-2">
                        <ModalForm
                          description="Modifier les informations et les accès."
                          size="lg"
                          title="Modifier un utilisateur"
                          trigger={<button className="rounded-md bg-sky/10 px-3 py-2 text-xs font-black text-sky">Modifier</button>}
                        >
                          <UserForm action={updateUser} branches={branches} companies={companies} submitLabel="Enregistrer" user={user} />
                        </ModalForm>
                        <form action={toggleUserStatus}>
                          <input name="id" type="hidden" value={user.id} />
                          <button
                            className={`rounded-md px-3 py-2 text-xs font-black ${user.actif ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                            disabled={user.id === current.id}
                            title={user.id === current.id ? "Vous ne pouvez pas désactiver votre propre compte." : undefined}
                          >
                            {user.actif ? "Désactiver" : "Activer"}
                          </button>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td className="p-8 text-center text-sm font-semibold text-slate-500" colSpan={canManageUsers ? 7 : 6}>
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function MetricCard({ item }: { item: { code: string; value: string; label: string; sub: string; color: string; line: string } }) {
  return (
    <article className="card relative min-h-36 overflow-hidden p-6">
      <span className={`grid h-14 w-14 place-items-center rounded-full text-lg font-black text-white ${item.color}`}>{item.code}</span>
      <h2 className="mt-5 text-4xl font-black leading-none text-navy">{item.value}</h2>
      <p className="text-sm font-bold leading-tight text-slate-600">{item.label}</p>
      <p className="text-xs font-black leading-tight text-slate-500">{item.sub}</p>
      <span className={`absolute bottom-3 left-5 right-5 h-1 rounded-full ${item.line}`} />
    </article>
  );
}

function UserForm({
  action,
  branches,
  companies,
  submitLabel,
  user,
}: {
  action: (formData: FormData) => Promise<void>;
  branches: Array<{ id: number; nom: string; compagnieId: number; compagnie: { nom: string } }>;
  companies: Array<{ id: number; nom: string }>;
  submitLabel: string;
  user?: {
    id: number;
    compagnieId: number;
    filialeId: number | null;
    prenoms: string | null;
    nom: string;
    email: string;
    role: UserRole;
    actif: boolean;
  };
}) {
  const selectedCompanyId = user?.compagnieId ?? companies[0]?.id;
  return (
    <form action={action} className="space-y-4 p-6">
      {user && <input name="id" type="hidden" value={user.id} />}
      <div className="grid gap-3 md:grid-cols-2">
        <Field defaultValue={user?.prenoms ?? ""} label="Prénoms" name="prenoms" required={false} />
        <Field defaultValue={user?.nom ?? ""} label="Nom" name="nom" />
      </div>
      <Field defaultValue={user?.email ?? ""} label="Email" name="email" type="email" />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-black text-navy">Compagnie</span>
          <select className="input mt-1" defaultValue={selectedCompanyId} name="compagnieId" required>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.nom}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-black text-navy">Filiale</span>
          <select className="input mt-1" defaultValue={user?.filialeId ?? ""} name="filialeId">
            <option value="">Siège compagnie</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.compagnie.nom} - {branch.nom}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-black text-navy">Rôle</span>
          <select className="input mt-1" defaultValue={user?.role ?? "auditeur"} name="role">
            {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </label>
        {user && (
          <label className="block">
            <span className="text-xs font-black text-navy">Statut</span>
            <select className="input mt-1" defaultValue={String(user.actif)} name="actif">
              <option value="true">Actif</option>
              <option value="false">Inactif</option>
            </select>
          </label>
        )}
      </div>
      <Field label={user ? "Nouveau mot de passe" : "Mot de passe initial"} name="password" placeholder={user ? "Laisser vide pour conserver" : "8 caractères minimum"} required={!user} type="password" />
      <button className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-black text-white">{submitLabel}</button>
    </form>
  );
}

function Field({ defaultValue, label, name, placeholder, required = true, type = "text" }: { defaultValue?: string; label: string; name: string; placeholder?: string; required?: boolean; type?: string }) {
  return <label className="block"><span className="text-xs font-black text-navy">{label}</span><input className="input mt-1" defaultValue={defaultValue} name={name} placeholder={placeholder} required={required} type={type} /></label>;
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`badge ${active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{active ? "Actif" : "Inactif"}</span>;
}

function fullName(prenoms: string | null, nom: string) {
  return `${prenoms ?? ""} ${nom}`.trim();
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
