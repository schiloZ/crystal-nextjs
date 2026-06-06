type DuplicateCandidate = {
  matriculeBeneficiaire: string | null;
  nomBeneficiaire: string | null;
  prenomsBeneficiaire?: string | null;
  dateSoins: Date | null;
  codeActe: string | null;
  acte: string | null;
  codePrestataire: string | null;
  prestataire: string | null;
  montantReclame: unknown;
  montantPaye: unknown;
};

export function functionalDuplicateKey(prestation: DuplicateCandidate) {
  const beneficiary = normalize(prestation.matriculeBeneficiaire) || normalize(`${prestation.nomBeneficiaire ?? ""} ${prestation.prenomsBeneficiaire ?? ""}`);
  const act = normalize(prestation.codeActe) || normalize(prestation.acte);
  const provider = normalize(prestation.codePrestataire) || normalize(prestation.prestataire);
  const date = prestation.dateSoins ? prestation.dateSoins.toISOString().slice(0, 10) : "";
  const claimed = Number(prestation.montantReclame ?? 0);
  const paid = Number(prestation.montantPaye ?? 0);
  const amount = claimed !== 0 ? claimed : paid;

  if (!beneficiary || !date || !act || !provider || !Number.isFinite(amount)) return null;
  return [beneficiary, date, act, provider, amount.toFixed(2)].join("|");
}

function normalize(value: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}
