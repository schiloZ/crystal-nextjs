"use client";

import { ReactNode, useState } from "react";
import { X } from "lucide-react";

export function ModalForm({
  title,
  description,
  trigger,
  children,
  size = "md",
}: {
  title: string;
  description?: string;
  trigger: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const width = size === "lg" ? "max-w-3xl" : size === "sm" ? "max-w-lg" : "max-w-2xl";

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/55 px-4 py-8">
          <div className={`max-h-[88vh] w-full ${width} overflow-hidden rounded-lg bg-white text-slate-700 shadow-2xl`}>
            <div className="flex items-start justify-between gap-4 border-b border-line bg-navy px-6 py-4 text-white">
              <div>
                <h2 className="text-lg font-black">{title}</h2>
                {description && <p className="mt-1 text-xs font-semibold text-blue-100">{description}</p>}
              </div>
              <button
                aria-label="Fermer"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(88vh-74px)] overflow-y-auto">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
