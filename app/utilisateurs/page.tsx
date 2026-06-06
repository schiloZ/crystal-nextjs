import { AppShell } from "@/components/app-shell";

const metrics = [
  { code: "UA", value: "12", label: "Sur 15 comptes", sub: "Utilisateurs actifs", color: "bg-sky", line: "bg-sky" },
  { code: "SA", value: "1", label: "Acces total", sub: "Super admins", color: "bg-red-600", line: "bg-red-600" },
  { code: "AU", value: "7", label: "Acces audit", sub: "Auditeurs", color: "bg-emerald-600", line: "bg-emerald-600" },
  { code: "LE", value: "4", label: "Consultation", sub: "Lecteurs actifs", color: "bg-slate-500", line: "bg-slate-500" },
];

const users = [
  ["KONAN Ange Yves", "a.konan@ariel.ci", "Auditeur", "NSIA CI Abidjan", "white"],
  ["BAMBA Kofi J.", "k.bamba@nsia.ci", "Admin", "NSIA Assurances", "sky"],
  ["YAOUA Nina", "n.yaoua@nsia.ci", "Lecteur", "NSIA CI Abidjan", "white"],
  ["TRAORE Seydou", "s.traore@nsia.ci", "Auditeur", "NSIA CI Abidjan", "sky"],
  ["DIALLO Aminata", "a.diallo@ariel.ci", "Auditeur", "NSIA CI Bouake", "white"],
  ["COULIBALY Marc", "m.coulibaly@nsia.ci", "Lecteur", "NSIA Assurances", "sky"],
  ["OUATTARA Ibrahim", "i.ouattara@nsia.ci", "Auditeur", "NSIA CI San-Pedro", "yellow"],
  ["ASSI Pierre", "p.assi@nsia.ci", "Lecteur", "NSIA Assurances", "sky"],
];

function MetricCard({ item }: { item: (typeof metrics)[number] }) {
  return (
    <article className="card relative min-h-36 overflow-hidden p-6">
      <span className={`grid h-14 w-14 place-items-center rounded-full text-lg font-black text-white ${item.color}`}>
        {item.code}
      </span>
      <h2 className="mt-5 text-4xl font-black leading-none text-navy">{item.value}</h2>
      <p className="text-sm font-bold leading-tight text-slate-600">{item.label}</p>
      <p className="text-xs font-black leading-tight text-slate-500">{item.sub}</p>
      <span className={`absolute bottom-3 left-5 right-5 h-1 rounded-full ${item.line}`} />
    </article>
  );
}

export default function Page() {
  return (
    <AppShell title="Gestion des utilisateurs" subtitle="Configuration / Utilisateurs">
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {metrics.map((item) => (
          <MetricCard item={item} key={item.code} />
        ))}
      </section>

      <section className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_430px]">
        <div>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row">
            <input className="input lg:max-w-[390px]" placeholder="Rechercher un utilisateur..." />
            <button className="btn min-w-36">Rechercher</button>
          </div>

          <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
            <table className="table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Compagnie/Filiale</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const bg =
                    user[4] === "yellow" ? "bg-yellow-100/80" : user[4] === "sky" ? "bg-sky/10" : "bg-white";
                  return (
                    <tr className={bg} key={user[1]}>
                      <td className="font-black text-navy">{user[0]}</td>
                      <td className="font-mono text-xs font-bold text-slate-700">{user[1]}</td>
                      <td>{user[2]}</td>
                      <td>{user[3]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="card overflow-hidden">
          <div className="bg-sky px-6 py-4 text-center text-lg font-black text-white">+ Creer un utilisateur</div>
          <form className="space-y-3 p-6">
            <label className="block">
              <span className="text-sm font-black text-navy">Prenom</span>
              <input className="input mt-1" defaultValue="Ange Marie" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-navy">Nom</span>
              <input className="input mt-1" defaultValue="KONAN" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-navy">Email</span>
              <input className="input mt-1" defaultValue="a.konan@ariel.ci" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-navy">Mot de passe</span>
              <input className="input mt-1" defaultValue="••••••••" type="password" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-navy">Role</span>
              <input className="input mt-1" defaultValue="Auditeur" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-navy">Compagnie</span>
              <input className="input mt-1" defaultValue="NSIA Assurances" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-navy">Filiale</span>
              <input className="input mt-1" defaultValue="NSIA CI Abidjan" />
            </label>
            <button className="mt-3 w-full rounded-lg bg-emerald-600 py-3 text-sm font-black text-white" type="button">
              Creer le compte
            </button>
            <button className="w-full rounded-lg bg-sky/10 py-3 text-sm font-black text-slate-700" type="button">
              Annuler
            </button>
          </form>
        </aside>
      </section>
    </AppShell>
  );
}
