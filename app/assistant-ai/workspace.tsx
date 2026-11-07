"use client";

import { FormEvent, useState } from "react";
import { Bot, Database, Loader2, MessageSquareText, Search, ShieldCheck, Sparkles, Table2 } from "lucide-react";

type AiResponse = {
  answer: string;
  intent: string;
  model: string;
  rows: Array<Record<string, string | number>>;
  suggestions: string[];
};

const examples = [
  "Liste les tables de la base",
  "Combien de gestionnaires dans la base ?",
  "Affiche les gestionnaires",
  "Montre les anomalies par catégorie",
  "Quels fichiers ont le plus fort taux d'anomalie ?",
];

function cleanAssistantText(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function AssistantAiWorkspace() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt) return;
    setLoading(true);
    setError("");
    setResponse(null);
    try {
      const result = await fetch("/api/assistant-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt }),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error ?? "L'assistant n'a pas pu répondre.");
      setResponse(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  const hasRows = Boolean(response?.rows.length);

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-lg bg-navy text-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-5 px-6 py-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-sky text-navy"><Bot size={26} /></span>
          <div className="min-w-0">
            <h2 className="text-xl font-black">Interroger la base CRYSTAL</h2>
            <p className="mt-1 text-sm font-semibold text-blue-100">Posez une question métier, l'assistant lit la base en mode contrôlé et affiche les résultats exploitables.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black">
          <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2"><ShieldCheck size={15} /> Lecture seule</span>
          <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2"><Database size={15} /> Base métier</span>
        </div>
      </div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <section className="min-w-0 space-y-5">
      <form className="card overflow-hidden" onSubmit={submit}>
        <div className="border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-sky/10 text-sky"><MessageSquareText size={20} /></span>
            <div>
              <h2 className="font-black text-navy">Question</h2>
              <p className="text-xs font-semibold text-slate-500">Exemples : comptage, liste, recherche, synthèse, anomalies, montants.</p>
            </div>
          </div>
        </div>
        <div className="p-5">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase text-slate-500">Votre question</span>
          <textarea
            className="input min-h-40 resize-y text-base font-semibold leading-7 text-navy"
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ex: Quels sont les prestataires avec le plus d'anomalies sur le dernier audit ?"
            value={question}
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500">Les champs sensibles restent masqués et les requêtes sont exécutées côté serveur.</p>
          <button className="inline-flex items-center gap-2 rounded-lg bg-sky px-6 py-3 text-sm font-black text-white shadow-lg shadow-sky/20 disabled:cursor-wait disabled:opacity-60" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={17} /> : <Search size={17} />}
            {loading ? "Analyse en cours..." : "Interroger"}
          </button>
        </div>
        </div>
      </form>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-black text-red-700">{error}</div>}

      {response && <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-700"><Sparkles size={20} /></span>
              <div>
                <h2 className="font-black text-navy">Réponse</h2>
                <p className="text-xs font-semibold text-slate-500">Intention : {response.intent} · Modèle : {response.model}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-md bg-sky/10 px-3 py-2 text-xs font-black text-sky"><Table2 size={15} /> {response.rows.length} ligne(s)</span>
          </div>
        </div>
        <div className="space-y-5 p-5">
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">{cleanAssistantText(response.answer)}</p>
          </div>
          {hasRows && <div className="overflow-x-auto rounded-lg border border-line">
            <table className="table min-w-[760px]">
              <thead><tr>{Object.keys(response.rows[0]).map((key) => <th key={key}>{key}</th>)}</tr></thead>
              <tbody>{response.rows.map((row, index) => <tr className={index % 2 ? "bg-sky/10" : "bg-white"} key={index}>{Object.values(row).map((value, cellIndex) => <td key={cellIndex}>{value}</td>)}</tr>)}</tbody>
            </table>
          </div>}
        </div>
      </section>}
    </section>

    <aside className="space-y-5">
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-black text-navy"><Sparkles size={18} className="text-sky" /> Exemples</h2>
        <div className="mt-4 space-y-2">
          {examples.map((item) => <button className="block w-full rounded-md border border-line bg-white px-4 py-3 text-left text-sm font-bold text-slate-600 hover:border-sky hover:bg-sky/5 hover:text-navy" key={item} onClick={() => setQuestion(item)} type="button">{item}</button>)}
        </div>
      </section>
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-black text-navy"><Database size={18} className="text-sky" /> Accès données</h2>
        <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
          <li>Tables métier en lecture seule.</li>
          <li>Recherches et comptages par table.</li>
          <li>Prestations, anomalies, référentiels.</li>
          <li>Champs sensibles non exposés.</li>
        </ul>
      </section>
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-black text-navy"><ShieldCheck size={18} className="text-emerald-700" /> Sécurité</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">L'assistant ne modifie pas la base. Il utilise des intentions contrôlées et des requêtes Prisma côté serveur.</p>
      </section>
    </aside>
    </div>
  </div>;
}
