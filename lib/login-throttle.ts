/**
 * Limitation des tentatives de connexion échouées, par adresse e-mail.
 *
 * Le compteur est gardé en mémoire : il protège une instance Node.js.
 * Avec plusieurs instances, ajouter aussi une limite au niveau du
 * répartiteur (Nginx limit_req, IIS Dynamic IP Restrictions ou WAF).
 */
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED = 10_000;

type Entry = { failures: number; firstFailureAt: number };
const attempts = new Map<string, Entry>();

function current(key: string, now: number): Entry | undefined {
  const entry = attempts.get(key);
  if (entry && now - entry.firstFailureAt > WINDOW_MS) {
    attempts.delete(key);
    return undefined;
  }
  return entry;
}

export function isLoginBlocked(email: string, now = Date.now()): boolean {
  return (current(email, now)?.failures ?? 0) >= MAX_FAILURES;
}

export function recordLoginFailure(email: string, now = Date.now()): void {
  const entry = current(email, now);
  if (entry) {
    entry.failures += 1;
    return;
  }
  if (attempts.size >= MAX_TRACKED) {
    const oldest = attempts.keys().next().value;
    if (oldest !== undefined) attempts.delete(oldest);
  }
  attempts.set(email, { failures: 1, firstFailureAt: now });
}

export function clearLoginFailures(email: string): void {
  attempts.delete(email);
}
