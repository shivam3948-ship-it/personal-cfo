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

/** SIP vs one-time investments (owner, 2 Nov 2026: "is there any actionable insight from fund vs you?"). "Fund vs You"
 *  only says how timing went; this splits your own money by habit: the yearly return of your steady SIP instalments and
 *  of your one-time investments, each priced at today's NAV. A SIP is a purchase amount repeated at least 3 times about
 *  monthly (as investingHabits); everything else bought is one-time, so a step-up SIP (the amount rising each year) partly
 *  counts as one-time. Funds you have sold from are left out (which units
 *  were sold would need lot matching), as are purchases the CAS printed without units. Null when either side is empty. */
export interface HabitSide { invested: Paise; value: Paise; ratePct: number | null; buys: number }
export function sipVsOneTime(holdings: Holding[], asOf: string): { sip: HabitSide; oneTime: HabitSide; skippedFunds: number } | null {
  const side = () => ({ flows: [] as Flow[], invested: 0, value: 0, buys: 0 });
  const sip = side(), one = side(); let skipped = 0;
  for (const h of holdings) {
    const buys = h.flows.filter((f) => f.amount < 0);
    if (!buys.length) continue;
    if (h.flows.some((f) => f.amount > 0) || buys.some((f) => !f.units)) { skipped++; continue; }
    const counts = new Map<number, number>(); buys.forEach((f) => counts.set(f.amount, (counts.get(f.amount) ?? 0) + 1));
    const sipAmts = new Set<number>();
    for (const [amt, n] of counts) {
      if (n < 3) continue;
      const months = [...new Set(buys.filter((f) => f.amount === amt).map((f) => f.date.slice(0, 7)))].sort();
      const [y0, m0] = months[0].split('-').map(Number), [y1, m1] = months.at(-1)!.split('-').map(Number);
      if ((y1 - y0) * 12 + (m1 - m0) + 1 <= months.length * 2) sipAmts.add(amt); // about monthly, not a yearly top-up
    }
    for (const f of buys) {
      const g = sipAmts.has(f.amount) ? sip : one;
      const val = Math.round(f.units! * h.nav * 100);
      g.flows.push({ date: f.date, amount: f.amount }, { date: asOf, amount: val });
      g.invested += -f.amount; g.value += val; g.buys++;
    }
  }
  if (!sip.buys || !one.buys) return null;
  const out = (g: ReturnType<typeof side>): HabitSide => { const r = xirr(g.flows); return { invested: g.invested, value: g.value, ratePct: r === null ? null : round1(r * 100) + 0, buys: g.buys }; };
  return { sip: out(sip), oneTime: out(one), skippedFunds: skipped };
}

// ---------- Against its index (owner, 3 Nov 2026) ----------
// For each active equity fund: what the same money, on the same dates (buys and sells), would be worth today in an index
// fund that tracks the fund's kind of market. The index funds' daily NAVs are public AMFI data; nothing about the user is
// needed to get them. An index fund's NAV is net of its own small fee, so the comparison slightly favours the active fund.
export type BenchKey = 'nifty50' | 'nifty500' | 'midcap150' | 'smallcap250';
export const BENCH_LABEL: Record<BenchKey, { en: string; hi: string }> = {
  nifty50: { en: 'Nifty 50 index fund', hi: 'निफ़्टी 50 इंडेक्स फ़ंड' }, nifty500: { en: 'Nifty 500 index fund', hi: 'निफ़्टी 500 इंडेक्स फ़ंड' },
  midcap150: { en: 'Midcap 150 index fund', hi: 'मिडकैप 150 इंडेक्स फ़ंड' }, smallcap250: { en: 'Smallcap 250 index fund', hi: 'स्मॉलकैप 250 इंडेक्स फ़ंड' },
};
/** The index each kind of active equity fund is measured against; null for index funds themselves and non-equity funds. */
export function benchmarkOf(h: Pick<Holding, 'asset' | 'category'>): BenchKey | null {
  if (h.asset !== 'equity' || h.category === 'Index' || h.category === 'Sector / theme') return null; // a sector or theme fund has no fair broad index
  if (h.category === 'Large cap') return 'nifty50'; // Nifty 100 is the usual benchmark; a Nifty 50 index fund is the closest common one
  if (h.category === 'Mid cap') return 'midcap150';
  if (h.category === 'Small cap') return 'smallcap250';
  return 'nifty500'; // flexi, multi, ELSS, focused, value and other diversified equity
}
/** Daily NAVs as [YYYY-MM-DD, nav] sorted by date. */
export type NavSeries = [string, number][];
const navOn = (s: NavSeries, d: string): number | null => { let lo = 0, hi = s.length - 1, ans: number | null = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m][0] <= d) { ans = s[m][1]; lo = m + 1; } else hi = m - 1; } return ans; };
export interface BenchSkip { fund: string; why: 'too_old' | 'no_data' }
export interface BenchRow { fund: string; bench: BenchKey; invested: Paise; fundValue: Paise; benchValue: Paise; diff: Paise; fundPct: number | null; benchPct: number | null }
export function vsBenchmarks(holdings: Holding[], series: Partial<Record<BenchKey, NavSeries>>, asOf: string): { rows: BenchRow[]; notCovered: string[]; noData: string[] } {
  const rows: BenchRow[] = [], notCovered: string[] = [], noData: string[] = [];
  for (const h of holdings) {
    const key = benchmarkOf(h); if (!key || !h.flows.length || h.value <= 0) continue;
    const s = series[key]; const name = shortName(h.scheme).replace(/ Fund$/, '');
    if (!s?.length) { noData.push(name); continue; } // the index prices couldn't be fetched
    if (h.flows.some((f) => f.date < s[0][0])) { notCovered.push(name); continue; } // the index fund's history starts after this fund's first date
    let units = 0;
    for (const f of h.flows) units += -f.amount / 100 / navOn(s, f.date)!; // a buy (negative) adds index units, a sell takes them away
    const end = navOn(s, asOf); if (end === null) { noData.push(name); continue; }
    const benchValue = Math.round(units * end * 100);
    const flows = (v: Paise) => [...h.flows.map((f) => ({ date: f.date, amount: f.amount })), { date: asOf, amount: v }];
    const pct = (v: Paise) => { const r = xirr(flows(v)); return r === null ? null : round1(r * 100) + 0; };
    rows.push({ fund: name, bench: key, invested: -h.flows.filter((f) => f.amount < 0).reduce((a, f) => a + f.amount, 0), fundValue: h.value, benchValue, diff: h.value - benchValue, fundPct: pct(h.value), benchPct: pct(benchValue) });
  }
  return { rows, notCovered, noData };
}

/** Same-category duplication (owner, 3 Nov 2026): a stand-in for overlap without fund holdings. Two or more active equity
 *  funds of one kind (say three flexi-cap funds) usually hold many of the same large companies. */
export function sameCategory(holdings: Holding[]): { category: string; funds: string[]; value: Paise }[] {
  const by = new Map<string, Holding[]>();
  for (const h of holdings) if (h.asset === 'equity' && h.value > 0 && !['Index', 'Other', 'Equity (other)', 'Sector / theme'].includes(h.category)) by.set(h.category, [...(by.get(h.category) ?? []), h]);
  return [...by].filter(([, hs]) => hs.length >= 2).map(([category, hs]) => ({ category, funds: hs.map((h) => shortName(h.scheme).replace(/ Fund$/, '')), value: hs.reduce((a, h) => a + h.value, 0) }))
    .sort((a, b) => b.value - a.value);
}
