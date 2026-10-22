// Portfolio x-ray: value, cost, gain, XIRR (per fund and overall), asset mix, regular-plan share and an ESTIMATED extra cost.
import type { Paise } from '../types';
import type { AssetClass, Flow, Holding } from './cas';

/** Annualised return of dated cash flows (invest < 0, value/redemption > 0). Bisection on NPV; null when undefined. */
export function xirr(flows: Flow[]): number | null {
  if (flows.length < 2 || !flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const sorted = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  const t0 = Date.parse(sorted[0].date);
  const yrs = sorted.map((f) => (Date.parse(f.date) - t0) / (365 * 86400000));
  const npv = (r: number) => sorted.reduce((s, f, i) => s + f.amount / Math.pow(1 + r, yrs[i]), 0);
  let lo = -0.99, hi = 5;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (npv(mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** ⚠ ESTIMATE, not fund data: typical regular-vs-direct expense-ratio gap per year by category. Replace with AMFI TER data (D-OPEN-3). */
export const TER_GAP_ESTIMATE: Record<string, number> = { equity: 0.009, hybrid: 0.008, debt: 0.005, liquid: 0.0015, index: 0.004, gold: 0.004, other: 0.007 };
const gapFor = (h: Holding) => (h.category === 'Liquid' ? TER_GAP_ESTIMATE.liquid : h.category === 'Index' ? TER_GAP_ESTIMATE.index : TER_GAP_ESTIMATE[h.asset] ?? TER_GAP_ESTIMATE.other);

export interface FundView { isin: string; scheme: string; shortName: string; plan: 'Direct' | 'Regular'; category: string; asset: AssetClass; value: Paise; cost: Paise; gain: Paise; xirrPct: number | null; sharePct: number; estExtraCostPerYear: Paise }
export interface PortfolioView {
  asOf: string; value: Paise; cost: Paise; gain: Paise; xirrPct: number | null; funds: FundView[];
  mix: { asset: AssetClass; value: Paise; pct: number }[];
  regular: { funds: number; value: Paise; sharePct: number; estExtraCostPerYear: Paise; assumption: string };
  sipPerMonth: Paise | null;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
export const shortName = (scheme: string) => scheme.replace(/\s*-\s*(Direct|Regular)\b.*$/i, '').replace(/\s*\((G|Growth)\)\s*$/i, '').trim();

/** Average monthly SIP over the last 3 months of purchases that repeat with the same amount (null if none). */
function sipPerMonth(holdings: Holding[], asOf: string): Paise | null {
  const cutoff = new Date(Date.parse(asOf) - 92 * 86400000).toISOString().slice(0, 10);
  let total = 0;
  for (const h of holdings) {
    const recent = h.flows.filter((f) => f.amount < 0 && f.date > cutoff);
    const counts = new Map<number, number>(); recent.forEach((f) => counts.set(f.amount, (counts.get(f.amount) ?? 0) + 1));
    const rep = [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])[0];
    if (rep) total += -rep[0];
  }
  return total || null;
}

export function portfolioView(holdings: Holding[], asOf: string): PortfolioView {
  const value = holdings.reduce((s, h) => s + h.value, 0);
  const cost = holdings.reduce((s, h) => s + h.cost, 0);
  const funds: FundView[] = holdings.map((h) => ({
    isin: h.isin, scheme: h.scheme, shortName: shortName(h.scheme), plan: h.plan, category: h.category, asset: h.asset,
    value: h.value, cost: h.cost, gain: h.value - h.cost,
    xirrPct: (() => { const r = xirr([...h.flows, { date: h.navDate || asOf, amount: h.value }]); return r === null ? null : round1(r * 100); })(),
    sharePct: value ? round1((h.value / value) * 100) : 0,
    estExtraCostPerYear: h.plan === 'Regular' ? Math.round(h.value * gapFor(h)) : 0,
  })).sort((a, b) => b.value - a.value);
  const all = xirr([...holdings.flatMap((h) => h.flows), { date: asOf, amount: value }]);
  const byAsset = new Map<AssetClass, number>(); holdings.forEach((h) => byAsset.set(h.asset, (byAsset.get(h.asset) ?? 0) + h.value));
  const reg = funds.filter((f) => f.plan === 'Regular');
  const regValue = reg.reduce((s, f) => s + f.value, 0);
  return {
    asOf, value, cost, gain: value - cost, xirrPct: all === null ? null : round1(all * 100), funds,
    mix: [...byAsset].map(([asset, v]) => ({ asset, value: v, pct: value ? round1((v / value) * 100) : 0 })).sort((a, b) => b.value - a.value),
    regular: { funds: reg.length, value: regValue, sharePct: value ? round1((regValue / value) * 100) : 0, estExtraCostPerYear: reg.reduce((s, f) => s + f.estExtraCostPerYear, 0), assumption: 'Estimated expense gap between regular and direct plans: equity 0.9%, hybrid 0.8%, debt 0.5%, index 0.4%, liquid 0.15% a year. Check each fund’s actual TER.' },
    sipPerMonth: sipPerMonth(holdings, asOf),
  };
}

// ---------- your money vs your funds (docs/42) ----------
export interface FundGrowth { firstDate: string; navThen: number; navNow: number; fundPct: number | null }

/** The fund's own growth since your first purchase: point-to-point on the CAS's own NAVs, a yearly rate (what factsheets advertise). */
export function fundGrowth(h: Holding, asOf: string): FundGrowth | null {
  const first = [...h.flows].sort((a, b) => a.date.localeCompare(b.date)).find((f) => f.amount < 0 && f.nav);
  if (!first?.nav || !h.nav) return null;
  const yrs = (Date.parse(asOf) - Date.parse(first.date)) / (365.25 * 86400000);
  return { firstDate: first.date, navThen: first.nav, navNow: h.nav, fundPct: yrs > 0.5 ? round1((Math.pow(h.nav / first.nav, 1 / yrs) - 1) * 100) : null };
}

/** Behaviour from the CAS: monthly SIP instalments that were skipped, and sells (redemptions/switch-outs). */
export function investingHabits(holdings: Holding[]): { sipGaps: number; sells: number; since: string | null } {
  let gaps = 0, sells = 0; let since: string | null = null;
  for (const h of holdings) {
    const buys = h.flows.filter((f) => f.amount < 0);
    sells += h.flows.filter((f) => f.amount > 0).length;
    const first = buys.map((f) => f.date).sort()[0];
    if (first && (!since || first < since)) since = first;
    // SIP = a purchase amount that repeats at least 3 times; lump sums don't count as gaps.
    const counts = new Map<number, number>(); buys.forEach((f) => counts.set(f.amount, (counts.get(f.amount) ?? 0) + 1));
    const sip = [...counts].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (sip === undefined) continue;
    const months = [...new Set(buys.filter((f) => f.amount === sip).map((f) => f.date.slice(0, 7)))].sort();
    if (months.length >= 3) {
      const [y0, m0] = months[0].split('-').map(Number), [y1, m1] = months.at(-1)!.split('-').map(Number);
      const span = (y1 - y0) * 12 + (m1 - m0) + 1;
      if (span > months.length * 2) continue; // yearly or occasional lump sums of the same amount, not a monthly SIP
      gaps += span - months.length;
    }
  }
  return { sipGaps: gaps, sells, since };
}
