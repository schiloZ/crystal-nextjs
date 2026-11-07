"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const toastMessages: Record<string, Toast> = {
  login: { id: 0, kind: "success", message: "Connexion réussie. Bienvenue sur CRYSTAL." },
  logout: { id: 0, kind: "info", message: "Déconnexion effectuée." },
  "login-error": { id: 0, kind: "error", message: "Identifiants invalides. Vérifiez votre email et votre mot de passe." },
  "user-created": { id: 0, kind: "success", message: "Utilisateur créé avec succès." },
  "user-updated": { id: 0, kind: "success", message: "Utilisateur modifié avec succès." },
  "user-status": { id: 0, kind: "success", message: "Statut utilisateur mis à jour." },
  "branch-created": { id: 0, kind: "success", message: "Filiale créée avec succès." },
  "org-user-created": { id: 0, kind: "success", message: "Compte utilisateur créé avec succès." },
  "manager-updated": { id: 0, kind: "success", message: "Gestionnaire modifié avec succès." },
  "manager-status": { id: 0, kind: "success", message: "Statut gestionnaire mis à jour." },
  "exercise-updated": { id: 0, kind: "success", message: "Exercice mis à jour avec succès." },
  "exercise-status": { id: 0, kind: "success", message: "Statut exercice mis à jour." },
  "import-deleted": { id: 0, kind: "success", message: "Toutes les données du fichier importé ont été supprimées." },
  "company-access": { id: 0, kind: "success", message: "Accès de la compagnie mis à jour." },
  "company-access-invalid": { id: 0, kind: "error", message: "Les paramètres d'accès sont invalides." },
  "company-deleted": { id: 0, kind: "success", message: "La compagnie, ses utilisateurs et toutes ses données ont été supprimés." },
  "company-delete-confirm": { id: 0, kind: "error", message: "Suppression annulée : le code saisi ne correspond pas à la compagnie." },
  "company-delete-superadmin": { id: 0, kind: "error", message: "Suppression impossible : cette compagnie contient un compte super administrateur." },
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<{ kind?: ToastKind; message?: string }>).detail;
      if (!detail?.message) return;
      pushToast(detail.kind ?? "info", detail.message);
    }

    window.addEventListener("crystal:toast", onToast);
    return () => window.removeEventListener("crystal:toast", onToast);
  }, []);

  useEffect(() => {
    const toastKey = searchParams.get("toast");
    const authError = searchParams.get("error");
    const template = toastKey ? toastMessages[toastKey] : authError ? toastMessages["login-error"] : null;
    if (!template) return;

    pushToast(template.kind, template.message);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("toast");
    params.delete("error");
    params.delete("callbackUrl");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  function pushToast(kind: ToastKind, message: string) {
    const toast = { id: Date.now() + Math.random(), kind, message };
    setToasts((current) => [...current.slice(-2), toast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 4500);
  }

  function remove(id: number) {
    setToasts((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="fixed right-5 top-5 z-[90] grid w-[min(92vw,390px)] gap-3">
      {toasts.map((toast) => (
        <div className={`rounded-lg border px-4 py-3 shadow-2xl ${toastClass(toast.kind)}`} key={toast.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black">{toastTitle(toast.kind)}</p>
              <p className="mt-1 text-sm font-semibold">{toast.message}</p>
            </div>
            <button className="shrink-0 rounded-md p-1 hover:bg-black/5" onClick={() => remove(toast.id)} type="button">
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function toastClass(kind: ToastKind) {
  if (kind === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (kind === "error") return "border-red-200 bg-red-50 text-red-800";
  return "border-sky/30 bg-sky/10 text-navy";
}

function toastTitle(kind: ToastKind) {
  if (kind === "success") return "Action réussie";
  if (kind === "error") return "Action impossible";
  return "Information";
}

export function notifyToast(kind: ToastKind, message: string) {
  window.dispatchEvent(new CustomEvent("crystal:toast", { detail: { kind, message } }));
}
