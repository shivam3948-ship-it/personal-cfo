// Spends tab view model: the data blocks the compiled Spends screen (designs/Spends) reads, from @munim/core.
// Buckets (D-038/D-039): everyday = spend-group categories except rent; fixed = rent, loan EMIs, insurance; family = family support;
// not counted = investments, self transfers, card bill payments (money that stays yours or was already counted).
import type { Dataset, Txn } from '@core/types';
import { asOfDate, coverage, refundCategory, leaks } from '@core/finance/picture';
import { groupOf } from '@core/finance/categorize';
import { compareRefinance } from '@core/finance/loans';
import { cleanMerchant } from './spends';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const day = (d: string) => Number(d.slice(8, 10));

type Bucket = 'everyday' | 'fixed' | 'family' | 'uncat' | 'not' | 'income' | 'skip';
export function bucketOf(cat: string, dir: Txn['dir']): Bucket {
  const g = groupOf(cat);
  if (dir === 'credit') return g === 'income' ? 'income' : 'skip';
  if (cat === 'Other') return 'uncat';
  if (cat === 'Rent' || cat === 'Loan EMI' || cat === 'Insurance') return 'fixed';
  if (cat === 'Family support') return 'family';
  if (g === 'spend') return 'everyday';
  return 'not'; // investments, self transfers, card bill payments
}

/** One period's buckets: everyday by category (refunds netted into the category they came from), daily cumulative everyday spend. */
function period(ds: Dataset, from: string, to: string) {
  const ev: Record<string, number> = {}; let fx = 0, fam = 0, unc = 0, nc = 0, inc = 0;
  const y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  const daily = new Array(new Date(Date.UTC(y, m, 0)).getUTCDate()).fill(0); // one slot per day of this month
  for (const t of ds.txns.filter((x) => x.date >= from && x.date <= to)) {
    const cat = t.category ?? 'Other';
    if (t.dir === 'credit' && cat === 'Refund') { const rc = refundCategory(ds, t); if (bucketOf(rc, 'debit') === 'everyday') { ev[rc] = (ev[rc] ?? 0) - t.amount; daily[day(t.date) - 1] -= t.amount; } continue; }
    const b = bucketOf(cat, t.dir);
    if (b === 'everyday') { ev[cat] = (ev[cat] ?? 0) + t.amount; daily[day(t.date) - 1] += t.amount; }
    else if (b === 'fixed') fx += t.amount; else if (b === 'family') fam += t.amount; else if (b === 'uncat') unc += t.amount;
    else if (b === 'not') nc += t.amount; else if (b === 'income') inc += t.amount;
  }
  const cum: number[] = []; daily.reduce((a, v, i) => (cum[i] = a + v), 0);
  const top = ds.txns.filter((t) => t.dir === 'debit' && t.date >= from && t.date <= to && bucketOf(t.category ?? 'Other', 'debit') === 'everyday')
    .sort((a, b) => b.amount - a.amount || a.date.localeCompare(b.date)).slice(0, 4).map((t) => [t.date, cleanMerchant(t.merchant ?? t.desc), t.category ?? 'Other', t.amount]);
  return { ev, fx, fam, unc, nc, inc, cum, top, total: sum(Object.values(ev)) };
}

export function buildSpendsMain(ds: Dataset) {
  const asOf = asOfDate(ds), d = day(asOf);
  const cov = coverage(ds);
  const done = cov.filter((c) => c.complete), cur = cov.find((c) => !c.complete) ?? cov.at(-1)!;
  const P = Object.fromEntries(done.map((c) => [c.key.slice(5), period(ds, c.from, c.to)]));
  const now = period(ds, cur.from, asOf);
  const keys = Object.keys(P);
  const by15 = (k: string, cat?: string) => { const c = done.find((x) => x.key.slice(5) === k)!; const p = period(ds, c.from, `${c.key}-${String(d).padStart(2, '0')}`); return cat ? p.ev[cat] ?? 0 : p.total; };
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
  const cats = Object.keys(now.ev).filter((k) => now.ev[k] > 0).sort((a, b) => now.ev[b] - now.ev[a]);
  const recent = ds.txns.filter((t) => t.dir === 'debit' && t.date >= cur.from && t.date <= asOf && bucketOf(t.category ?? 'Other', 'debit') === 'everyday')
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
    .map((t) => [`${day(t.date)} ${MON[Number(t.date.slice(5, 7)) - 1]}`, cleanMerchant(t.merchant ?? t.desc), t.category ?? 'Other', t.amount]);
  const lk = leaks(ds);
  const food = ds.txns.filter((t) => t.dir === 'debit' && t.category === 'Food delivery' && t.date >= cur.from && t.date <= asOf);
  const costliest = [...ds.loans].sort((a, b) => b.ratePct - a.ratePct)[0], offer = [...ds.offers].sort((a, b) => a.ratePct - b.ratePct)[0];
  const refi = costliest && offer ? compareRefinance(costliest, offer, asOf) : null;
  return {
    CAT: Object.fromEntries(cats.map((k) => [k, now.ev[k]])),
    // "usual" = the middle month (median), as on the category pages, so one odd month doesn't move it
    USUAL15: Object.fromEntries(cats.map((k) => [k, median(keys.map((m) => by15(m, k)))])),
    PACE: keys.map((k) => ({ m: MON[Number(k) - 1], v: by15(k) })),
    USUALCUM: Array.from({ length: 31 }, (_, i) => median(keys.map((k) => P[k].cum[Math.min(i, P[k].cum.length - 1)]))),
    OCTCUM: now.cum.slice(0, d),
    FIXED: now.fx, FAMILY: now.fam, UNCAT: now.unc, NOTCOUNTED: now.nc,
    RECENT: recent,
    INCOME: P[keys.at(-1)!]?.inc ?? 0,
    MONTHS: [...keys.map((k) => [MON[Number(k) - 1], P[k].total, P[k].fx, P[k].fam, true]), [MON[Number(cur.key.slice(5)) - 1], now.total, now.fx, now.fam, false]],
    FOOD: { amt: now.ev['Food delivery'] ?? 0, usual15: median(keys.map((k) => by15(k, 'Food delivery'))), orders: food.length },
    LEAK: (() => {
      const one = (k: string) => lk.find((l) => l.kind === k);
      const cult = one('inactive')?.annualCost ?? 0, lingo = one('trial_charge')?.annualCost ?? 0;
      // yearly cost of every subscription, including the unused gym and the trial that turned paid
      return { cult, dup: one('duplicate')?.amount ?? 0, lingo, subsYear: sum(lk.filter((l) => l.kind === 'subscription').map((l) => l.annualCost)) + lingo + cult };
    })(),
    orbitMatch: refi?.matchSaving ?? 0, orbitSwitchNet: refi?.switchNetSaving ?? 0,
    PAST: Object.fromEntries(keys.map((k) => [k, { inc: P[k].inc, ev: P[k].ev, fx: P[k].fx, fam: P[k].fam, unc: P[k].unc, nc: P[k].nc, cum: P[k].cum, top: P[k].top }])),
  };
}
