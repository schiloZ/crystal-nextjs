import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { createRefActe, createRefAssure, createRefContrat, createRefPlafond, createRefPrestataire } from "./actions";

const toneStyles: Record<string, { top: string; badge: string; value: string }> = {
  sky: { top: "border-t-sky", badge: "bg-sky text-white", value: "text-sky" },
  emerald: { top: "border-t-emerald-600", badge: "bg-emerald-600 text-white", value: "text-emerald-600" },
  violet: { top: "border-t-violet-600", badge: "bg-violet-600 text-white", value: "text-violet-600" },
  orange: { top: "border-t-orange-500", badge: "bg-orange-500 text-white", value: "text-orange-500" },
  blue: { top: "border-t-blue-600", badge: "bg-blue-600 text-white", value: "text-blue-600" },
};

export default async function Page() {
  const user = await requireRole(["super_admin", "admin_compagnie"]);
  const companyWhere = user.role === "super_admin" ? {} : { compagnieId: user.compagnieId };
  const [companies, assures, prestataires, actes, contrats, plafonds, counts] = await Promise.all([
    prisma.compagnie.findMany({ where: user.role === "super_admin" ? {} : { id: user.compagnieId }, orderBy: { nom: "asc" } }),
    prisma.refAssure.findMany({ where: companyWhere, orderBy: { id: "desc" }, take: 8 }),
    prisma.refPrestataire.findMany({ where: companyWhere, orderBy: { id: "desc" }, take: 8 }),
    prisma.refActe.findMany({ where: companyWhere, orderBy: { id: "desc" }, take: 8 }),
    prisma.refContrat.findMany({ where: companyWhere, orderBy: { id: "desc" }, take: 8 }),
    prisma.refPlafond.findMany({ where: companyWhere, include: { contrat: true }, orderBy: { id: "desc" }, take: 8 }),
    Promise.all([
      prisma.refAssure.count({ where: companyWhere }),
      prisma.refPrestataire.count({ where: companyWhere }),
      prisma.refActe.count({ where: companyWhere }),
      prisma.refPlafond.count({ where: companyWhere }),
      prisma.refContrat.count({ where: companyWhere }),
      prisma.utilisateur.count({ where: user.role === "super_admin" ? {} : { compagnieId: user.compagnieId } }),
    ]),
  ]);
  const selectedCompanyId = companies[0]?.id ?? user.compagnieId;
  const cards = [
    { code: "RA", title: "refAssures", subtitle: "Référentiel assurés", value: `${formatNumber(counts[0])} assurés`, tone: "sky" },
    { code: "RP", title: "refPrestataires", subtitle: "Réseau de soins", value: `${formatNumber(counts[1])} prestataires`, tone: "emerald" },
    { code: "AC", title: "refActes", subtitle: "Nomenclature actes", value: `${formatNumber(counts[2])} actes`, tone: "violet" },
    { code: "PL", title: "refPlafonds", subtitle: "Plafonds contrats", value: `${formatNumber(counts[3])} règles`, tone: "orange" },
    { code: "CT", title: "refContrats", subtitle: "Contrats actifs", value: `${formatNumber(counts[4])} contrats`, tone: "blue" },
    { code: "US", title: "Utilisateurs", subtitle: "Gestion des accès", value: `${formatNumber(counts[5])} utilisateurs`, tone: "blue" },
  ];

  return (
    <AppShell title="Paramètres — Tables de référence" subtitle="Configuration / Paramètres">
      <section className="mb-6 overflow-hidden rounded-lg bg-navy text-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-5 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase text-sky">Référentiels CRYSTAL</p>
            <h2 className="mt-1 text-2xl font-black">Données de contrôle de l’audit</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-blue-100">
              Renseignez ici les assurés, prestataires, actes, contrats et plafonds utilisés par le moteur d’audit pour rapprocher les prestations importées.
            </p>
          </div>
          <div className="rounded-lg bg-white/10 px-5 py-4 text-right">
            <p className="text-xs font-semibold text-blue-100">Compagnies disponibles</p>
            <p className="text-3xl font-black text-sky">{formatNumber(companies.length)}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {cards.map((item) => <ReferenceCard item={item} key={item.title} />)}
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-[1fr_430px]">
        <div className="space-y-6">
          <Preview title="Aperçu — refAssures" headers={["Matricule", "Nom", "Prénom", "Police", "Collège", "Statut"]} rows={assures.map((item) => [item.matricule, item.nom, item.prenom ?? "-", item.police ?? "-", item.college ?? item.numeroCollege ?? "-", item.actif ? "Actif" : "Inactif"])} />
          <Preview title="Aperçu — refPrestataires" headers={["Code", "Prestataire", "Statut", "Actif"]} rows={prestataires.map((item) => [item.code, item.nom, item.statut, item.actif ? "Oui" : "Non"])} />
          <Preview title="Aperçu — refActes" headers={["Code acte", "Libellé", "Famille", "Tarif", "Couvert"]} rows={actes.map((item) => [item.codeActe, item.libelle, item.famille ?? "-", formatMoney(Number(item.tarifConventionne)), item.couvert ? "Oui" : "Non"])} />
          <Preview title="Aperçu — refContrats" headers={["Code", "Libellé", "Police", "Souscripteur", "Statut"]} rows={contrats.map((item) => [item.codeContrat, item.libelle, item.police ?? "-", item.souscripteur ?? "-", item.actif ? "Actif" : "Inactif"])} />
          <Preview title="Aperçu — refPlafonds" headers={["Code", "Type", "Police", "Acte/Famille", "Montant"]} rows={plafonds.map((item) => [item.codePlafond, item.typePlafond, item.police ?? item.contrat?.police ?? "-", item.codeActe ?? item.famille ?? "-", formatMoney(Number(item.montantPlafond))])} />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="card p-5">
            <p className="text-xs font-black uppercase text-slate-500">Saisie manuelle</p>
            <h2 className="mt-1 text-xl font-black text-navy">Ajouter une référence</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Ouvrez uniquement le formulaire dont vous avez besoin. Les champs essentiels sont marqués comme obligatoires.</p>
          </div>

          <RefForm title="Ajouter un assuré" action={createRefAssure} companyId={selectedCompanyId} companies={companies} showCompany={user.role === "super_admin"}>
            <Input name="matricule" label="Matricule" required />
            <Input name="nom" label="Nom" required />
            <Input name="prenom" label="Prénom" />
            <Input name="dateNaissance" label="Date naissance" type="date" />
            <Input name="statut" label="Statut bénéficiaire" placeholder="principal, conjoint, enfant..." />
            <Input name="police" label="Police" />
            <Input name="policeInterne" label="Police interne" />
            <Input name="numeroCollege" label="N° collège" />
            <Input name="college" label="Collège" />
            <Input name="codeSouscripteur" label="Code souscripteur" />
            <Input name="souscripteur" label="Souscripteur" />
            <Input name="matriculeAssurePrincipal" label="Matricule assuré principal" />
            <Input name="dateAffiliation" label="Date affiliation" type="date" />
            <Input name="dateRadiation" label="Date radiation" type="date" />
            <StatusSelect />
          </RefForm>

          <RefForm title="Ajouter un prestataire" action={createRefPrestataire} companyId={selectedCompanyId} companies={companies} showCompany={user.role === "super_admin"}>
            <Input name="code" label="Code prestataire" required />
            <Input name="nom" label="Nom prestataire" required />
            <Input name="statut" label="Statut" defaultValue="agree" />
            <StatusSelect />
          </RefForm>

          <RefForm title="Ajouter un acte" action={createRefActe} companyId={selectedCompanyId} companies={companies} showCompany={user.role === "super_admin"}>
            <Input name="codeActe" label="Code acte" required />
            <Input name="libelle" label="Libellé acte" required />
            <Input name="famille" label="Famille" />
            <Input name="tarifConventionne" label="Tarif conventionné" type="number" />
            <SelectBool name="couvert" label="Couvert" />
            <StatusSelect />
          </RefForm>

          <RefForm title="Ajouter un contrat" action={createRefContrat} companyId={selectedCompanyId} companies={companies} showCompany={user.role === "super_admin"}>
            <Input name="codeContrat" label="Code contrat" required />
            <Input name="libelle" label="Libellé" required />
            <Input name="police" label="Police" />
            <Input name="policeInterne" label="Police interne" />
            <Input name="codeSouscripteur" label="Code souscripteur" />
            <Input name="souscripteur" label="Souscripteur" />
            <Input name="dateDebut" label="Début" type="date" />
            <Input name="dateFin" label="Fin" type="date" />
            <StatusSelect />
          </RefForm>

          <RefForm title="Ajouter un plafond" action={createRefPlafond} companyId={selectedCompanyId} companies={companies} showCompany={user.role === "super_admin"}>
            <select className="input" name="contratId"><option value="">Sans contrat lié</option>{contrats.map((contrat) => <option key={contrat.id} value={contrat.id}>{contrat.codeContrat} · {contrat.libelle}</option>)}</select>
            <Input name="codePlafond" label="Code plafond" required />
            <Input name="libelle" label="Libellé" required />
            <Input name="typePlafond" label="Type plafond" placeholder="acte, famille, individuel..." required />
            <Input name="police" label="Police" />
            <Input name="numeroCollege" label="N° collège" />
            <Input name="codeActe" label="Code acte" />
            <Input name="famille" label="Famille" />
            <Input name="montantPlafond" label="Montant plafond" type="number" />
            <Input name="periodicite" label="Périodicité" placeholder="mensuel, annuel..." />
            <StatusSelect />
          </RefForm>
        </aside>
      </section>
    </AppShell>
  );
}

function ReferenceCard({ item }: { item: { code: string; title: string; subtitle: string; value: string; tone: string } }) {
  const tone = toneStyles[item.tone];
  return <article className={`card border-t-[6px] ${tone.top} p-4`}><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md text-xs font-black ${tone.badge}`}>{item.code}</span><div className="min-w-0"><h2 className="truncate text-base font-black text-navy">{item.title}</h2><p className="truncate text-xs font-semibold text-slate-500">{item.subtitle}</p></div></div><p className={`mt-4 text-xl font-black ${tone.value}`}>{item.value}</p><p className="mt-2 text-xs font-black uppercase text-slate-400">Saisie active</p></article>;
}

function Preview({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <section className="card overflow-hidden"><div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4"><div><h2 className="text-lg font-black text-navy">{title}</h2><p className="text-xs font-semibold text-slate-500">Derniers enregistrements saisis</p></div><span className="rounded-md bg-sky/10 px-3 py-2 text-xs font-black text-sky">{formatNumber(rows.length)}</span></div><div className="overflow-x-auto"><table className="table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr className="odd:bg-white even:bg-sky/10" key={index}>{row.map((cell, cellIndex) => <td className={cellIndex === 0 ? "font-mono font-bold text-navy" : ""} key={cellIndex}>{cell}</td>)}</tr>) : <tr><td className="p-8 text-center text-sm font-semibold text-slate-500" colSpan={headers.length}>Aucune donnée enregistrée.</td></tr>}</tbody></table></div></section>;
}

function RefForm({ title, action, children, companyId, companies, showCompany }: { title: string; action: (formData: FormData) => Promise<void>; children: React.ReactNode; companyId: number; companies: Array<{ id: number; nom: string }>; showCompany: boolean }) {
  const open = title.includes("assuré");
  return <details className="card overflow-hidden" open={open}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-white px-5 py-4"><span className="font-black text-navy">{title}</span><span className="rounded-md bg-sky/10 px-3 py-2 text-xs font-black text-sky">Ouvrir</span></summary><form action={action} className="border-t border-line"><div className="grid gap-3 p-5">{showCompany ? <label><span className="mb-1 block text-xs font-black uppercase text-slate-500">Compagnie</span><select className="input" name="compagnieId" defaultValue={companyId}>{companies.map((company) => <option key={company.id} value={company.id}>{company.nom}</option>)}</select></label> : <input name="compagnieId" type="hidden" value={companyId} />}{children}<button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white">Enregistrer</button></div></form></details>;
}

function Input({ label, name, type = "text", required = false, placeholder, defaultValue }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
  return <label><span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span><input className="input" defaultValue={defaultValue} name={name} placeholder={placeholder} required={required} type={type} /></label>;
}

function StatusSelect() { return <SelectBool name="actif" label="Actif" />; }
function SelectBool({ label, name }: { label: string; name: string }) { return <label><span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span><select className="input" name={name} defaultValue="true"><option value="true">Oui</option><option value="false">Non</option></select></label>; }
function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
