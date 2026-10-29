// Spends tab view model: the data blocks the compiled Spends screen (designs/Spends) reads, from @munim/core.
// Buckets (D-038/D-039): everyday = spend-group categories except rent; fixed = rent, loan EMIs, insurance; family = family support;
// not counted = investments, self transfers, card bill payments (money that stays yours or was already counted).
import type { Dataset, Txn } from '@core/types';
import { asOfDate, coverage, refundCategory, leaks, recurring } from '@core/finance/picture';
import { groupOf } from '@core/finance/categorize';
import { compareRefinance } from '@core/finance/loans';
import { inr } from '@core/money';
import { cleanMerchant } from './spends';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const day = (d: string) => Number(d.slice(8, 10));

type Bucket = 'everyday' | 'fixed' | 'family' | 'uncat' | 'not' | 'income' | 'skip';
export function bucketOf(cat: string, dir: Txn['dir']): Bucket {
  const g = groupOf(cat);
  if (dir === 'credit') return g === 'income' ? 'income' : 'skip';
  if (cat === 'Other' || cat === 'Paid to people') return 'uncat'; // paid to a person: we know who, not what for (D-078)
  if (cat === 'Rent' || cat === 'Loan EMI' || cat === 'Insurance' || cat === 'Regular payments') return 'fixed'; // Tax is "not counted": a once-a-year payment isn't a month's fixed cost
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

const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// category pages the design knows by short name (ui/dc.js CATEGORY); others link straight to /spends/category/<name>
const SHORT: Record<string, string> = { 'Food delivery': 'Food', Dining: 'Dining', 'Quick commerce': 'Quick', Shopping: 'Shopping', Cabs: 'Cabs', Fuel: 'Fuel', Utilities: 'Utilities', 'Mobile & internet': 'Mobile', 'Cash withdrawal': 'Cash', Fitness: 'Fitness' };
const catHref = (c: string) => (SHORT[c] ? `Category${SHORT[c]}.dc.html` : `/spends/category/${encodeURIComponent(c)}`);
const dm = (iso: string) => `${+iso.slice(8, 10)} ${MON[+iso.slice(5, 7) - 1]}`;

export interface SpendsOpts { reportFrom?: string | null }

export function buildSpendsMain(ds: Dataset, opts: SpendsOpts = { reportFrom: 'September' }) {
  const asOf = asOfDate(ds), d = day(asOf);
  const cov = coverage(ds);
  // this month is the LATEST month in the statements (a partial first month, e.g. a statement starting 30 Oct last year, is
  // not "now"); past months are the complete ones before it, at most 11, so two Octobers never share a key (keys are MM)
  const cur = cov.at(-1)!, done = cov.filter((c) => c.complete && c.key !== cur.key).slice(-11);
  const P = Object.fromEntries(done.map((c) => [c.key.slice(5), period(ds, c.from, c.to)]));
  const now = period(ds, cur.from, asOf);
  const keys = Object.keys(P);
  const by15 = (k: string, cat?: string) => { const c = done.find((x) => x.key.slice(5) === k)!; const p = period(ds, c.from, `${c.key}-${String(d).padStart(2, '0')}`); return cat ? p.ev[cat] ?? 0 : p.total; };
  const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
  const cats = Object.keys(now.ev).filter((k) => now.ev[k] > 0).sort((a, b) => now.ev[b] - now.ev[a]);
  const recent = ds.txns.filter((t) => t.dir === 'debit' && t.date >= cur.from && t.date <= asOf && bucketOf(t.category ?? 'Other', 'debit') === 'everyday')
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
    .map((t) => [`${day(t.date)} ${MON[Number(t.date.slice(5, 7)) - 1]}`, cleanMerchant(t.merchant ?? t.desc), t.category ?? 'Other', t.amount]);
  const lk = leaks(ds);
  const food = ds.txns.filter((t) => t.dir === 'debit' && t.category === 'Food delivery' && t.date >= cur.from && t.date <= asOf);
  const costliest = [...ds.loans].sort((a, b) => b.ratePct - a.ratePct)[0], offer = [...ds.offers].sort((a, b) => a.ratePct - b.ratePct)[0];
  const refi = costliest && offer ? compareRefinance(costliest, offer, asOf) : null;
  const usual15 = Object.fromEntries(cats.map((k) => [k, median(keys.map((m) => by15(m, k)))]));
  // a yearly or trial charge inside this month's subscriptions gets a note, so its jump isn't read as a habit
  const yearly = ds.txns.find((t) => t.dir === 'debit' && t.category === 'Subscriptions' && t.date >= cur.from && t.date <= asOf
    && (lk.some((l) => l.kind === 'trial_charge' && l.merchant === t.merchant) || recurring(ds).some((r) => r.cadence === 'yearly' && r.merchant === t.merchant)));
  // ---- "What you can change": biggest pace overshoot, then leaks the statements prove, then a cheaper-rate ask ----
  const FIXES: Record<string, unknown>[] = [];
  const over = cats.filter((k) => !(yearly && k === yearly.category) && usual15[k] > 0 && now.ev[k] >= usual15[k] * 1.2).sort((a, b) => now.ev[b] / usual15[b] - now.ev[a] / usual15[a])[0];
  if (over) {
    const n = ds.txns.filter((t) => t.dir === 'debit' && t.category === over && t.date >= cur.from && t.date <= asOf).length || 1;
    const skip2 = 2 * Math.round(now.ev[over] / n);
    FIXES.push({ kind: 'pace', icon: '↑', title: `${over} up ${Math.round(((now.ev[over] - usual15[over]) / usual15[over]) * 100)}% this month`,
      sub: over === 'Food delivery' ? `Skip 2 orders, save ${inr(skip2)}` : `Spend a little less here, save ${inr(skip2)}`, gain: inr(skip2), href: catHref(over) });
  }
  // D-052: memberships with no matching orders, charges after you chose to cancel, yearly renewals within 30 days
  for (const l of lk.filter((x) => x.kind === 'still_charged')) FIXES.push({ icon: '!', title: `${l.merchant} charged after you cancelled`, sub: 'Check it was cancelled; ask for it back', gain: inr(l.amount) });
  for (const l of lk.filter((x) => x.kind === 'membership_unused')) FIXES.push({ icon: '!', title: l.title, sub: `${inr(l.amount)} each time · cancel it`, gain: `${inr(l.annualCost)}/yr` });
  for (const l of lk.filter((x) => x.kind === 'renewal')) FIXES.push({ icon: '↻', title: l.title, sub: 'Keep it, or turn off auto-renew first', gain: inr(l.amount) });
  for (const kind of ['inactive', 'duplicate', 'trial_charge'] as const) for (const l of lk.filter((x) => x.kind === kind)) {
    if (kind === 'inactive') FIXES.push({ icon: '!', title: `${l.merchant} unused since ${l.since ? FULL[+l.since.slice(5, 7) - 1] : 'a while'}`, sub: `${inr(l.amount)} a month`, gain: `${inr(l.annualCost)}/yr` });
    if (kind === 'duplicate') FIXES.push({ icon: '2×', title: `${l.merchant} charged twice`, sub: `${l.date ? dm(l.date) + ' · ' : ''}ask for a refund`, gain: inr(l.amount) });
    if (kind === 'trial_charge') FIXES.push({ icon: '₹', title: `${l.merchant} trial became paid`, sub: 'Cancel or ask for a refund', gain: inr(l.amount) });
  }
  if (refi && refi.switchNetSaving < 0 && refi.matchSaving > 0) FIXES.push({ icon: '%', title: `Ask ${costliest.lender.split(' ')[0]} to match ${refi.offerRatePct}%`, sub: `Taking ${refi.offerLender.split(' ')[0]}’s offer loses ${inr(-refi.switchNetSaving)} after fees`, gain: inr(refi.matchSaving), tag: 'Munim earns nothing from this', kind: 'rate' });
  // ---- money in (salaried view): this month's credits, income by complete month, salary dates ----
  const curCredits = ds.txns.filter((t) => t.dir === 'credit' && t.date >= cur.from && t.date <= asOf && (t.category === 'Salary' || t.category === 'Other income'));
  const salary = ds.txns.filter((t) => t.dir === 'credit' && t.category === 'Salary');
  const INSAL = {
    credits: curCredits.map((t) => [t.date, t.category === 'Salary' ? 'Salary' : cleanMerchant(t.merchant ?? t.desc), t.category === 'Salary' ? 'salary' : 'side', t.amount]),
    hist: keys.map((k) => [MON[Number(k) - 1], P[k].inc]),
    salDates: salary.map((t) => t.date),
  };
  const bankAcct = (salary.at(-1)?.account ?? ds.accounts.find((a) => a.kind === 'bank')?.id ?? '').split(':')[1] ?? '';
  const META = { cur: Number(cur.key.slice(5)) - 1, day: d, pastN: keys.length, bank: bankAcct, files: null, reportFrom: opts.reportFrom ?? null, subNote: yearly ? `Includes ${yearly.merchant}’s yearly ${inr(yearly.amount)}` : '' };
  return {
    META, FIXES, INSAL,
    CAT: Object.fromEntries(cats.map((k) => [k, now.ev[k]])),
    // "usual" = the middle month (median), as on the category pages, so one odd month doesn't move it
    USUAL15: usual15,
    PACE: keys.map((k) => ({ m: MON[Number(k) - 1], v: by15(k) })),
    USUALCUM: Array.from({ length: 31 }, (_, i) => (keys.length ? median(keys.map((k) => P[k].cum[Math.min(i, P[k].cum.length - 1)])) : 0)),
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
