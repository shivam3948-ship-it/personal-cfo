// Rate limit for /api/ask/relay (D-050 hardening): per IP and a daily total.
export const PER_IP = 20, WINDOW_MS = 10 * 60_000, DAILY = Number(process.env.MUNIM_RELAY_DAILY ?? 500);
const hits = new Map<string, number[]>(); let day = '', today = 0;
/** Best effort on serverless (each instance counts on its own); enough to stop casual scripting of a free model endpoint. */
export function allow(ip: string, now = Date.now()): boolean {
  const d = new Date(now).toISOString().slice(0, 10); if (d !== day) { day = d; today = 0; hits.clear(); }
  if (today >= DAILY) return false;
  const h = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (h.length >= PER_IP) { hits.set(ip, h); return false; }
  h.push(now); hits.set(ip, h); today++; return true;
}
