"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Champ mot de passe avec un bouton pour afficher ou masquer la saisie. */
export function PasswordInput({
  name,
  className,
  placeholder,
  autoComplete,
  required,
  minLength,
}: {
  name: string;
  className: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        autoComplete={autoComplete}
        className={`${className} pr-12`}
        minLength={minLength}
        name={name}
        placeholder={placeholder}
        required={required}
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#09275a]"
        onClick={() => setVisible((value) => !value)}
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        type="button"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
