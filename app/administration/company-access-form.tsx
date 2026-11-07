"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { updateCompanyAccess } from "./actions";

/** Jour UTC courant au format AAAA-MM-JJ (même référence que le contrôle côté serveur). */
function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function CompanyAccessForm({
  companyId,
  companyName,
  userCount,
  actif,
  dateFinEssai,
}: {
  companyId: number;
  companyName: string;
  userCount: number;
  actif: boolean;
  dateFinEssai: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [statut, setStatut] = useState(actif ? "active" : "suspendue");
  const [date, setDate] = useState(dateFinEssai);
  const [confirming, setConfirming] = useState(false);

  // L'accès sera bloqué si la compagnie est suspendue ou si le dernier jour d'essai est déjà passé.
  const willBlock = statut === "suspendue" || (date !== "" && date < todayUtc());
  const reason = statut === "suspendue" ? "La compagnie sera suspendue." : `La période d'essai se termine le ${new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" })}, date déjà passée.`;

  return (
    <form
      action={updateCompanyAccess}
      className="space-y-4 p-6"
      onSubmit={(event) => {
        if (willBlock && !confirming) {
          event.preventDefault();
          setConfirming(true);
        }
      }}
      ref={formRef}
    >
      <input name="id" type="hidden" value={companyId} />
      <fieldset className="space-y-4" disabled={confirming}>
        <label className="block text-sm font-bold text-navy">
          Statut
          <select className="input mt-1" name="statut" onChange={(event) => setStatut(event.target.value)} value={statut}>
            <option value="active">Active</option>
            <option value="suspendue">Suspendue (connexion bloquée)</option>
          </select>
        </label>
        <label className="block text-sm font-bold text-navy">
          Fin de la période d&apos;essai (dernier jour inclus)
          <input className="input mt-1" name="dateFinEssai" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          <span className="mt-1 block text-xs font-semibold text-slate-500">Laisser vide pour un accès sans limite de durée.</span>
        </label>
      </fieldset>
      {/* Un fieldset désactivé n'envoie pas ses champs : on les recopie pendant la confirmation. */}
      {confirming && (
        <>
          <input name="statut" type="hidden" value={statut} />
          <input name="dateFinEssai" type="hidden" value={date} />
        </>
      )}

      {confirming ? (
        <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-700"><AlertTriangle size={20} /></span>
            <div>
              <p className="font-black text-red-700">Bloquer l&apos;accès de {companyName} ?</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {reason} Ses {userCount} utilisateur(s) seront déconnectés immédiatement et verront le message « contactez l&apos;administrateur ». Aucune donnée n&apos;est supprimée.
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="rounded-lg bg-slate-100 px-5 py-3 text-sm font-black text-navy hover:bg-slate-200" onClick={() => setConfirming(false)} type="button">
              Annuler
            </button>
            <button className="rounded-lg bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700" type="submit">
              Confirmer le blocage
            </button>
          </div>
        </div>
      ) : (
        <button className="w-full rounded-lg bg-navy py-3 text-sm font-black text-white" type="submit">Enregistrer</button>
      )}
    </form>
  );
}
