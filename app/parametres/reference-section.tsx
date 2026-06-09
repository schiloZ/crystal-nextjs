"use client";

import { useState } from "react";
import {
  Eye,
  FileDown,
  FileText,
  FileUp,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createRefActe,
  createRefAssure,
  createRefContrat,
  createRefPlafond,
  createRefPrestataire,
  deleteReference,
  importRefActes,
  importRefAssures,
  importRefContrats,
  importRefPlafonds,
  importRefPrestataires,
  updateReference,
} from "./actions";

export type ReferenceType =
  | "assures"
  | "prestataires"
  | "actes"
  | "contrats"
  | "plafonds";
export type ReferenceField = {
  name: string;
  label: string;
  value: string;
  required?: boolean;
  type?: string;
  bool?: boolean;
};
export type ReferenceRow = {
  id: number;
  cells: string[];
  fields: ReferenceField[];
};
type Company = { id: number; nom: string };

const createActions: Record<
  ReferenceType,
  (formData: FormData) => Promise<void>
> = {
  assures: createRefAssure,
  prestataires: createRefPrestataire,
  actes: createRefActe,
  contrats: createRefContrat,
  plafonds: createRefPlafond,
};

const importActions: Partial<
  Record<ReferenceType, (formData: FormData) => Promise<void>>
> = {
  assures: importRefAssures,
  prestataires: importRefPrestataires,
  actes: importRefActes,
  contrats: importRefContrats,
  plafonds: importRefPlafonds,
};

const titles: Record<ReferenceType, string> = {
  assures: "assuré",
  prestataires: "prestataire",
  actes: "acte médical",
  contrats: "contrat",
  plafonds: "plafond",
};

export function ReferenceSection({
  title,
  type,
  headers,
  rows,
  createFields,
  companyId,
  companies,
  showCompany,
  canManage,
}: {
  title: string;
  type: ReferenceType;
  headers: string[];
  rows: ReferenceRow[];
  createFields: ReferenceField[];
  companyId: number;
  companies: Company[];
  showCompany: boolean;
  canManage: boolean;
}) {
  const [modal, setModal] = useState<{
    mode: "create" | "view" | "edit" | "delete" | "import";
    row?: ReferenceRow;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<ToastState | null>(null);
  const createAction = createActions[type];
  const importAction = importActions[type];
  const pageSize = 5;
  const normalizedQuery = normalize(query);
  const filteredRows = normalizedQuery
    ? rows.filter((row) =>
        normalize(
          [...row.cells, ...row.fields.map((field) => field.value)].join(" "),
        ).includes(normalizedQuery),
      )
    : rows;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function notify(kind: ToastKind, message: string) {
    const nextToast = { id: Date.now(), kind, message };
    setToast(nextToast);
    window.setTimeout(() => {
      setToast((current) => (current?.id === nextToast.id ? null : current));
    }, 4200);
  }

  async function runImportantAction(
    action: (formData: FormData) => Promise<void>,
    formData: FormData,
    successMessage: string,
  ) {
    try {
      await action(formData);
      setModal(null);
      notify("success", successMessage);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Action impossible. Réessayez.");
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-5 py-4">
        <div>
          <h2 className="text-lg font-black text-navy">{title}</h2>
          <p className="text-xs font-semibold text-slate-500">
            {rows.length} ligne(s) affichées · actions en modales
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              className="inline-flex items-center gap-2 rounded-md bg-sky px-4 py-2 text-xs font-black text-white"
              onClick={() => setModal({ mode: "create" })}
              type="button"
            >
              <Plus size={15} /> Ajouter
            </button>
          )}
          {canManage &&
            importAction && (
              <button
                className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-xs font-black text-white"
                onClick={() => setModal({ mode: "import" })}
                type="button"
              >
                <FileUp size={15} /> Importer
              </button>
            )}
          <a
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-black text-white"
            href={`/api/exports/parametres?type=${type}&format=xlsx`}
            onClick={() => notify("success", "Export Excel en préparation.")}
          >
            <FileDown size={15} /> Excel
          </a>
          <a
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-xs font-black text-white"
            href={`/api/exports/parametres?type=${type}&format=pdf`}
            onClick={() => notify("success", "Export PDF en préparation.")}
          >
            <FileText size={15} /> PDF
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50 px-5 py-3">
        <label className="relative min-w-72 flex-1 max-w-xl">
          {!query && (
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
          )}
          <input
            className={`input h-11 pr-9 text-sm ${query ? "pl-3" : "pl-10"}`}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder=".     Rechercher dans ce tableau..."
            value={query}
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600"
              onClick={() => updateQuery("")}
              title="Effacer la recherche"
              type="button"
            >
              <X size={15} />
            </button>
          )}
        </label>
        <p className="text-xs font-black text-slate-500">
          {filteredRows.length} résultat(s) · page {currentPage}/{totalPages}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length ? (
              pagedRows.map((row) => (
                <tr className="odd:bg-white even:bg-sky/10" key={row.id}>
                  {row.cells.map((cell, index) => (
                    <td
                      className={
                        index === 0 ? "font-mono font-bold text-navy" : ""
                      }
                      key={index}
                    >
                      {cell}
                    </td>
                  ))}
                  <td>
                    <div className="flex justify-end gap-2">
                      <IconButton
                        label="Voir"
                        onClick={() => setModal({ mode: "view", row })}
                      >
                        <Eye size={15} />
                      </IconButton>
                      {canManage && (
                        <>
                          <IconButton
                            label="Modifier"
                            onClick={() => setModal({ mode: "edit", row })}
                          >
                            <Pencil size={15} />
                          </IconButton>
                          <IconButton
                            danger
                            label="Supprimer"
                            onClick={() => setModal({ mode: "delete", row })}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="p-8 text-center text-sm font-semibold text-slate-500"
                  colSpan={headers.length + 1}
                >
                  {rows.length
                    ? "Aucune donnée ne correspond à cette recherche."
                    : "Aucune donnée enregistrée."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-5 py-4">
        <p className="text-xs font-semibold text-slate-500">
          Affichage par 5 lignes
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-line bg-white px-4 py-2 text-xs font-black text-navy disabled:cursor-not-allowed disabled:opacity-40"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            type="button"
          >
            Précédent
          </button>
          {paginationPages(currentPage, totalPages).map((item, index) =>
            item === "…" ? (
              <span
                className="px-1 text-xs font-black text-slate-400"
                key={`ellipsis-${index}`}
              >
                …
              </span>
            ) : (
              <button
                className={`rounded-md px-3 py-2 text-xs font-black ${item === currentPage ? "bg-sky text-white" : "border border-line bg-white text-navy"}`}
                key={item}
                onClick={() => setPage(item)}
                type="button"
              >
                {item}
              </button>
            ),
          )}
          <button
            className="rounded-md border border-line bg-white px-4 py-2 text-xs font-black text-navy disabled:cursor-not-allowed disabled:opacity-40"
            disabled={currentPage === totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            type="button"
          >
            Suivant
          </button>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/55 px-4 py-8">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-line bg-navy px-6 py-4 text-white">
              <div>
                <p className="text-xs font-black uppercase text-sky">{title}</p>
                <h3 className="text-xl font-black">
                  {modalTitle(modal.mode, titles[type])}
                </h3>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-md bg-white/10"
                onClick={() => setModal(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(88vh-73px)] overflow-y-auto p-6">
              {modal.mode === "view" && modal.row && (
                <ViewFields fields={modal.row.fields} />
              )}
              {modal.mode === "create" && (
                <ReferenceForm
                  action={(formData) => runImportantAction(createAction, formData, "Référence créée avec succès.")}
                  companyId={companyId}
                  companies={companies}
                  fields={createFields}
                  showCompany={showCompany}
                  submitLabel="Créer la référence"
                />
              )}
              {modal.mode === "import" && importAction && (
                <MappingImportForm
                  action={(formData) => runImportantAction(importAction, formData, "Import terminé avec succès.")}
                  companyId={companyId}
                  companies={companies}
                  fields={createFields}
                  showCompany={showCompany}
                  title={title}
                />
              )}
              {modal.mode === "edit" && modal.row && (
                <ReferenceForm
                  action={(formData) => runImportantAction(updateReference, formData, "Modifications enregistrées.")}
                  fields={modal.row.fields}
                  hidden={{ type, id: String(modal.row.id) }}
                  submitLabel="Enregistrer les modifications"
                />
              )}
              {modal.mode === "delete" && modal.row && (
                <form
                  action={(formData) => runImportantAction(deleteReference, formData, "Référence supprimée.")}
                  className="space-y-5"
                >
                  <input name="type" type="hidden" value={type} />
                  <input name="id" type="hidden" value={modal.row.id} />
                  <div className="rounded-lg border border-red-200 bg-red-50 p-5">
                    <p className="text-lg font-black text-red-700">
                      Confirmer la suppression
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      Cette action supprimera définitivement cette référence.
                    </p>
                  </div>
                  <ViewFields compact fields={modal.row.fields.slice(0, 6)} />
                  <div className="flex justify-end gap-3">
                    <button
                      className="rounded-lg bg-slate-100 px-5 py-3 text-sm font-black text-navy"
                      onClick={() => setModal(null)}
                      type="button"
                    >
                      Annuler
                    </button>
                    <button className="rounded-lg bg-red-600 px-5 py-3 text-sm font-black text-white">
                      Supprimer
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </section>
  );
}

function ReferenceForm({
  action,
  fields,
  hidden,
  companyId,
  companies = [],
  showCompany = false,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  fields: ReferenceField[];
  hidden?: Record<string, string>;
  companyId?: number;
  companies?: Company[];
  showCompany?: boolean;
  submitLabel: string;
}) {
  const [pending, setPending] = useState(false);

  async function submitAction(formData: FormData) {
    setPending(true);
    try {
      await action(formData);
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submitAction} className="space-y-5">
      {hidden &&
        Object.entries(hidden).map(([name, value]) => (
          <input key={name} name={name} type="hidden" value={value} />
        ))}
      {typeof companyId === "number" &&
        (showCompany ? (
          <label>
            <span className="mb-1 block text-xs font-black uppercase text-slate-500">
              Compagnie
            </span>
            <select
              className="input"
              defaultValue={companyId}
              name="compagnieId"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.nom}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input name="compagnieId" type="hidden" value={companyId} />
        ))}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) =>
          field.bool ? (
            <BoolInput field={field} key={field.name} />
          ) : (
            <TextInput field={field} key={field.name} />
          ),
        )}
      </div>
      <div className="flex justify-end">
        <button
          className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
          disabled={pending}
        >
          {pending ? "Traitement..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function MappingImportForm({
  action,
  companyId,
  companies,
  fields,
  showCompany,
  title,
}: {
  action: (formData: FormData) => Promise<void>;
  companyId: number;
  companies: Company[];
  fields: ReferenceField[];
  showCompany: boolean;
  title: string;
}) {
  const [pending, setPending] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const requiredFields = fields.filter((field) => field.required);
  const ready =
    headers.length > 0 &&
    requiredFields.every((field) => Boolean(mapping[field.name]));

  async function inspectFile(file?: File) {
    setParseError("");
    setFileName(file?.name ?? "");
    setHeaders([]);
    setMapping({});
    if (!file) return;

    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), {
        type: "array",
        sheetRows: 5,
        cellDates: true,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      const detectedHeaders = Object.keys(rows[0] ?? {});
      if (!detectedHeaders.length) {
        setParseError("Aucune colonne détectée dans le premier onglet.");
        return;
      }
      setHeaders(detectedHeaders);
      setMapping(autoMapping(fields, detectedHeaders));
    } catch {
      setParseError("Impossible de lire ce fichier Excel.");
    }
  }

  async function submitAction(formData: FormData) {
    setPending(true);
    try {
      await action(formData);
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submitAction} className="space-y-5">
      <div className="rounded-lg border border-sky/20 bg-sky/5 p-5">
        <p className="text-lg font-black text-navy">Import massif avec mapping</p>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          Choisissez un fichier Excel, puis associez ses colonnes aux champs de {title}. Les champs obligatoires sont marqués.
        </p>
      </div>
      {showCompany ? (
        <label>
          <span className="mb-1 block text-xs font-black uppercase text-slate-500">
            Compagnie
          </span>
          <select className="input" defaultValue={companyId} name="compagnieId">
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.nom}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input name="compagnieId" type="hidden" value={companyId} />
      )}
      <label>
        <span className="mb-1 block text-xs font-black uppercase text-slate-500">
          Fichier Excel à importer
        </span>
        <input
          accept=".xlsx,.xls"
          className="input file:mr-4 file:rounded-md file:border-0 file:bg-sky file:px-4 file:py-2 file:text-xs file:font-black file:text-white"
          name="file"
          onChange={(event) => inspectFile(event.target.files?.[0])}
          required
          type="file"
        />
      </label>
      {fileName && (
        <p className="text-xs font-black text-slate-500">
          Fichier sélectionné : {fileName}
        </p>
      )}
      {parseError && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {parseError}
        </p>
      )}
      {headers.length > 0 && (
        <div className="rounded-lg border border-line bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-black text-navy">Mapping des colonnes</h4>
            <p className="text-xs font-black text-slate-500">
              {headers.length} colonne(s) détectée(s)
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => (
              <label key={field.name}>
                <span className="mb-1 block text-xs font-black uppercase text-slate-500">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <select
                  className="input"
                  onChange={(event) =>
                    setMapping((value) => ({
                      ...value,
                      [field.name]: event.target.value,
                    }))
                  }
                  value={mapping[field.name] ?? ""}
                >
                  <option value="">Ne pas importer</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
      <input name="mapping" type="hidden" value={JSON.stringify(mapping)} />
      <div className="flex justify-end">
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-navy px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!ready || pending}
        >
          <FileUp size={17} /> {pending ? "Import en cours..." : "Importer les données"}
        </button>
      </div>
    </form>
  );
}

function autoMapping(fields: ReferenceField[], headers: string[]) {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((header) => ({
    header,
    normalized: normalizeImportKey(header),
  }));
  for (const field of fields) {
    const candidates = [
      field.name,
      field.label,
      field.name === "codeActe" ? "code acte" : "",
      field.name === "tarifConventionne" ? "tarif conventionne" : "",
      field.name === "codeContrat" ? "code contrat" : "",
      field.name === "codePlafond" ? "code plafond" : "",
      field.name === "typePlafond" ? "type plafond" : "",
      field.name === "montantPlafond" ? "montant plafond" : "",
      field.name === "numeroCollege" ? "numero college" : "",
      field.name === "policeInterne" ? "police interne" : "",
      field.name === "codeSouscripteur" ? "code souscripteur" : "",
      field.name === "contratId" ? "contrat id" : "",
      field.name === "dateDebut" ? "date debut" : "",
      field.name === "dateFin" ? "date fin" : "",
    ].filter(Boolean);
    const match = normalizedHeaders.find((item) =>
      candidates.some((candidate) => item.normalized === normalizeImportKey(candidate)),
    );
    if (match) mapping[field.name] = match.header;
  }
  return mapping;
}

function normalizeImportKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function ViewFields({
  fields,
  compact = false,
}: {
  fields: ReferenceField[];
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}
    >
      {fields.map((field) => (
        <div
          className="rounded-lg border border-line bg-sky/5 px-4 py-3"
          key={field.name}
        >
          <p className="text-[10px] font-black uppercase text-slate-500">
            {field.label}
          </p>
          <p className="mt-1 break-words text-sm font-black text-navy">
            {field.bool
              ? field.value === "true"
                ? "Oui"
                : "Non"
              : field.value || "-"}
          </p>
        </div>
      ))}
    </div>
  );
}

function TextInput({ field }: { field: ReferenceField }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-black uppercase text-slate-500">
        {field.label}
      </span>
      <input
        className="input"
        defaultValue={field.value}
        name={field.name}
        required={field.required}
        type={field.type ?? "text"}
      />
    </label>
  );
}

function BoolInput({ field }: { field: ReferenceField }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-black uppercase text-slate-500">
        {field.label}
      </span>
      <select className="input" defaultValue={field.value} name={field.name}>
        <option value="true">Oui</option>
        <option value="false">Non</option>
      </select>
    </label>
  );
}

function IconButton({
  children,
  label,
  danger = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-black ${danger ? "bg-red-100 text-red-700" : "bg-sky/10 text-sky"}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

type ToastKind = "success" | "error";
type ToastState = { id: number; kind: ToastKind; message: string };

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const success = toast.kind === "success";
  return (
    <div className="fixed right-5 top-5 z-[60] w-[min(92vw,380px)]">
      <div
        className={`rounded-lg border px-4 py-3 shadow-2xl ${
          success
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black">
              {success ? "Action réussie" : "Action impossible"}
            </p>
            <p className="mt-1 text-sm font-semibold">{toast.message}</p>
          </div>
          <button
            className="shrink-0 rounded-md p-1 hover:bg-black/5"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function modalTitle(
  mode: "create" | "view" | "edit" | "delete" | "import",
  label: string,
) {
  if (mode === "create") return `Ajouter un ${label}`;
  if (mode === "import") return `Importer des ${label}s`;
  if (mode === "view") return `Détails du ${label}`;
  if (mode === "edit") return `Modifier le ${label}`;
  return `Supprimer le ${label}`;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function paginationPages(current: number, total: number): Array<number | "…"> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: Array<number | "…"> = [1];
  if (current > 3) pages.push("…");
  for (
    let page = Math.max(2, current - 1);
    page <= Math.min(total - 1, current + 1);
    page += 1
  )
    pages.push(page);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}
