"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "@/lib/mock-data";

const groups = ["RAPPORTS", "ANALYSE", "CONFIG.", "ADMINISTRATION"];

export function Sidebar({ role, name, company, branch }: { role: string; name: string; company: string; branch?: string | null }){
  const pathname = usePathname();
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const visibleNav = nav.filter((item) => !("roles" in item) || item.roles?.includes(role));
  const visibleGroups = groups.filter((group) => visibleNav.some((item) => item.group === group));

  return <aside className="fixed left-0 top-0 h-screen w-64 bg-navy text-white flex flex-col shadow-2xl">
    <div className="p-5">
      <div className="rounded-lg bg-sky px-4 py-3 font-black text-2xl text-navy">CRYSTAL</div>
      <p className="mt-2 text-xs font-semibold text-blue-100">Audit Gestion Santé</p>
    </div>
    <nav className="flex-1 overflow-y-auto px-3 pb-3">
      {visibleGroups.map(group => <div key={group} className="mb-4">
        <p className="px-3 pb-2 text-[10px] font-black tracking-widest text-sky">{group}</p>
        <div className="space-y-1">
          {visibleNav.filter(n => n.group === group).map(n => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-sky text-white shadow-lg shadow-sky/20" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
            <span className="grid h-6 w-7 place-items-center rounded text-[10px] font-black text-white shadow-sm" style={{ backgroundColor: active ? "#0b77b6" : n.color }}>{n.icon}</span>
            <span>{n.label}</span>
          </Link>
          })}
        </div>
      </div>)}
    </nav>
    <div className="m-4 rounded-lg bg-white/10 p-3 text-xs">
      <div className="mb-2 grid h-8 w-8 place-items-center rounded bg-sky font-black text-navy">{initials || "US"}</div>
      <b className="block truncate">{name}</b>
      <span className="block truncate text-blue-100">{company}</span>
      {branch && <span className="block truncate text-blue-200">{branch}</span>}
    </div>
  </aside>
}
