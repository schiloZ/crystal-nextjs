"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { createManager, type ManagerFormState } from "./actions";

type Company = { id: number; nom: string };
const initialState: ManagerFormState = {};

export function ManagerForm({ companies, showCompany }: { companies: Company[]; showCompany: boolean }) {
  const [state, action] = useFormState(createManager, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form action={action} className="space-y-3 p-6" ref={formRef}>
      {state.error && <p className="rounded-lg bg-red-100 px-4 py-3 text-sm font-bold text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-700">{state.success}</p>}
      {showCompany && <label className="block"><span className="mb-1 block text-xs font-black text-navy">Compagnie</span><select className="input" name="compagnieId" required><option value="">Sélectionner</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.nom}</option>)}</select></label>}
      <label className="block"><span className="mb-1 block text-xs font-black text-navy">Code gestionnaire</span><input className="input" name="code" placeholder="GEST-001" required /></label>
      <div className="grid grid-cols-2 gap-3">
        <Field name="prenoms" label="Prénoms" placeholder="Ange Marie" />
        <Field name="nom" label="Nom" placeholder="KONAN" />
      </div>
      <Field name="contact" label="Fonction / Contact" placeholder="Responsable prestations" required={false} />
      <Field name="telephone" label="Téléphone" placeholder="+225 07 00 00 00 00" required={false} />
      <Field name="email" label="Email" placeholder="gestionnaire@compagnie.ci" required={false} type="email" />
      <SubmitButton />
    </form>
  );
}

function Field({ name, label, placeholder, type = "text", required = true }: { name: string; label: string; placeholder: string; type?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1 block text-xs font-black text-navy">{label}</span><input className="input" name={name} placeholder={placeholder} required={required} type={type} /></label>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 font-black text-white disabled:opacity-60" disabled={pending}><UserPlus size={18} />{pending ? "Ajout en cours..." : "Ajouter le gestionnaire"}</button>;
}
