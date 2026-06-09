import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { ReferenceSection, type ReferenceField } from "./reference-section";

const toneStyles: Record<string, { top: string; badge: string; value: string }> = {
  sky: { top: "border-t-sky", badge: "bg-sky text-white", value: "text-sky" },
  emerald: { top: "border-t-emerald-600", badge: "bg-emerald-600 text-white", value: "text-emerald-600" },
  violet: { top: "border-t-violet-600", badge: "bg-violet-600 text-white", value: "text-violet-600" },
  orange: { top: "border-t-orange-500", badge: "bg-orange-500 text-white", value: "text-orange-500" },
  blue: { top: "border-t-blue-600", badge: "bg-blue-600 text-white", value: "text-blue-600" },
};

export default async function Page() {
  const user = await getCurrentUser();
  const canManageReferences = ["super_admin", "admin_compagnie"].includes(user.role);
  const companyWhere = user.role === "super_admin" ? {} : { compagnieId: user.compagnieId };
  const [companies, assures, prestataires, actes, contrats, plafonds, counts] = await Promise.all([
    prisma.compagnie.findMany({ where: user.role === "super_admin" ? {} : { id: user.compagnieId }, orderBy: { nom: "asc" } }),
    prisma.refAssure.findMany({ where: companyWhere, orderBy: { id: "desc" }, take: 50 }),
    prisma.refPrestataire.findMany({ where: companyWhere, orderBy: { id: "desc" }, take: 50 }),
    prisma.refActe.findMany({ where: companyWhere, orderBy: { id: "desc" }, take: 50 }),
    prisma.refContrat.findMany({ where: companyWhere, orderBy: { id: "desc" }, take: 50 }),
    prisma.refPlafond.findMany({ where: companyWhere, include: { contrat: true }, orderBy: { id: "desc" }, take: 50 }),
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

      <section className="mt-7 space-y-6">
          <ReferenceSection canManage={canManageReferences} companyId={selectedCompanyId} companies={companies} createFields={assureFields()} showCompany={user.role === "super_admin"} type="assures" title="refAssures — Référentiel assurés" headers={["Matricule", "Nom", "Prénom", "Police", "Collège", "Statut"]} rows={assures.map((item) => ({ id: item.id, cells: [item.matricule, item.nom, item.prenom ?? "-", item.police ?? "-", item.college ?? item.numeroCollege ?? "-", item.actif ? "Actif" : "Inactif"], fields: [
            field("matricule", "Matricule", item.matricule, true), field("nom", "Nom", item.nom, true), field("prenom", "Prénom", item.prenom), field("statut", "Statut", item.statut), field("police", "Police", item.police), field("policeInterne", "Police interne", item.policeInterne), field("numeroCollege", "N° collège", item.numeroCollege), field("college", "Collège", item.college), field("codeSouscripteur", "Code souscripteur", item.codeSouscripteur), field("souscripteur", "Souscripteur", item.souscripteur), field("matriculeAssurePrincipal", "Matricule assuré principal", item.matriculeAssurePrincipal), field("dateNaissance", "Date naissance", dateInputValue(item.dateNaissance), false, "date"), field("dateAffiliation", "Date affiliation", dateInputValue(item.dateAffiliation), false, "date"), field("dateRadiation", "Date radiation", dateInputValue(item.dateRadiation), false, "date"), boolField("actif", "Actif", item.actif),
          ] }))} />
          <ReferenceSection canManage={canManageReferences} companyId={selectedCompanyId} companies={companies} createFields={prestataireFields()} showCompany={user.role === "super_admin"} type="prestataires" title="refPrestataires — Réseau de soins" headers={["Code", "Prestataire", "Statut", "Actif"]} rows={prestataires.map((item) => ({ id: item.id, cells: [item.code, item.nom, item.statut, item.actif ? "Oui" : "Non"], fields: [field("code", "Code", item.code, true), field("nom", "Nom", item.nom, true), field("statut", "Statut", item.statut), boolField("actif", "Actif", item.actif)] }))} />
          <ReferenceSection canManage={canManageReferences} companyId={selectedCompanyId} companies={companies} createFields={acteFields()} showCompany={user.role === "super_admin"} type="actes" title="refActes — Nomenclature actes" headers={["Code acte", "Libellé", "Famille", "Tarif", "Couvert"]} rows={actes.map((item) => ({ id: item.id, cells: [item.codeActe, item.libelle, item.famille ?? "-", formatMoney(Number(item.tarifConventionne)), item.couvert ? "Oui" : "Non"], fields: [field("codeActe", "Code acte", item.codeActe, true), field("libelle", "Libellé", item.libelle, true), field("famille", "Famille", item.famille), field("tarifConventionne", "Tarif conventionné", String(Number(item.tarifConventionne)), false, "number"), boolField("couvert", "Couvert", item.couvert), boolField("actif", "Actif", item.actif)] }))} />
          <ReferenceSection canManage={canManageReferences} companyId={selectedCompanyId} companies={companies} createFields={contratFields()} showCompany={user.role === "super_admin"} type="contrats" title="refContrats — Contrats actifs" headers={["Code", "Libellé", "Police", "Souscripteur", "Statut"]} rows={contrats.map((item) => ({ id: item.id, cells: [item.codeContrat, item.libelle, item.police ?? "-", item.souscripteur ?? "-", item.actif ? "Actif" : "Inactif"], fields: [field("codeContrat", "Code contrat", item.codeContrat, true), field("libelle", "Libellé", item.libelle, true), field("police", "Police", item.police), field("policeInterne", "Police interne", item.policeInterne), field("codeSouscripteur", "Code souscripteur", item.codeSouscripteur), field("souscripteur", "Souscripteur", item.souscripteur), field("dateDebut", "Début", dateInputValue(item.dateDebut), false, "date"), field("dateFin", "Fin", dateInputValue(item.dateFin), false, "date"), boolField("actif", "Actif", item.actif)] }))} />
          <ReferenceSection canManage={canManageReferences} companyId={selectedCompanyId} companies={companies} createFields={plafondFields()} showCompany={user.role === "super_admin"} type="plafonds" title="refPlafonds — Plafonds contrats" headers={["Code", "Type", "Police", "Acte/Famille", "Montant"]} rows={plafonds.map((item) => ({ id: item.id, cells: [item.codePlafond, item.typePlafond, item.police ?? item.contrat?.police ?? "-", item.codeActe ?? item.famille ?? "-", formatMoney(Number(item.montantPlafond))], fields: [field("contratId", "Contrat ID", item.contratId ? String(item.contratId) : "", false, "number"), field("codePlafond", "Code plafond", item.codePlafond, true), field("libelle", "Libellé", item.libelle, true), field("typePlafond", "Type plafond", item.typePlafond, true), field("police", "Police", item.police), field("numeroCollege", "N° collège", item.numeroCollege), field("codeActe", "Code acte", item.codeActe), field("famille", "Famille", item.famille), field("montantPlafond", "Montant plafond", String(Number(item.montantPlafond)), false, "number"), field("periodicite", "Périodicité", item.periodicite), boolField("actif", "Actif", item.actif)] }))} />
      </section>
    </AppShell>
  );
}

function ReferenceCard({ item }: { item: { code: string; title: string; subtitle: string; value: string; tone: string } }) {
  const tone = toneStyles[item.tone];
  return <article className={`card border-t-[6px] ${tone.top} p-4`}><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md text-xs font-black ${tone.badge}`}>{item.code}</span><div className="min-w-0"><h2 className="truncate text-base font-black text-navy">{item.title}</h2><p className="truncate text-xs font-semibold text-slate-500">{item.subtitle}</p></div></div><p className={`mt-4 text-xl font-black ${tone.value}`}>{item.value}</p><p className="mt-2 text-xs font-black uppercase text-slate-400">Saisie active</p></article>;
}

function formatNumber(value: number) { return value.toLocaleString("fr-FR"); }
function formatMoney(value: number) { return `${Math.round(value).toLocaleString("fr-FR")} F`; }
function field(name: string, label: string, value: string | null | undefined, required = false, type = "text"): ReferenceField {
  return { name, label, value: value ?? "", required, type };
}
function boolField(name: string, label: string, value: boolean): ReferenceField {
  return { name, label, value: String(value), bool: true };
}
function dateInputValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}
function assureFields() {
  return [
    field("matricule", "Matricule", "", true),
    field("nom", "Nom", "", true),
    field("prenom", "Prénom", ""),
    field("dateNaissance", "Date naissance", "", false, "date"),
    field("statut", "Statut bénéficiaire", ""),
    field("police", "Police", ""),
    field("policeInterne", "Police interne", ""),
    field("numeroCollege", "N° collège", ""),
    field("college", "Collège", ""),
    field("codeSouscripteur", "Code souscripteur", ""),
    field("souscripteur", "Souscripteur", ""),
    field("matriculeAssurePrincipal", "Matricule assuré principal", ""),
    field("dateAffiliation", "Date affiliation", "", false, "date"),
    field("dateRadiation", "Date radiation", "", false, "date"),
    boolField("actif", "Actif", true),
  ];
}
function prestataireFields() {
  return [field("code", "Code prestataire", "", true), field("nom", "Nom prestataire", "", true), field("statut", "Statut", "agree"), boolField("actif", "Actif", true)];
}
function acteFields() {
  return [field("codeActe", "Code acte", "", true), field("libelle", "Libellé acte", "", true), field("famille", "Famille", ""), field("tarifConventionne", "Tarif conventionné", "0", false, "number"), boolField("couvert", "Couvert", true), boolField("actif", "Actif", true)];
}
function contratFields() {
  return [field("codeContrat", "Code contrat", "", true), field("libelle", "Libellé", "", true), field("police", "Police", ""), field("policeInterne", "Police interne", ""), field("codeSouscripteur", "Code souscripteur", ""), field("souscripteur", "Souscripteur", ""), field("dateDebut", "Début", "", false, "date"), field("dateFin", "Fin", "", false, "date"), boolField("actif", "Actif", true)];
}
function plafondFields() {
  return [field("contratId", "Contrat ID", "", false, "number"), field("codePlafond", "Code plafond", "", true), field("libelle", "Libellé", "", true), field("typePlafond", "Type plafond", "", true), field("police", "Police", ""), field("numeroCollege", "N° collège", ""), field("codeActe", "Code acte", ""), field("famille", "Famille", ""), field("montantPlafond", "Montant plafond", "0", false, "number"), field("periodicite", "Périodicité", ""), boolField("actif", "Actif", true)];
}
