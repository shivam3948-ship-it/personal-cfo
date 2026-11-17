// Per-instance sliding-window rate limit for routes that spend money (Claude, Sarvam). Serverless instances do not share
// memory, so this caps abuse per instance, not globally; a shared store (Upstash/Redis) is the production fix.
const hits = new Map<string, number[]>();

export function clientKey(req: Request, route: string): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  return `${route}:${ip}`;
}

/** true = allowed. limit requests per windowMs per key. */
export function allow(key: string, limit: number, windowMs = 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now); hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}

export const LIMITS = { agent: 30, hostAgent: 60, tts: 40, stt: 20, upload: 10 } as const;
