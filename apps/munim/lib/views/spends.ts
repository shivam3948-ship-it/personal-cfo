// Spends view models (transactions, category detail): same shapes as designs/design-data.json, computed from @munim/core.
import type { Dataset } from '@core/types';
import { asOfDate, monthPictures, leaks } from '@core/finance/picture';
import { groupOf } from '@core/finance/categorize';

/** Card descriptors → a readable name: "POS CHAAYOS SECTOR 29" → "Chaayos". */
export const cleanMerchant = (m: string) => {
  const x = m.replace(/^(POS|UPI|ECOM|NEFT|IMPS)[\s/-]+/i, '').replace(/\s+(SECTOR|SEC|PHASE|BLOCK)\s*\d+.*$/i, '').trim();
  const acronym = /^[A-Z&]{2,5}$/.test(x); // HPCL, IOCL stay as they are
  return x === x.toUpperCase() && !acronym ? x.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : x;
};

const CATS = ['Food delivery', 'Quick commerce', 'Dining', 'Shopping', 'Cabs', 'Fuel', 'Utilities', 'Mobile & internet', 'Cash withdrawal', 'Fitness'];

/** This month's transactions, newest first: [date, dir, amount, merchant, category, account]. */
export function buildTransactions(ds: Dataset) {
  const asOf = asOfDate(ds), month = asOf.slice(0, 7);
  const TX = ds.txns.filter((t) => t.date.startsWith(month) && t.date <= asOf)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => [t.date, t.dir, t.amount, t.merchant ?? t.desc, t.category ?? 'Other', t.account]);
  return { TX, RULES0: 1 }; // the sample family's one saved rule; your statements start with none (lib/local/patch.ts)
}

/** Per category: m = monthly totals (complete months + this month so far), u15 = spend by day 15 of each complete month, tx = this month's debits. */
export function buildCategory(ds: Dataset) {
  const asOf = asOfDate(ds), day = Number(asOf.slice(8, 10)), month = asOf.slice(0, 7);
  const pics = monthPictures(ds);
  const complete = pics.filter((p) => p.complete);
  const spendIn = (cat: string, from: string, to: string) => ds.txns.filter((t) => t.category === cat && t.date >= from && t.date <= to)
    .reduce((s, t) => s + (t.dir === 'debit' ? t.amount : -t.amount), 0);
  const DATA: Record<string, { m: number[]; u15: number[]; tx: [string, string, number, string][] }> = {};
  for (const cat of CATS) {
    if (groupOf(cat) !== 'spend') continue;
    DATA[cat] = {
      m: pics.map((p) => p.byCategory[cat] ?? 0),
      u15: complete.map((p) => spendIn(cat, `${p.key}-01`, `${p.key}-${String(day).padStart(2, '0')}`)),
      tx: ds.txns.filter((t) => t.category === cat && t.dir === 'debit' && t.date.startsWith(month) && t.date <= asOf)
        .sort((a, b) => b.date.localeCompare(a.date)).map((t) => [t.date, cleanMerchant(t.merchant ?? t.desc), t.amount, t.account]),
    };
  }
  // when: this month, the day we're on, and the complete months the bars compare (0–11), so the design never assumes October 15
  const idleLeak = leaks(ds).find((l) => l.kind === 'inactive'); // shown on the membership (Fitness) card only
  const META = { cur: Number(month.slice(5, 7)) - 1, day, past: complete.map((p) => Number(p.key.slice(5, 7)) - 1), idle: idleLeak ? { en: idleLeak.title, hi: idleLeak.titleHi } : null };
  return { DATA, META };
}

