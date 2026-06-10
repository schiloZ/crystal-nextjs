"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteImportedFileData } from "@/app/import/actions";

export function DeleteImportedFileButton({
  fileId,
  fileName,
  returnTo = "import",
}: {
  fileId: number;
  fileName: string;
  returnTo?: "import" | "exercices";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md bg-red-100 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-200"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Trash2 size={14} /> Supprimer les données
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-navy/60 px-4 py-8">
          <div className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-6 py-5">
              <div className="flex gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-700">
                  <AlertTriangle size={22} />
                </span>
                <div>
                  <h2 className="text-lg font-black text-red-700">Confirmer la suppression</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-700">Cette action supprimera définitivement toutes les données liées à ce fichier.</p>
                </div>
              </div>
              <button className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-white" onClick={() => setOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-lg border border-line bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase text-slate-500">Fichier concerné</p>
                <p className="mt-1 break-words text-sm font-black text-navy">{fileName}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                Les prestations, anomalies et statistiques de ce fichier seront retirées des tableaux de bord et rapports. L’historique de suppression sera conservé.
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button className="rounded-lg bg-slate-100 px-5 py-3 text-sm font-black text-navy hover:bg-slate-200" onClick={() => setOpen(false)} type="button">
                  Annuler
                </button>
                <form action={deleteImportedFileData}>
                  <input name="id" type="hidden" value={fileId} />
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <button className="w-full rounded-lg bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700" type="submit">
                    Supprimer définitivement
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
