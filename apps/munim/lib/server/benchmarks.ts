// Daily NAVs of four index funds (server only), the yardsticks for "against its index" on the X-ray (3 Nov 2026). Public AMFI data via
// mfapi.in; the request carries nothing about the user, and the comparison itself runs on the phone. Cached for a day.
import type { BenchKey, NavSeries } from '@core/portfolio/engine';

const revalidate = 86400;

// one direct-plan growth index fund per yardstick; the first name that matches wins
const PICK: Record<BenchKey, { q: string; fallback?: number }> = {
  nifty50: { q: 'UTI Nifty 50 Index Fund', fallback: 120716 },
  nifty500: { q: 'Motilal Oswal Nifty 500 Index Fund' },
  midcap150: { q: 'Motilal Oswal Nifty Midcap 150 Index Fund' },
  smallcap250: { q: 'Motilal Oswal Nifty Smallcap 250 Index Fund' },
};
const API = 'https://api.mfapi.in/mf';
const day = { next: { revalidate } } as const;

async function code(k: BenchKey): Promise<{ code: number; name: string } | null> {
  try {
    const r = await fetch(`${API}/search?q=${encodeURIComponent(PICK[k].q)}`, day); const list = (await r.json()) as { schemeCode: number; schemeName: string }[];
    const hit = list.find((x) => /direct/i.test(x.schemeName) && /growth/i.test(x.schemeName) && !/idcw|dividend|bonus/i.test(x.schemeName));
    if (hit) return { code: hit.schemeCode, name: hit.schemeName };
  } catch { /* fall through */ }
  return PICK[k].fallback ? { code: PICK[k].fallback!, name: PICK[k].q } : null;
}
async function series(c: number): Promise<NavSeries> {
  const r = await fetch(`${API}/${c}`, day); const j = (await r.json()) as { data?: { date: string; nav: string }[] };
  return (j.data ?? []).map((d) => { const [dd, mm, yy] = d.date.split('-'); return [`${yy}-${mm}-${dd}`, Number(d.nav)] as [string, number]; })
    .filter(([, n]) => n > 0).sort((a, b) => a[0].localeCompare(b[0]));
}

/** The four series, or as many as could be fetched; empty when the source is down (the X-ray then hides the card). */
export async function benchSeries(): Promise<{ series: Partial<Record<BenchKey, NavSeries>>; info: Record<string, unknown> }> {
  const keys = Object.keys(PICK) as BenchKey[];
  const got = await Promise.all(keys.map(async (k) => { const c = await code(k); if (!c) return [k, null] as const; try { return [k, { ...c, s: await series(c.code) }] as const; } catch { return [k, null] as const; } }));
  const out: Partial<Record<BenchKey, NavSeries>> = {}; const info: Record<string, unknown> = {};
  for (const [k, v] of got) if (v && v.s.length) { out[k] = v.s; info[k] = { code: v.code, name: v.name, days: v.s.length, from: v.s[0][0], to: v.s.at(-1)![0] }; }
  return { series: out, info };
}
