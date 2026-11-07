"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarPlus } from "lucide-react";
import { notifyToast } from "@/components/toaster";
import { createExercise, type ExerciseFormState } from "./actions";

type Company = { id: number; nom: string };
const initialState: ExerciseFormState = {};

export function ExerciseForm({ companies, showCompany }: { companies: Company[]; showCompany: boolean }) {
  const [state, action] = useActionState(createExercise, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      notifyToast("success", state.success);
    }
    if (state.error) notifyToast("error", state.error);
  }, [state.error, state.success]);

  return (
    <form action={action} className="space-y-4 p-6" ref={formRef}>
      {state.error && <p className="rounded-lg bg-red-100 px-4 py-3 text-sm font-bold text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-700">{state.success}</p>}
      {showCompany && <label className="block"><span className="mb-1 block text-xs font-black text-navy">Compagnie</span><select className="input" name="compagnieId" required><option value="">Sélectionner une compagnie</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.nom}</option>)}</select></label>}
      <label className="block"><span className="mb-1 block text-xs font-black text-navy">Code exercice</span><input className="input" name="codeExercice" placeholder="2027" required /></label>
      <div className="grid grid-cols-2 gap-3">
        <label><span className="mb-1 block text-xs font-black text-navy">Date de début</span><input className="input" name="dateDebut" required type="date" /></label>
        <label><span className="mb-1 block text-xs font-black text-navy">Date de fin</span><input className="input" name="dateFin" required type="date" /></label>
      </div>
      <div>
        <span className="mb-1 block text-xs font-black text-navy">Période de tolérance des tardifs</span>
        <div className="grid grid-cols-2 gap-3">
          <input aria-label="Début tolérance tardifs" className="input" name="dateDebutToleranceTardif" type="date" />
          <input aria-label="Fin tolérance tardifs" className="input" name="dateFinToleranceTardif" type="date" />
        </div>
        <span className="mt-1 block text-xs font-semibold text-slate-500">Les prestations comptabilisées hors de cette période seront signalées tardives.</span>
      </div>
      <label className="flex items-start gap-3 rounded-lg border border-line bg-sky/5 p-4">
        <input className="mt-1 h-4 w-4 accent-emerald-600" defaultChecked name="actif" type="checkbox" value="true" />
        <span><b className="block text-sm text-navy">Définir comme exercice actif</b><span className="text-xs font-semibold text-slate-500">Plusieurs exercices peuvent rester actifs pour les imports.</span></span>
      </label>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 font-black text-white disabled:opacity-60" disabled={pending}><CalendarPlus size={18} />{pending ? "Création en cours..." : "Créer l'exercice comptable"}</button>;
}
