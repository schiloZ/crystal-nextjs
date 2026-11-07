"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { notifyToast } from "@/components/toaster";
import { createCompany, type CompanyFormState } from "./actions";
import { PasswordInput } from "@/components/password-input";

const initialState: CompanyFormState = {};

export function CompanyForm() {
  const [state, action] = useActionState(createCompany, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      notifyToast("success", state.success);
    }
    if (state.error) notifyToast("error", state.error);
  }, [state.error, state.success]);

  return (
    <form action={action} className="space-y-3 p-6" ref={formRef}>
      {state.error && <p className="rounded-lg bg-red-100 px-4 py-3 text-sm font-bold text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-700">{state.success}</p>}
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field name="code" label="Code" placeholder="NSIA" minLength={2} />
        <Field name="nom" label="Compagnie" placeholder="NSIA Assurances" minLength={2} />
      </div>
      <Field name="ville" label="Ville" placeholder="Abidjan" required={false} />
      <Field name="email" label="Email compagnie" placeholder="contact@compagnie.ci" type="email" />
      <div className="border-t border-line pt-4">
        <p className="mb-3 text-sm font-black text-navy">Super utilisateur de la compagnie</p>
        <div className="grid grid-cols-2 gap-3">
          <Field name="adminPrenoms" label="Prénoms" placeholder="Ange Marie" minLength={2} />
          <Field name="adminNom" label="Nom" placeholder="KONAN" minLength={2} />
        </div>
        <Field name="adminEmail" label="Email" placeholder="admin@compagnie.ci" type="email" />
        <Field name="adminPassword" label="Mot de passe initial" placeholder="12 caractères min., lettres et chiffres" type="password" minLength={12} />
      </div>
      <SubmitButton />
    </form>
  );
}

function Field({ name, label, placeholder, type = "text", minLength, required = true }: { name: string; label: string; placeholder: string; type?: string; minLength?: number; required?: boolean }) {
  if (type === "password") return <label className="block"><span className="text-xs font-black text-navy">{label}</span><div className="mt-1"><PasswordInput autoComplete="new-password" className="input" minLength={minLength} name={name} placeholder={placeholder} required={required} /></div></label>;
  return <label className="block"><span className="text-xs font-black text-navy">{label}</span><input className="input mt-1" minLength={minLength} name={name} placeholder={placeholder} required={required} type={type} /></label>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="w-full rounded-lg bg-emerald-600 py-3 font-black text-white disabled:cursor-wait disabled:opacity-60" disabled={pending}>{pending ? "Création en cours..." : "Créer la compagnie et son super utilisateur"}</button>;
}
