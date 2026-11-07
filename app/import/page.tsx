import { AppShell } from "@/components/app-shell";
import { IMPORT_ROLES, requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { ImportWorkspace } from "@/components/import-workspace";

export default async function Page() {
  const user = await requireRole(IMPORT_ROLES);
  const companyId = user.compagnieId;
  const [recentFiles, managers, branches, exercises] = await Promise.all([
    prisma.fichierImporte.findMany({
      where: { compagnieId: companyId },
      include: { gestionnaire: true, filiale: true },
      orderBy: { dateImport: "desc" },
      take: 5,
    }),
    prisma.gestionnaire.findMany({
      where: { compagnieId: companyId, actif: true },
      orderBy: { nom: "asc" },
    }),
    prisma.filiale.findMany({
      where: { compagnieId: companyId, actif: true },
      orderBy: { nom: "asc" },
    }),
    prisma.exerciceComptable.findMany({
      where: { compagnieId: companyId, actif: true },
      orderBy: { dateDebut: "desc" },
    }),
  ]);

  const files = recentFiles.map((file) => ({
    id: file.id,
    name: file.nomFichier,
    date: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(file.dateImport),
    lines: file.nbLignesTotal,
    anomalies: file.nbLignesAnomalies,
    status: file.statut,
    manager: file.gestionnaire.nom,
    branch: file.filiale.nom,
  }));

  return (
    <AppShell title="Importer un fichier de soins" subtitle="Audit / Nouvelle importation">
      <ImportWorkspace
        branches={branches.map((branch) => ({ id: branch.id, name: branch.nom }))}
        company={user.compagnieNom}
        exercises={exercises.map((exercise) => ({
          id: exercise.id,
          code: exercise.codeExercice,
          start: exercise.dateDebut.toISOString(),
          end: exercise.dateFin.toISOString(),
        }))}
        files={files}
        managers={managers.map((manager) => ({ id: manager.id, name: `${manager.prenoms ?? ""} ${manager.nom}`.trim() }))}
      />
    </AppShell>
  );
}
