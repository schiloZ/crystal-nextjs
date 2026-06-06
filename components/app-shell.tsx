import { Sidebar } from "./sidebar";
import { signOut } from "@/lib/auth";
import { getCurrentUser } from "@/lib/current-user";

export async function AppShell({children,title,subtitle}:{children:React.ReactNode,title:string,subtitle?:string}){
  const user = await getCurrentUser();
  const company = user.role === "super_admin" ? "CRYSTAL Administration" : user.compagnieNom;
  const initials = user.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return <div>
    <Sidebar role={user.role} name={user.name} company={company} branch={user.filialeNom}/>
    <main className="ml-64 min-h-screen p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-navy">{title}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle ?? 'NSIA Assurances CI'}</p>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-2 text-sm shadow-soft">
          <div className="text-right">
            <span className="block font-bold text-navy">{company}</span>
            {user.filialeNom && <span className="block text-xs font-semibold text-slate-500">{user.filialeNom}</span>}
          </div>
          <span className="grid h-8 w-8 place-items-center rounded bg-sky font-black text-navy">{initials || "US"}</span>
          <form action={logout}>
            <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:border-sky hover:text-navy" type="submit">
              Déconnexion
            </button>
          </form>
        </div>
      </header>
      <div className="mb-5 rounded-lg border border-sky/20 bg-white/70 px-4 py-2 text-xs font-bold uppercase text-slate-500">
        CRYSTAL - ARIEL INDUSTRIES SARL - Confidentiel
      </div>
      {children}
    </main>
  </div>
}
