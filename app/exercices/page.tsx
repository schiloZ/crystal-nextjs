import { Fragment } from "react";
import { CalendarCheck, CalendarClock, Files, Landmark } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { ExerciseForm } from "./exercise-form";
import { toggleExercise, updateTardinessWindow } from "./actions";

export default async function ExercisesPage() {
  const current = await requireRole(["super_admin", "admin_compagnie"]);
  const companies = await prisma.compagnie.findMany({
    where: current.role === "super_admin" ? {} : { id: current.compagnieId },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });
  const exercises = await prisma.exerciceComptable.findMany({
    where: current.role === "super_admin" ? {} : { compagnieId: current.compagnieId },
    include: {
      fichiers: { include: { filiale: true, gestionnaire: true }, orderBy: { dateImport: "desc" } },
      _count: { select: { fichiers: true } },
    },
    orderBy: [{ actif: "desc" }, { dateDebut: "desc" }],
  });
  const companyNames = new Map(companies.map((company) => [company.id, company.nom]));
  const activeCount = exercises.filter((exercise) => exercise.actif).length;
  const totalFiles = exercises.reduce((sum, exercise) => sum + exercise._count.fichiers, 0);

  return (
    <AppShell title="Exercices comptables" subtitle="Administration / Exercices comptables">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Summary icon={<CalendarClock size={21} />} label="Exercices enregistrés" value={String(exercises.length)} tone="sky" />
        <Summary icon={<CalendarCheck size={21} />} label="Exercices actifs" value={String(activeCount)} tone="emerald" />
        <Summary icon={<Files size={21} />} label="Fichiers rattachés" value={String(totalFiles)} tone="orange" />
        <Summary icon={<Landmark size={21} />} label="Compagnies suivies" value={String(companies.length)} tone="violet" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <div><h2 className="text-lg font-black text-navy">Périodes comptables</h2><p className="text-xs font-semibold text-slate-500">Exercices disponibles pour les imports et audits</p></div>
            <span className="rounded-md bg-sky/10 px-3 py-2 text-xs font-black text-sky">{exercises.length} EXERCICES</span>
          </div>
          {exercises.length === 0 ? <p className="p-10 text-center text-sm font-semibold text-slate-500">Aucun exercice comptable enregistré.</p> : <table className="table">
            <thead><tr><th>Exercice</th><th>Compagnie</th><th>Période</th><th>Tolérance tardifs</th><th>Fichiers</th><th>Statut</th><th>Action</th></tr></thead>
            <tbody>{exercises.map((exercise, index) => <Fragment key={exercise.id}>
              <tr className={index % 2 ? "bg-sky/10" : "bg-white"}>
                <td className="font-black text-navy">{exercise.codeExercice}</td>
                <td>{companyNames.get(exercise.compagnieId) ?? "Compagnie"}</td>
                <td><span className="block font-bold text-navy">{formatDate(exercise.dateDebut)} → {formatDate(exercise.dateFin)}</span><span className="text-xs text-slate-500">{durationLabel(exercise.dateDebut, exercise.dateFin)}</span></td>
                <td><form action={updateTardinessWindow} className="flex min-w-80 items-center gap-2"><input name="id" type="hidden" value={exercise.id}/><input className="input py-2 text-xs" defaultValue={exercise.dateDebutToleranceTardif ? dateInputValue(exercise.dateDebutToleranceTardif) : ""} name="dateDebutToleranceTardif" type="date"/><input className="input py-2 text-xs" defaultValue={exercise.dateFinToleranceTardif ? dateInputValue(exercise.dateFinToleranceTardif) : ""} name="dateFinToleranceTardif" type="date"/><button className="rounded-md bg-sky/10 px-3 py-2 text-xs font-black text-sky">Définir</button></form></td>
                <td className="font-black text-navy">{exercise._count.fichiers}</td>
                <td><span className={`badge ${exercise.actif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{exercise.actif ? "Actif" : "Inactif"}</span></td>
                <td><form action={toggleExercise}><input name="id" type="hidden" value={exercise.id} /><button className={`rounded-md px-3 py-2 text-xs font-black ${exercise.actif ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{exercise.actif ? "Désactiver" : "Activer"}</button></form></td>
              </tr>
              <tr className="bg-slate-50">
                <td colSpan={7}>
                  <div className="space-y-2 px-3 py-4">
                    <p className="text-xs font-black uppercase text-slate-500">Fichiers importés sous cet exercice</p>
                    {exercise.fichiers.length === 0 ? <p className="rounded-md bg-white px-4 py-3 text-sm font-semibold text-slate-500">Aucun fichier importé pour cet exercice.</p> : <div className="grid gap-2">{exercise.fichiers.map((file) => <a className="grid grid-cols-1 gap-2 rounded-md border border-line bg-white px-4 py-3 text-sm shadow-sm hover:border-sky lg:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.6fr]" href={`/synthese?fichier=${file.id}`} key={file.id}>
                      <span><b className="block text-navy">{file.nomFichier}</b><span className="text-xs font-semibold text-slate-500">Importé le {formatDate(file.dateImport)}</span></span>
                      <span><b className="block text-navy">{file.filiale.nom}</b><span className="text-xs font-semibold text-slate-500">{fullManagerName(file.gestionnaire.prenoms, file.gestionnaire.nom)}</span></span>
                      <span><b className="block text-navy">{monthLabel(file.moisFichier, file.anneeFichier)}</b><span className="text-xs font-semibold text-slate-500">Période fichier</span></span>
                      <span><b className="block text-navy">{formatNumber(file.nbLignesTotal)}</b><span className="text-xs font-semibold text-slate-500">Lignes</span></span>
                      <span><b className="block text-red-600">{formatNumber(file.nbLignesAnomalies)}</b><span className="text-xs font-semibold text-slate-500">Anomalies</span></span>
                    </a>)}</div>}
                  </div>
                </td>
              </tr>
            </Fragment>)}</tbody>
          </table>}
        </div>

        <aside className="card h-fit overflow-hidden">
          <div className="bg-navy px-6 py-5 text-white"><h2 className="text-lg font-black">Nouvel exercice</h2><p className="text-xs font-semibold text-blue-100">Créer une période exploitable pour les imports</p></div>
          <ExerciseForm companies={companies} showCompany={current.role === "super_admin"} />
        </aside>
      </section>
    </AppShell>
  );
}

function Summary({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  const colors: Record<string, string> = { sky: "bg-sky", emerald: "bg-emerald-600", orange: "bg-orange-500", violet: "bg-violet-600" };
  return <div className="card flex items-center gap-4 p-5"><span className={`grid h-12 w-12 place-items-center rounded-full text-white ${colors[tone]}`}>{icon}</span><div><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="text-2xl font-black text-navy">{value}</p></div></div>;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR");
}

function fullManagerName(prenoms: string | null, nom: string) {
  return `${prenoms ?? ""} ${nom}`.trim();
}

function monthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function durationLabel(start: Date, end: Date) {
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return `${days} jours`;
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
