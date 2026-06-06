"use client";

import { Printer } from "lucide-react";

export function PrintReportButton() {
  return (
    <button
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky px-5 py-3 text-sm font-black text-white shadow-lg shadow-sky/20 print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      <Printer size={18} />
      Générer PDF
    </button>
  );
}
