// Daily NAVs of four index funds (server only), the yardsticks for "against its index" on the X-ray (3 Nov 2026). Public AMFI data via
// mfapi.in; the request carries nothing about the user, and the comparison itself runs on the phone. Cached for a day.
import type { BenchKey, NavSeries } from '@core/portfolio/engine';

const revalidate = 86400;

// One direct-plan growth index fund per yardstick, pinned by AMFI scheme code (D-088). Name search picked factor funds
// ("Nifty 500 Value 50", "Nifty 500 Momentum 50") in the first live check, so codes are fixed and the name is only a guard:
// if a code ever resolves to a fund whose name doesn't match, that yardstick is dropped and its funds show as not compared.
export const PICK: Record<BenchKey, { code: number; name: RegExp }> = {
  nifty50: { code: 120716, name: /^UTI Nifty 50 Index Fund\b.*direct.*growth/i },
  nifty500: { code: 147625, name: /^Motilal Oswal Nifty 500 Index Fund\b.*direct.*growth/i },
  midcap150: { code: 147622, name: /^Motilal Oswal Nifty Midcap 150 Index Fund\b.*direct.*growth/i },
  smallcap250: { code: 147623, name: /^Motilal Oswal Nifty Smallcap 250 Index Fund\b.*direct.*growth/i },
};
const FACTOR = /value|momentum|quality|alpha|low vol|equal weight|next 50|idcw|dividend/i;
/** True only for the plain index fund this yardstick expects. */
export const nameOk = (k: BenchKey, name: string) => PICK[k].name.test(name) && !FACTOR.test(name);
const API = 'https://api.mfapi.in/mf';
const day = { next: { revalidate } } as const;

async function fetchFund(k: BenchKey): Promise<{ code: number; name: string; s: NavSeries } | null> {
  const c = PICK[k].code;
  const r = await fetch(`${API}/${c}`, day); const j = (await r.json()) as { meta?: { scheme_name?: string }; data?: { date: string; nav: string }[] };
  const name = j.meta?.scheme_name ?? ''; if (!nameOk(k, name)) return null;
  const s = (j.data ?? []).map((d) => { const [dd, mm, yy] = d.date.split('-'); return [`${yy}-${mm}-${dd}`, Number(d.nav)] as [string, number]; })
    .filter(([, n]) => n > 0).sort((x, y) => x[0].localeCompare(y[0]));
  return { code: c, name, s };
}

/** The four series, or as many as could be fetched; empty when the source is down (the X-ray then hides the card). */
export async function benchSeries(): Promise<{ series: Partial<Record<BenchKey, NavSeries>>; info: Record<string, unknown> }> {
  const keys = Object.keys(PICK) as BenchKey[];
  const got = await Promise.all(keys.map(async (k) => { try { return [k, await fetchFund(k)] as const; } catch { return [k, null] as const; } }));
  const out: Partial<Record<BenchKey, NavSeries>> = {}; const info: Record<string, unknown> = {};
  for (const [k, v] of got) if (v && v.s.length) { out[k] = v.s; info[k] = { code: v.code, name: v.name, days: v.s.length, from: v.s[0][0], to: v.s.at(-1)![0] }; }
  return { series: out, info };
}
