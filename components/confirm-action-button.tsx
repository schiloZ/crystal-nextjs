"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type Tone = "danger" | "success";

const tones: Record<Tone, { header: string; icon: string; title: string; confirm: string }> = {
  danger: {
    header: "border-red-100 bg-red-50",
    icon: "bg-red-100 text-red-700",
    title: "text-red-700",
    confirm: "bg-red-600 hover:bg-red-700",
  },
  success: {
    header: "border-emerald-100 bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-700",
    title: "text-emerald-700",
    confirm: "bg-emerald-600 hover:bg-emerald-700",
  },
};

/**
 * Bouton qui ouvre une fenêtre « Êtes-vous sûr ? » avant d'exécuter une action serveur.
 * Même présentation que les fenêtres de suppression existantes.
 */
export function ConfirmActionButton({
  action,
  hidden,
  label,
  buttonClassName,
  title,
  message,
  subject,
  confirmLabel,
  tone = "danger",
  disabled = false,
  disabledReason,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string | number>;
  label: string;
  buttonClassName: string;
  title: string;
  message: string;
  subject?: string;
  confirmLabel: string;
  tone?: Tone;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const style = tones[tone];
  const Icon = tone === "danger" ? AlertTriangle : CheckCircle2;

  return (
    <>
      <button className={buttonClassName} disabled={disabled} onClick={() => setOpen(true)} title={disabled ? disabledReason : undefined} type="button">
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-navy/60 px-4 py-8" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white text-left shadow-2xl">
            <div className={`flex items-start justify-between gap-4 border-b px-6 py-5 ${style.header}`}>
              <div className="flex gap-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${style.icon}`}>
                  <Icon size={22} />
                </span>
                <div>
                  <h2 className={`text-lg font-black ${style.title}`}>{title}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{message}</p>
                </div>
              </div>
              <button aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-white" onClick={() => setOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              {subject && (
                <div className="rounded-lg border border-line bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase text-slate-500">Élément concerné</p>
                  <p className="mt-1 break-words text-sm font-black text-navy">{subject}</p>
                </div>
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button className="rounded-lg bg-slate-100 px-5 py-3 text-sm font-black text-navy hover:bg-slate-200" onClick={() => setOpen(false)} type="button">
                  Annuler
                </button>
                <form action={action}>
                  {Object.entries(hidden).map(([name, value]) => (
                    <input key={name} name={name} type="hidden" value={value} />
                  ))}
                  <button className={`w-full rounded-lg px-5 py-3 text-sm font-black text-white ${style.confirm}`} type="submit">
                    {confirmLabel}
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
