"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  FileCheck2,
  FileSpreadsheet,
  History,
  Info,
  Link2,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { DeleteImportedFileButton } from "@/components/delete-imported-file-button";
import { notifyToast } from "@/components/toaster";

type RecentFile = {
  id: number;
  name: string;
  date: string;
  lines: number;
  anomalies: number;
  status: string;
  manager: string;
  branch: string;
};
type Option = { id: number; name: string };
type Exercise = { id: number; code: string; start: string; end: string };
type Mapping = Record<string, { target: string; confidence: number }>;
type ImportResult = {
  fileId: number;
  fileName: string;
  prestations: number;
  anomalies: number;
  lignesImpactees: number;
  montantReclame: number;
  montantImpacte: number;
};

const controls = [
  ["Intégrité", "Champs requis et formats"],
  ["Doublons", "Prestations identiques"],
  ["Bénéficiaires", "Droits et affiliations"],
  ["Prestataires", "Réseau et agréments"],
  ["Montants", "Tarifs et plafonds"],
  ["Temporel", "Dates et périodes"],
];

const monthOptions = [
  { value: "1", label: "Janvier" },
  { value: "2", label: "Février" },
  { value: "3", label: "Mars" },
  { value: "4", label: "Avril" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Juin" },
  { value: "7", label: "Juillet" },
  { value: "8", label: "Août" },
  { value: "9", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
];

const prestationFields = [
  {
    key: "numeroPrestation",
    label: "Numéro prestation",
    required: false,
    aliases: [
      "numero prestation",
      "n prestation",
      "num prestation",
      "reference prestation",
      "numero dossier",
    ],
  },
  {
    key: "codeSouscripteur",
    label: "Code souscripteur",
    required: false,
    aliases: ["code souscripteur", "id souscripteur", "numero souscripteur"],
  },
  {
    key: "souscripteur",
    label: "Souscripteur",
    required: false,
    aliases: [
      "souscripteur",
      "nom souscripteur",
      "raison sociale souscripteur",
    ],
  },
  {
    key: "dateSoins",
    label: "Date des soins",
    required: true,
    aliases: ["date soins", "date de soins", "date prestation", "date acte"],
  },
  {
    key: "dateComptable",
    label: "Date comptable",
    required: false,
    aliases: [
      "date comptable",
      "date saisie",
      "date paiement",
      "date reglement",
    ],
  },
  {
    key: "codeAffection",
    label: "Code affection",
    required: false,
    aliases: ["code affection", "code pathologie", "code maladie"],
  },
  {
    key: "affection",
    label: "Affection",
    required: false,
    aliases: ["affection", "pathologie", "maladie"],
  },
  {
    key: "codeFamillePrestation",
    label: "Code famille prestation",
    required: false,
    aliases: [
      "code famille prestation",
      "code famille",
      "code categorie prestation",
    ],
  },
  {
    key: "famillePrestation",
    label: "Famille prestation",
    required: false,
    aliases: ["famille prestation", "famille acte", "categorie prestation"],
  },
  {
    key: "codeActe",
    label: "Code acte",
    required: false,
    aliases: ["code acte", "code prestation", "code soin", "acte code"],
  },
  {
    key: "acte",
    label: "Libellé acte",
    required: false,
    aliases: ["acte", "libelle acte", "nom acte", "designation acte"],
  },
  {
    key: "codePrescripteur",
    label: "Code prescripteur",
    required: false,
    aliases: ["code prescripteur", "matricule prescripteur", "id prescripteur"],
  },
  {
    key: "prescripteur",
    label: "Prescripteur",
    required: false,
    aliases: ["prescripteur", "nom prescripteur", "medecin prescripteur"],
  },
  {
    key: "codePrestataire",
    label: "Code prestataire",
    required: false,
    aliases: ["code prestataire", "matricule prestataire", "id prestataire"],
  },
  {
    key: "prestataire",
    label: "Nom prestataire",
    required: false,
    aliases: [
      "prestataire",
      "nom prestataire",
      "centre de soin",
      "centre soins",
    ],
  },
  {
    key: "matriculeAssurePrincipal",
    label: "Matricule assuré principal",
    required: false,
    aliases: [
      "matricule assure principal",
      "matricule assure",
      "matricule principal",
      "id assure",
    ],
  },
  {
    key: "nomAssurePrincipal",
    label: "Nom assuré principal",
    required: false,
    aliases: ["nom assure principal", "assure principal", "nom assure"],
  },
  {
    key: "prenomsAssurePrincipal",
    label: "Prénoms assuré principal",
    required: false,
    aliases: [
      "prenoms assure principal",
      "prenom assure principal",
      "prenoms assure",
    ],
  },
  {
    key: "matriculeBeneficiaire",
    label: "Matricule bénéficiaire",
    required: false,
    aliases: ["matricule beneficiaire", "id beneficiaire", "matricule benef"],
  },
  {
    key: "nomBeneficiaire",
    label: "Nom bénéficiaire",
    required: false,
    aliases: ["nom beneficiaire", "beneficiaire", "nom benef"],
  },
  {
    key: "prenomsBeneficiaire",
    label: "Prénoms bénéficiaire",
    required: false,
    aliases: [
      "prenoms beneficiaire",
      "prenom beneficiaire",
      "prenoms benef",
      "prenom benef",
    ],
  },
  {
    key: "statutBeneficiaire",
    label: "Statut bénéficiaire",
    required: false,
    aliases: [
      "statut beneficiaire",
      "type beneficiaire",
      "qualite beneficiaire",
    ],
  },
  {
    key: "dateNaissanceBeneficiaire",
    label: "Date naissance bénéficiaire",
    required: false,
    aliases: [
      "date naissance beneficiaire",
      "naissance beneficiaire",
      "date de naissance",
    ],
  },
  {
    key: "police",
    label: "Police",
    required: false,
    aliases: ["police", "numero police", "code police"],
  },
  {
    key: "policeInterne",
    label: "Police interne",
    required: false,
    aliases: ["police interne", "numero police interne", "code police interne"],
  },
  {
    key: "numeroCollege",
    label: "Numéro collège",
    required: false,
    aliases: ["numero college", "num college", "code college"],
  },
  {
    key: "college",
    label: "Collège",
    required: false,
    aliases: ["college", "nom college", "libelle college"],
  },
  {
    key: "montantReclame",
    label: "Montant réclamé",
    required: true,
    aliases: ["montant reclame", "montant facture", "montant total", "montant"],
  },
  {
    key: "montantExclu",
    label: "Montant exclu",
    required: false,
    aliases: ["montant exclu", "montant exclusion", "exclusion montant"],
  },
  {
    key: "baseRemboursement",
    label: "Base de remboursement",
    required: false,
    aliases: [
      "base remboursement",
      "base de remboursement",
      "base remboursable",
    ],
  },
  {
    key: "ticketModerateur",
    label: "Ticket modérateur",
    required: false,
    aliases: [
      "ticket moderateur",
      "taux ticket moderateur",
      "part ticket moderateur",
    ],
  },
  {
    key: "montantTicketModerateur",
    label: "Montant ticket modérateur",
    required: false,
    aliases: ["montant ticket moderateur", "ticket moderateur montant"],
  },
  {
    key: "montantPaye",
    label: "Montant payé",
    required: false,
    aliases: ["montant paye", "montant regle", "montant rembourse", "net paye"],
  },
  {
    key: "codeExercice",
    label: "Code exercice",
    required: false,
    aliases: ["code exercice", "exercice", "annee exercice"],
  },
  {
    key: "debutExercice",
    label: "Début exercice",
    required: false,
    aliases: ["debut exercice", "date debut exercice"],
  },
  {
    key: "finExercice",
    label: "Fin exercice",
    required: false,
    aliases: ["fin exercice", "date fin exercice"],
  },
  {
    key: "moisFichier",
    label: "Mois fichier",
    required: false,
    aliases: ["mois fichier", "mois prestation", "mois"],
  },
  {
    key: "codeGestionnaire",
    label: "Code gestionnaire",
    required: false,
    aliases: ["code gestionnaire", "gestionnaire code"],
  },
  {
    key: "codeFiliale",
    label: "Code filiale",
    required: false,
    aliases: ["code filiale", "filiale code"],
  },
];

export function ImportWorkspace({
  company,
  branches,
  managers,
  exercises,
  files,
}: {
  company: string;
  branches: Option[];
  managers: Option[];
  exercises: Exercise[];
  files: RecentFile[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedManager, setSelectedManager] = useState("");
  const [selectedExercise, setSelectedExercise] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [enabledControls, setEnabledControls] = useState(
    controls.map(([name]) => name),
  );
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [parseError, setParseError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  function chooseFile(file?: File) {
    if (!file) return;
    setSelectedFile(file);
    setHeaders([]);
    setMapping({});
    setParseError("");
  }

  function toggleControl(name: string) {
    setEnabledControls((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  }

  async function prepareMapping() {
    if (!selectedFile) return;
    setParsing(true);
    setParseError("");
    try {
      const module = await import("xlsx");
      const XLSX = module.default ?? module;
      const buffer = await selectedFile.arrayBuffer();
      if (!buffer.byteLength)
        throw new Error("Le fichier sélectionné est vide.");

      const workbook = XLSX.read(new Uint8Array(buffer), {
        type: "array",
        cellDates: true,
        dense: true,
      });
      if (!workbook.SheetNames.length)
        throw new Error("Aucune feuille Excel n'a été trouvée.");

      const candidates = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils
          .sheet_to_json<(string | number | boolean)[]>(sheet, {
            header: 1,
            defval: "",
            raw: false,
            blankrows: false,
          })
          .filter(Array.isArray);
        const headerIndex = findHeaderRow(rows);
        return {
          sheetName,
          rows,
          headerIndex,
          score: headerIndex >= 0 ? headerRowScore(rows[headerIndex]) : 0,
        };
      }).sort((left, right) => right.score - left.score);

      const selected = candidates[0];
      if (!selected || selected.headerIndex < 0)
        throw new Error(
          "Aucune ligne d'en-têtes exploitable n'a été détectée.",
        );
      const rawHeaders = selected.rows[selected.headerIndex];
      const lastColumn = findLastUsedColumn(
        selected.rows,
        selected.headerIndex,
      );
      const fileHeaders = uniqueHeaders(
        rawHeaders
          .slice(0, lastColumn + 1)
          .map((cell, index) => String(cell).trim() || `Colonne ${index + 1}`),
      );
      if (fileHeaders.length < 2)
        throw new Error(
          "La ligne d'en-têtes détectée contient moins de deux colonnes.",
        );
      const examples = selected.rows
        .slice(selected.headerIndex + 1, selected.headerIndex + 4)
        .map((row) => fileHeaders.map((_, index) => String(row[index] ?? "")));
      setHeaders(fileHeaders);
      setPreviewRows(examples);
      setMapping(autoMap(fileHeaders));
      setStep(2);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Erreur de lecture inconnue.";
      setParseError(`Impossible de lire ce fichier Excel : ${detail}`);
    } finally {
      setParsing(false);
    }
  }

  async function submitImport() {
    if (!selectedFile) return;
    setImporting(true);
    setImportError("");
    try {
      const form = new FormData();
      form.set("file", selectedFile);
      form.set("branchId", selectedBranch);
      form.set("managerId", selectedManager);
      form.set("exerciseId", selectedExercise);
      form.set("fileMonth", selectedMonth);
      form.set("fileYear", selectedYear);
      form.set("mapping", JSON.stringify(mapping));
      form.set("controls", JSON.stringify(enabledControls));
      const response = await fetch("/api/import", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "L'importation a échoué.");
      setImportResult(result);
      notifyToast("success", "Importation terminée et audit lancé avec succès.");
      setStep(3);
    } catch (error) {
      const message = error instanceof Error ? error.message : "L'importation a échoué.";
      setImportError(message);
      notifyToast("error", message);
    } finally {
      setImporting(false);
    }
  }

  const mappedTargets = Object.values(mapping)
    .map((item) => item.target)
    .filter(Boolean);
  const missingRecommended = prestationFields.filter(
    (field) => field.required && !mappedTargets.includes(field.key),
  );
  const duplicates = mappedTargets.filter(
    (target, index) => mappedTargets.indexOf(target) !== index,
  );

  if (step === 3 && importResult)
    return <ImportComplete result={importResult} />;

  if (step === 2) {
    return (
      <MappingStep
        duplicates={duplicates}
        file={selectedFile!}
        headers={headers}
        mapping={mapping}
        missingRecommended={missingRecommended}
        previewRows={previewRows}
        setMapping={setMapping}
        importError={importError}
        importing={importing}
        onImport={submitImport}
        onBack={() => setStep(1)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Summary
          icon={<FileSpreadsheet size={20} />}
          label="Format attendu"
          value="Excel .xlsx"
          tone="sky"
        />
        <Summary
          icon={<ShieldCheck size={20} />}
          label="Contrôles activés"
          value={`${enabledControls.length} catégories`}
          tone="emerald"
        />
        <Summary
          icon={<CalendarDays size={20} />}
          label="Exercices disponibles"
          value={String(exercises.length)}
          tone="orange"
        />
        <Summary
          icon={<FileCheck2 size={20} />}
          label="Dernier import"
          value={files[0]?.date ?? "Aucun import"}
          tone="violet"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <SectionHeader
              title="Fichier de prestations"
              subtitle="Une ligne par prestation, modèle CRYSTAL recommandé"
              step="ÉTAPE 1 / 3"
            />
            <div className="p-6">
              {!selectedFile ? (
                <DropZone inputRef={inputRef} chooseFile={chooseFile} />
              ) : (
                <SelectedFile
                  file={selectedFile}
                  remove={() => setSelectedFile(null)}
                />
              )}
              <input
                accept=".xls,.xlsx"
                className="hidden"
                onChange={(event) => chooseFile(event.target.files?.[0])}
                ref={inputRef}
                type="file"
              />
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-sky/20 bg-sky/5 px-4 py-3 text-xs font-semibold text-slate-600">
                <Info className="shrink-0 text-sky" size={17} />
                Le système tentera automatiquement de faire correspondre les
                colonnes avec les champs importants de la table Prestation.
              </div>
              {parseError && (
                <p className="mt-4 rounded-lg bg-red-100 px-4 py-3 text-sm font-bold text-red-700">
                  {parseError}
                </p>
              )}
            </div>
          </div>
          <RecentImports files={files} />
        </div>

        <aside className="card h-fit overflow-hidden">
          <div className="flex items-center gap-3 bg-navy px-6 py-5 text-white">
            <Settings2 size={22} />
            <div>
              <h2 className="font-black">Configuration de l’audit</h2>
              <p className="text-xs font-semibold text-blue-100">
                Définissez le périmètre avant analyse
              </p>
            </div>
          </div>
          <div className="space-y-5 p-6">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Compagnie" options={[{ id: 0, name: company }]} />
              <Select
                label="Filiale"
                options={branches}
                placeholder="Sélectionner"
                value={selectedBranch}
                onChange={setSelectedBranch}
              />
            </div>
            <Select
              label="Gestionnaire"
              options={managers}
              placeholder="Sélectionner un gestionnaire"
              value={selectedManager}
              onChange={setSelectedManager}
            />
            <fieldset>
              <legend className="mb-2 text-xs font-black uppercase text-slate-500">
                Exercice comptable
              </legend>
              {exercises.length > 0 ? (
                <label className="block">
                  <select
                    className="input"
                    onChange={(event) =>
                      setSelectedExercise(event.target.value)
                    }
                    required
                    value={selectedExercise}
                  >
                    <option disabled value="">
                      Sélectionner un exercice actif
                    </option>
                    {exercises.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.code} · {formatDate(exercise.start)} au{" "}
                        {formatDate(exercise.end)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <p className="text-sm font-black text-orange-700">
                    Aucun exercice actif disponible
                  </p>
                </div>
              )}
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-xs font-black uppercase text-slate-500">
                Période du fichier
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1 block text-xs font-black text-navy">
                    Mois
                  </span>
                  <select
                    className="input"
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    required
                    value={selectedMonth}
                  >
                    <option disabled value="">
                      Mois
                    </option>
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-black text-navy">
                    Année
                  </span>
                  <input
                    className="input"
                    max="2100"
                    min="2000"
                    onChange={(event) => setSelectedYear(event.target.value)}
                    required
                    type="number"
                    value={selectedYear}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Obligatoire : cette période servira à classer l’import et les
                rapports.
              </p>
            </fieldset>
            <fieldset className="border-t border-line pt-5">
              <div className="mb-3 flex items-center justify-between">
                <legend className="text-xs font-black uppercase text-slate-500">
                  Contrôles à exécuter
                </legend>
                <button
                  className="text-xs font-black text-sky"
                  onClick={() =>
                    setEnabledControls(controls.map(([name]) => name))
                  }
                  type="button"
                >
                  Tout activer
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {controls.map(([name, description]) => (
                  <Control
                    key={name}
                    active={enabledControls.includes(name)}
                    description={description}
                    name={name}
                    toggle={toggleControl}
                  />
                ))}
              </div>
            </fieldset>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              disabled={
                !selectedFile ||
                !selectedBranch ||
                !selectedManager ||
                !selectedExercise ||
                !selectedMonth ||
                !selectedYear ||
                parsing
              }
              onClick={prepareMapping}
              type="button"
            >
              {parsing
                ? "Lecture du fichier..."
                : "Analyser et mapper les colonnes"}{" "}
              <ChevronRight size={18} />
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}

function MappingStep({
  file,
  headers,
  previewRows,
  mapping,
  setMapping,
  missingRecommended,
  duplicates,
  importing,
  importError,
  onImport,
  onBack,
}: {
  file: File;
  headers: string[];
  previewRows: string[][];
  mapping: Mapping;
  setMapping: React.Dispatch<React.SetStateAction<Mapping>>;
  missingRecommended: typeof prestationFields;
  duplicates: string[];
  importing: boolean;
  importError: string;
  onImport: () => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const mappedCount = Object.values(mapping).filter(
    (item) => item.target,
  ).length;
  const valid = mappedCount > 0 && duplicates.length === 0;
  const normalizedSearch = normalize(search);
  const visibleHeaders = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header, index }) => {
      if (!normalizedSearch) return true;
      const currentField = prestationFields.find(
        (field) => field.key === mapping[header]?.target,
      );
      const examples = previewRows
        .map((row) => row[index])
        .filter(Boolean)
        .join(" ");
      return normalize(
        `${header} ${examples} ${currentField?.label ?? ""} ${currentField?.key ?? ""}`,
      ).includes(normalizedSearch);
    });
  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <SectionHeader
          title="Correspondance des colonnes"
          subtitle={`${file.name} · ${headers.length} colonnes détectées`}
          step="ÉTAPE 2 / 3"
        />
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <Summary
            icon={<Sparkles size={20} />}
            label="Colonnes mappées"
            value={`${mappedCount}/${headers.length}`}
            tone="sky"
          />
          <Summary
            icon={<AlertTriangle size={20} />}
            label="Recommandées absentes"
            value={String(missingRecommended.length)}
            tone="orange"
          />
          <Summary
            icon={<Link2 size={20} />}
            label="Correspondances en double"
            value={String(new Set(duplicates).size)}
            tone="violet"
          />
        </div>
      </section>
      <div className="flex items-center justify-between gap-4">
        <button
          className="flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-black text-navy"
          onClick={onBack}
        >
          <ArrowLeft size={17} /> Retour à la configuration
        </button>
        <p className="text-xs font-semibold text-slate-500">
          Vous pouvez modifier toutes les propositions automatiques.
        </p>
      </div>
      {missingRecommended.length > 0 && (
        <div className="rounded-lg border border-sky/30 bg-sky/5 px-5 py-4 text-sm font-semibold text-slate-700">
          <b className="text-navy">Import partiel autorisé.</b> Les champs
          suivants sont recommandés pour obtenir un audit plus complet :{" "}
          {missingRecommended.map((field) => field.label).join(", ")}.
        </div>
      )}
      {duplicates.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          Une colonne cible ne peut être utilisée qu’une seule fois. Corrigez
          les correspondances en double pour continuer.
        </div>
      )}
      {mappedCount === 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-5 py-4 text-sm font-bold text-orange-700">
          Mappez au moins une colonne du fichier pour continuer.
        </div>
      )}
      <section className="card overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-navy">
                Mapping fichier → table Prestation
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Les exemples proviennent des trois premières lignes du fichier.
              </p>
            </div>
            <label className="relative min-w-72 flex-1 max-w-xl">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={17}
              />
              <input
                className="input pl-10 pr-10"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filtrer les colonnes du fichier..."
                value={search}
              />
              {search && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600"
                  onClick={() => setSearch("")}
                  title="Effacer la recherche"
                  type="button"
                >
                  <X size={16} />
                </button>
              )}
            </label>
          </div>
          {search && (
            <p className="mt-3 text-xs font-black text-sky">
              {visibleHeaders.length}/{headers.length} colonne(s) visibles
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Colonne du fichier</th>
                <th>Exemples détectés</th>
                <th>Champ Prestation</th>
                <th>Confiance</th>
              </tr>
            </thead>
            <tbody>
              {visibleHeaders.map(({ header, index }) => {
                const current = mapping[header] ?? {
                  target: "",
                  confidence: 0,
                };
                const duplicate =
                  current.target && duplicates.includes(current.target);
                return (
                  <tr
                    className={
                      duplicate
                        ? "bg-red-50"
                        : current.target
                          ? "bg-emerald-50/30"
                          : "bg-slate-50"
                    }
                    key={`${header}-${index}`}
                  >
                    <td className="font-black text-navy">{header}</td>
                    <td>
                      <div className="max-w-64 truncate text-xs text-slate-600">
                        {previewRows
                          .map((row) => row[index])
                          .filter(Boolean)
                          .join(" · ") || "Aucune valeur"}
                      </div>
                    </td>
                    <td>
                      <FieldPicker
                        duplicate={Boolean(duplicate)}
                        onChange={(target) =>
                          setMapping((existing) => ({
                            ...existing,
                            [header]: {
                              target,
                              confidence:
                                target === current.target
                                  ? current.confidence
                                  : 0,
                            },
                          }))
                        }
                        value={current.target}
                      />
                    </td>
                    <td>
                      <Confidence
                        confidence={current.confidence}
                        mapped={Boolean(current.target)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleHeaders.length === 0 && (
            <p className="border-t border-line p-10 text-center text-sm font-semibold text-slate-500">
              Aucune colonne ne correspond à cette recherche.
            </p>
          )}
        </div>
      </section>
      {importError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {importError}
        </div>
      )}
      <div className="flex justify-end">
        <button
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-7 py-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20 disabled:bg-slate-300 disabled:shadow-none"
          disabled={!valid || importing}
          onClick={onImport}
          type="button"
        >
          {importing
            ? "Importation et audit en cours..."
            : "Valider, importer et lancer l'audit"}{" "}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function ImportComplete({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="bg-emerald-600 px-6 py-6 text-white">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/20">
              <Check size={30} />
            </span>
            <div>
              <h2 className="text-2xl font-black">
                Importation et audit terminés
              </h2>
              <p className="text-sm font-semibold text-emerald-50">
                {result.fileName} a été enregistré et analysé.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-4">
          <Summary
            icon={<FileSpreadsheet size={20} />}
            label="Prestations importées"
            value={result.prestations.toLocaleString("fr-FR")}
            tone="sky"
          />
          <Summary
            icon={<AlertTriangle size={20} />}
            label="Anomalies détectées"
            value={result.anomalies.toLocaleString("fr-FR")}
            tone="orange"
          />
          <Summary
            icon={<ShieldCheck size={20} />}
            label="Lignes impactées"
            value={result.lignesImpactees.toLocaleString("fr-FR")}
            tone="violet"
          />
          <Summary
            icon={<FileCheck2 size={20} />}
            label="Montant réclamé"
            value={`${Math.round(result.montantReclame).toLocaleString("fr-FR")} F`}
            tone="emerald"
          />
        </div>
      </section>
      <section className="card p-6">
        <h3 className="font-black text-navy">Résultat de l’audit</h3>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          Montant total impacté :{" "}
          <b className="text-red-600">
            {Math.round(result.montantImpacte).toLocaleString("fr-FR")} FCFA
          </b>
          . Les anomalies sont maintenant disponibles dans les rapports CRYSTAL.
        </p>
        <div className="mt-5 flex gap-3">
          <a className="btn" href={`/synthese?fichier=${result.fileId}`}>
            Voir la synthèse
          </a>
          <a
            className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white"
            href="/import"
          >
            Importer un autre fichier
          </a>
        </div>
      </section>
    </div>
  );
}

function autoMap(headers: string[]): Mapping {
  const used = new Set<string>();
  return Object.fromEntries(
    headers.map((header) => {
      const normalized = normalize(header);
      let best = { target: "", confidence: 0 };
      for (const field of prestationFields) {
        if (used.has(field.key)) continue;
        for (const alias of [field.label, field.key, ...field.aliases]) {
          const candidate = normalize(alias);
          const confidence =
            normalized === candidate
              ? 100
              : normalized.includes(candidate) || candidate.includes(normalized)
                ? 78
                : wordOverlap(normalized, candidate);
          if (confidence > best.confidence)
            best = { target: field.key, confidence };
        }
      }
      if (best.confidence < 55) best = { target: "", confidence: 0 };
      if (best.target) used.add(best.target);
      return [header, best];
    }),
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fieldMatchesSearch(
  field: (typeof prestationFields)[number],
  search: string,
) {
  return [field.label, field.key, ...field.aliases].some((value) =>
    normalize(value).includes(search),
  );
}

function wordOverlap(left: string, right: string) {
  const a = new Set(left.split(" ").filter((word) => word.length > 2));
  const b = new Set(right.split(" ").filter((word) => word.length > 2));
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared ? Math.round((shared / Math.max(a.size, b.size)) * 70) : 0;
}

function findHeaderRow(rows: (string | number | boolean)[][]) {
  let bestIndex = -1;
  let bestScore = 0;
  rows.slice(0, 40).forEach((row, index) => {
    const score = headerRowScore(row);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= 4 ? bestIndex : -1;
}

function headerRowScore(row: (string | number | boolean)[]) {
  const values = row.map((cell) => String(cell).trim()).filter(Boolean);
  if (values.length < 2) return 0;
  const textCells = values.filter((value) =>
    Number.isNaN(Number(value)),
  ).length;
  const knownTerms = values.reduce((score, value) => {
    const normalized = normalize(value);
    return (
      score +
      prestationFields.reduce((best, field) => {
        const aliases = [field.label, field.key, ...field.aliases].map(
          normalize,
        );
        return Math.max(
          best,
          aliases.some((alias) => normalized === alias)
            ? 4
            : aliases.some(
                  (alias) =>
                    normalized.includes(alias) || alias.includes(normalized),
                )
              ? 2
              : 0,
        );
      }, 0)
    );
  }, 0);
  return values.length + textCells + knownTerms;
}

function findLastUsedColumn(
  rows: (string | number | boolean)[][],
  headerIndex: number,
) {
  return rows.slice(headerIndex, headerIndex + 6).reduce((last, row) => {
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (String(row[index] ?? "").trim()) return Math.max(last, index);
    }
    return last;
  }, 0);
}

function uniqueHeaders(headers: string[]) {
  const counts = new Map<string, number>();
  return headers.map((header) => {
    const count = (counts.get(header) ?? 0) + 1;
    counts.set(header, count);
    return count === 1 ? header : `${header} (${count})`;
  });
}

function FieldPicker({
  value,
  duplicate,
  onChange,
}: {
  value: string;
  duplicate: boolean;
  onChange: (target: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query);
  const currentField = prestationFields.find((field) => field.key === value);
  const filteredFields = normalizedQuery
    ? prestationFields.filter((field) =>
        fieldMatchesSearch(field, normalizedQuery),
      )
    : prestationFields;
  const options =
    currentField &&
    !filteredFields.some((field) => field.key === currentField.key)
      ? [currentField, ...filteredFields]
      : filteredFields;

  return (
    <div className="min-w-72 space-y-2">
      <label className="relative block">
        {!query && (
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={14}
          />
        )}
        <input
          className={`input h-10 py-2 pr-9 text-xs ${query ? "pl-3" : "pl-11"}`}
          onChange={(event) => setQuery(event.target.value)}
          placeholder=".      Rechercher un champ Prestation..."
          value={query}
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600"
            onClick={() => setQuery("")}
            title="Effacer"
            type="button"
          >
            <X size={14} />
          </button>
        )}
      </label>
      <select
        className={`input min-w-72 ${duplicate ? "border-red-400" : ""}`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Ne pas importer cette colonne</option>
        {options.map((field) => (
          <option key={field.key} value={field.key}>
            {field.label}
            {field.required ? " (recommandé)" : ""}
          </option>
        ))}
      </select>
      {normalizedQuery && filteredFields.length === 0 && (
        <p className="text-xs font-bold text-orange-600">
          Aucun champ de la table Prestation ne correspond.
        </p>
      )}
      {currentField && (
        <p className="text-[11px] font-semibold text-slate-500">
          Champ sélectionné : <b className="text-navy">{currentField.label}</b>
        </p>
      )}
    </div>
  );
}

function Confidence({
  confidence,
  mapped,
}: {
  confidence: number;
  mapped: boolean;
}) {
  if (!mapped)
    return (
      <span className="badge bg-orange-100 text-orange-700">À mapper</span>
    );
  if (confidence >= 90)
    return (
      <span className="badge bg-emerald-100 text-emerald-700">
        Fiable {confidence}%
      </span>
    );
  if (confidence >= 55)
    return (
      <span className="badge bg-yellow-100 text-yellow-700">
        À vérifier {confidence}%
      </span>
    );
  return <span className="badge bg-sky/10 text-sky">Manuel</span>;
}

function SectionHeader({
  title,
  subtitle,
  step,
}: {
  title: string;
  subtitle: string;
  step: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line px-6 py-4">
      <div>
        <h2 className="text-lg font-black text-navy">{title}</h2>
        <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
      </div>
      <span className="rounded-md bg-sky/10 px-3 py-2 text-xs font-black text-sky">
        {step}
      </span>
    </div>
  );
}
function DropZone({
  inputRef,
  chooseFile,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  chooseFile: (file?: File) => void;
}) {
  return (
    <button
      className="grid min-h-64 w-full place-items-center rounded-lg border-2 border-dashed border-sky/50 bg-sky/[0.04] p-8 text-center transition hover:border-sky hover:bg-sky/[0.08]"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        chooseFile(event.dataTransfer.files[0]);
      }}
      type="button"
    >
      <span>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sky text-white">
          <UploadCloud size={30} />
        </span>
        <span className="mt-5 block text-xl font-black text-navy">
          Déposez votre fichier Excel ici
        </span>
        <span className="mt-2 block text-sm font-semibold text-slate-500">
          ou cliquez pour parcourir vos fichiers
        </span>
      </span>
    </button>
  );
}
function SelectedFile({ file, remove }: { file: File; remove: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/60 p-8">
      <div className="flex w-full max-w-lg items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-lg bg-emerald-600 text-white">
          <FileSpreadsheet size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black text-navy">{file.name}</p>
          <p className="text-sm font-semibold text-slate-500">
            {formatSize(file.size)} · Prêt pour lecture
          </p>
        </div>
        <button
          className="grid h-9 w-9 place-items-center rounded-md border border-red-200 text-red-600"
          onClick={remove}
          title="Retirer le fichier"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
function Control({
  name,
  description,
  active,
  toggle,
}: {
  name: string;
  description: string;
  active: boolean;
  toggle: (name: string) => void;
}) {
  return (
    <button
      className={`min-h-16 rounded-lg border p-3 text-left ${active ? "border-sky bg-sky/10" : "border-line opacity-60"}`}
      onClick={() => toggle(name)}
      type="button"
    >
      <span className="flex items-center gap-2 text-xs font-black text-navy">
        <span
          className={`grid h-4 w-4 place-items-center rounded-sm ${active ? "bg-sky text-white" : "border"}`}
        >
          {active && <Check size={12} />}
        </span>
        {name}
      </span>
      <span className="mt-1 block text-[10px] font-semibold text-slate-500">
        {description}
      </span>
    </button>
  );
}
function Summary({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  const colors: Record<string, string> = {
    sky: "bg-sky",
    emerald: "bg-emerald-600",
    orange: "bg-orange-500",
    violet: "bg-violet-600",
  };
  return (
    <div className="card flex items-center gap-4 p-4">
      <span
        className={`grid h-11 w-11 place-items-center rounded-full text-white ${colors[tone]}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-xs font-black uppercase text-slate-500">{label}</p>
        <p className="font-black text-navy">{value}</p>
      </div>
    </div>
  );
}
function Select({
  label,
  options,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-navy">{label}</span>
      <select
        className="input"
        onChange={(event) => onChange?.(event.target.value)}
        value={value}
      >
        <option value="">
          {placeholder ?? options[0]?.name ?? "Sélectionner"}
        </option>
        {placeholder &&
          options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
      </select>
    </label>
  );
}
function RecentImports({ files }: { files: RecentFile[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <History className="text-sky" size={20} />
        <div>
          <h2 className="font-black text-navy">Importations récentes</h2>
          <p className="text-xs font-semibold text-slate-500">
            Derniers fichiers de la compagnie
          </p>
        </div>
      </div>
      {files.length === 0 ? (
        <p className="p-8 text-center text-sm font-semibold text-slate-500">
          Aucune importation disponible.
        </p>
      ) : (
        <div className="divide-y divide-line">
          {files.map((file) => (
            <div className="flex items-center gap-4 px-6 py-4" key={file.id}>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                <FileSpreadsheet size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-navy">
                  {file.name}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  {file.manager} · {file.branch} · {file.date}
                </p>
              </div>
              <span className="badge bg-emerald-100 text-emerald-700">
                {statusLabel(file.status)}
              </span>
              <DeleteImportedFileButton fileId={file.id} fileName={file.name} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} Ko`
    : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
function statusLabel(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
