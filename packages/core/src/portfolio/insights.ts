// Portfolio x-ray insights (docs/42 · X-ray v3): each one a rupee figure, a next step and, where there is one, a deadline.
// Lot-level (FIFO) maths on the CAS's own transactions. Category level only: plan type, tax, timing, overlap. Never "buy fund X".
// ⚠ Tax rules are today's (equity LTCG 12.5% above ₹1.25 lakh a year after 12 months; STCG 20%). Verify for each FY before launch.
import type { Paise } from '../types';
import type { Holding } from './cas';
import { TER_GAP_ESTIMATE, shortName } from './engine';

export const LTCG_EXEMPT: Paise = 12500000; // ₹1.25 lakh per financial year
export const LTCG_RATE = 0.125;
export const FD_RATE = 0.07; // assumed FD rate for the comparison (shown as an assumption)

const DAY = 86400000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const addYears = (d: string, n: number) => `${Number(d.slice(0, 4)) + n}${d.slice(4)}`;
const isEquityLike = (h: Holding) => h.asset !== 'debt';
const isIndex = (h: Holding) => h.category === 'Index';
const isElss = (h: Holding) => h.category === 'ELSS';
const gapFor = (h: Holding) => (isIndex(h) ? TER_GAP_ESTIMATE.index : TER_GAP_ESTIMATE[h.asset] ?? TER_GAP_ESTIMATE.other);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface Lot { fund: string; date: string; amount: Paise; units: number; nav: number; value: Paise; gain: Paise; longTerm: boolean; locked: boolean }

/** Purchase lots still held, oldest first (FIFO): redemptions use up the oldest units first. */
export function lots(h: Holding, asOf: string): Lot[] {
  const buys = h.flows.filter((f) => f.amount < 0 && f.units && f.units > 0).sort((a, b) => a.date.localeCompare(b.date)).map((f) => ({ ...f, left: f.units! }));
  let sold = -sum(h.flows.filter((f) => f.amount > 0 && f.units).map((f) => f.units!));
  for (const b of buys) { const take = Math.min(b.left, sold); b.left -= take; sold -= take; }
  const name = shortName(h.scheme);
  return buys.filter((b) => b.left > 0.0005).map((b) => {
    const amount = Math.round(-b.amount * (b.left / b.units!));
    const value = Math.round(b.left * h.nav * 100);
    return { fund: name, date: b.date, amount, units: b.left, nav: b.nav!, value, gain: value - amount, longTerm: days(b.date, asOf) > 365, locked: isElss(h) && addYears(b.date, 3) > asOf };
  });
}

/** Financial year (Apr–Mar) containing a date. */
export function financialYear(d: string) {
  const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return { start: `${start}-04-01`, end: `${start + 1}-03-31` };
}

/** Same SIP amount repeating in the last 3 months → the monthly SIP into this fund (paise), else 0. */
function sipOf(h: Holding, asOf: string): Paise {
  const cutoff = new Date(Date.parse(asOf) - 92 * DAY).toISOString().slice(0, 10);
  const counts = new Map<number, number>();
  h.flows.filter((f) => f.amount < 0 && f.date > cutoff).forEach((f) => counts.set(-f.amount, (counts.get(-f.amount) ?? 0) + 1));
  return [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

export interface XrayInsights {
  asOf: string;
  harvest: { exempt: Paise; used: Paise; usedKnown: boolean; left: Paise; ltGainAll: Paise; harvest: Paise; taxSavedLater: Paise; deadline: string; daysLeft: number;
    combo: { gain: Paise; value: Paise; lots: number; feeSavedYr: Paise; futureTax: Paise; funds: string[] } };
  regular: { rows: { fund: string; stValue: Paise }[]; feeTotal: Paise; ltGainReg: Paise; taxIfSwitchAllLT: Paise; ltValueReg: Paise; feeOnLT: Paise; paybackYears: number | null; sipReg: Paise };
  elss: { fund: string; plan: string; freeValue: Paise; freeGain: Paise; lockedValue: Paise } | null;
  vsIndex: Record<string, { covered: number; of: number; invested: Paise; fundValue: Paise; indexValue: Paise; diff: Paise }>;
}

export function xrayInsights(holdings: Holding[], asOf: string): XrayInsights {
  const fy = financialYear(asOf);
  const L = new Map(holdings.map((h) => [h, lots(h, asOf)]));
  const reg = holdings.filter((h) => h.plan === 'Regular');
  // ---- regular → direct ----
  const rows = reg.map((h) => {
    const ls = L.get(h)!.filter((l) => !l.locked);
    return { fund: shortName(h.scheme), h, lt: ls.filter((l) => l.longTerm), st: ls.filter((l) => !l.longTerm) };
  });
  const feeTotal = sum(reg.map((h) => Math.round(h.value * gapFor(h))));
  const ltGainReg = sum(rows.flatMap((r) => r.lt.map((l) => l.gain)));
  const ltValueReg = sum(rows.flatMap((r) => r.lt.map((l) => l.value)));
  const taxIfSwitchAllLT = Math.round(Math.max(0, ltGainReg - LTCG_EXEMPT) * LTCG_RATE);
  const feeOnLT = Math.round(sum(rows.map((r) => sum(r.lt.map((l) => l.value)) * gapFor(r.h))));
  // ---- tax-free gains this FY ----
  // Gains already booked this FY eat into the limit. Matching sold lots to gains isn't built yet, so any redemption this FY marks the figure unknown.
  const sellsThisFy = holdings.filter(isEquityLike).some((h) => h.flows.some((f) => f.amount > 0 && f.date >= fy.start && f.date <= asOf));
  const used = 0;
  const ltGainAll = sum(holdings.filter(isEquityLike).flatMap((h) => L.get(h)!.filter((l) => l.longTerm && !l.locked).map((l) => l.gain)));
  const left = LTCG_EXEMPT - used, harvest = Math.max(0, Math.min(left, ltGainAll));
  // the plan: oldest long-term regular-plan lots, fund by fund (A→Z), while the gains still fit inside the limit
  let g = 0, v = 0, n = 0; const funds = new Set<string>();
  for (const r of [...rows].sort((a, b) => a.fund.localeCompare(b.fund))) {
    for (const l of r.lt) { if (g + l.gain > harvest) break; g += l.gain; v += l.value; n++; funds.add(r.fund.replace(/ Fund$/, '')); }
  }
  // ---- ELSS out of lock-in ----
  const el = holdings.find(isElss);
  const elss = el ? (() => { const ls = L.get(el)!; const free = ls.filter((l) => !l.locked);
    return { fund: shortName(el.scheme).replace(/ Fund$/, ''), plan: el.plan, freeValue: sum(free.map((l) => l.value)), freeGain: sum(free.map((l) => l.gain)), lockedValue: sum(ls.filter((l) => l.locked).map((l) => l.value)) }; })() : null;
  // ---- vs a plain index fund on the same dates (index NAVs from the user's own index fund, where the dates match) ----
  const idx = holdings.find(isIndex);
  const vsIndex: XrayInsights['vsIndex'] = {};
  if (idx) {
    const nav = new Map(idx.flows.filter((f) => f.nav).map((f) => [f.date, f.nav!]));
    for (const h of holdings.filter((x) => x.asset === 'equity' && !isIndex(x))) {
      const ls = L.get(h)!; const cov = ls.filter((l) => nav.has(l.date));
      if (!ls.length || cov.length !== ls.length) continue; // needs index history for every date (AMFI/NSE data in the real build)
      const indexValue = Math.round(sum(cov.map((l) => l.amount / 100 / nav.get(l.date)!)) * idx.nav * 100);
      const fundValue = sum(ls.map((l) => l.value));
      vsIndex[shortName(h.scheme).replace(/ Fund$/, '')] = { covered: cov.length, of: ls.length, invested: sum(ls.map((l) => l.amount)), fundValue, indexValue, diff: fundValue - indexValue };
    }
  }
  return {
    asOf,
    harvest: { exempt: LTCG_EXEMPT, used, usedKnown: !sellsThisFy, left, ltGainAll, harvest, taxSavedLater: Math.round(harvest * LTCG_RATE), deadline: fy.end, daysLeft: days(asOf, fy.end),
      combo: { gain: g, value: v, lots: n, feeSavedYr: Math.round(v * TER_GAP_ESTIMATE.equity), futureTax: Math.round(g * LTCG_RATE), funds: [...funds] } },
    regular: { rows: rows.map((r) => ({ fund: r.fund.replace(/ Fund$/, ''), stValue: sum(r.st.map((l) => l.value)) })), feeTotal, ltGainReg, taxIfSwitchAllLT, ltValueReg, feeOnLT,
      paybackYears: feeOnLT ? Math.round((taxIfSwitchAllLT / feeOnLT) * 10) / 10 : null, sipReg: sum(reg.map((h) => sipOf(h, asOf))) },
    elss, vsIndex,
  };
}

/** Fund overlap: share of each pair's portfolio in the same stocks (Σ min weight), and your rupees in each stock across funds. */
export function overlap(holdings: Holding[], weights: Record<string, Record<string, number>>) {
  const eq = holdings.filter((h) => weights[shortName(h.scheme)]);
  const label = (h: Holding) => shortName(h.scheme).split(' ')[0];
  const pairs: [string, string, number][] = [];
  for (let i = 0; i < eq.length; i++) for (let j = i + 1; j < eq.length; j++) {
    const a = weights[shortName(eq[i].scheme)], b = weights[shortName(eq[j].scheme)];
    pairs.push([label(eq[i]), label(eq[j]), Math.round(sum(Object.keys(a).filter((s) => s in b).map((s) => Math.min(a[s], b[s]))) * 10) / 10]);
  }
  pairs.sort((x, y) => y[2] - x[2]);
  const expo = new Map<string, { paise: Paise; funds: number }>();
  for (const h of eq) for (const [s, w] of Object.entries(weights[shortName(h.scheme)])) {
    const e = expo.get(s) ?? { paise: 0, funds: 0 }; e.paise += Math.round((h.value * w) / 100); e.funds++; expo.set(s, e);
  }
  const top5 = [...expo].sort((a, b) => b[1].paise - a[1].paise).slice(0, 5);
  const equity = sum(eq.map((h) => h.value)), top5Paise = sum(top5.map(([, e]) => e.paise));
  return { pairs, top5: top5.map(([s, e]) => [s, e.paise, e.funds] as [string, Paise, number]), top5Paise, top5PctOfEquity: equity ? Math.round((top5Paise / equity) * 1000) / 10 : 0,
    in3plus: [...expo].filter(([, e]) => e.funds >= 3).map(([s]) => s).sort(), equityPaise: equity };
}

/** What an FD would be worth today on the same purchase dates and amounts (compounded yearly at `rate`, before tax). */
export function fdComparison(holdings: Holding[], asOf: string, rate = FD_RATE) {
  const buys = holdings.flatMap((h) => h.flows.filter((f) => f.amount < 0));
  const fdValue = Math.round(sum(buys.map((f) => -f.amount * Math.pow(1 + rate, days(f.date, asOf) / 365))));
  const actual = sum(holdings.map((h) => h.value));
  return { rate: rate * 100, invested: -sum(buys.map((f) => f.amount)), fdValue, actual, extra: actual - fdValue };
}
