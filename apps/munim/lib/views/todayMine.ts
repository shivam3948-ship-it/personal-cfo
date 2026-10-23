// Today on your own statements (D-049): the figures the Today screen needs, from data that lives on the phone.
// Pure and browser-safe: lib/local/patch.ts runs it in the browser; tests run it on the sample family's statements.
// The check-in keeps its three cards: Save (money path, from ESS/EMG), the latest day in your statements, and one fix.
import type { Dataset } from '@core/types';
import { asOfDate, latestBankBalance, leaks, monthPictures, subscriptionsToConfirm } from '@core/finance/picture';
import { inr } from '@core/money';
import { bucketOf, buildSpendsMain } from './spendsMain';
import { cleanMerchant } from './spends';

const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dm = (iso: string) => `${+iso.slice(8, 10)} ${MON3[+iso.slice(5, 7) - 1]}`;
const daysIn = (key: string) => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7), 0)).getUTCDate();

export interface TodayMine {
  mine: true;
  verdictSub: string;
  dateLine: string;                // today's date on this phone (the patch sets it); the asOf date in tests
  inv: boolean;                    // a CAS is on this phone (the patch sets it)
  bill: { amount: number; due: string; dueIso: string; covered: boolean | null } | null; // the latest card bill, and whether the latest bank balance covers it
  day: { none?: boolean; date: string; label: string; spent: number; usual: number | null; top: [string, number][]; unsorted: number }; // whole rupees
  fix: { title: string; sub: string; href: string } | null;
  /** The subscription card (D-052): a finding the statements prove, else one recurring charge to confirm. */
  sub: { merchant: string; kind: 'still_charged' | 'unused' | 'renewal' | 'ask'; title: string; sub: string } | null;
}

/** Which subscription the "One fix" card asks about: proof first (charged after cancelling, a membership with no orders,
 *  a renewal within 30 days), then the most expensive recurring charge you haven't answered about. */
export function subCard(ds: Dataset): TodayMine['sub'] {
  const lk = leaks(ds);
  const pick = (k: string) => lk.find((l) => l.kind === k);
  const still = pick('still_charged'), unused = pick('membership_unused'), renew = pick('renewal');
  if (still) return { merchant: still.merchant, kind: 'still_charged', title: still.title, sub: `${inr(still.amount)} went out. Check the cancellation went through, and ask for it back.` };
  if (unused) return { merchant: unused.merchant, kind: 'unused', title: unused.title, sub: `It costs ${inr(unused.annualCost)} a year.` };
  if (renew) return { merchant: renew.merchant, kind: 'renewal', title: renew.title, sub: 'Decide now: once it renews, the money is usually gone.' };
  const r = subscriptionsToConfirm(ds)[0];
  if (!r) return null;
  const per = r.cadence === 'yearly' ? 'a year' : 'a month';
  return { merchant: r.merchant, kind: 'ask', title: `${inr(r.amount)} ${per} to ${r.merchant}. Still using it?`, sub: `Last charged ${dm(r.lastDate)}. Your bank statement can’t tell if you use it; you can.` };
}

export function buildTodayMine(ds: Dataset): TodayMine {
  const asOf = asOfDate(ds);
  if (!ds.txns.length) return { mine: true, verdictSub: 'From your mutual fund statement', dateLine: '', inv: false, bill: null, fix: null, sub: null, // a CAS but no bank or card statement yet
    day: { none: true, date: asOf, label: '', spent: 0, usual: null, top: [], unsorted: 0 } };
  // the most recent day with everyday spending (a day with only an SIP or a transfer says nothing about spending)
  const evDays = ds.txns.filter((t) => t.dir === 'debit' && bucketOf(t.category ?? 'Other', 'debit') === 'everyday').map((t) => t.date).sort();
  const day = evDays.at(-1) ?? asOf;
  const onDay = ds.txns.filter((t) => t.date === day && t.dir === 'debit');
  const everyday = onDay.filter((t) => bucketOf(t.category ?? 'Other', 'debit') === 'everyday');
  const byMerchant = new Map<string, number>();
  for (const t of everyday) { const m = cleanMerchant(t.merchant ?? t.desc); byMerchant.set(m, (byMerchant.get(m) ?? 0) + t.amount); }
  const top = [...byMerchant.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m, p]) => [m, Math.round(p / 100)] as [string, number]);
  const spent = everyday.reduce((s, t) => s + t.amount, 0);
  const unsorted = onDay.filter((t) => bucketOf(t.category ?? 'Other', 'debit') === 'uncat').reduce((s, t) => s + t.amount, 0);

  // your average day: everyday spending over the complete months in your statements ÷ their days (null if none yet)
  const complete = monthPictures(ds).filter((p) => p.complete);
  const evTotal = complete.reduce((s, p) => s + ds.txns.filter((t) => t.date.startsWith(p.key) && t.dir === 'debit' && bucketOf(t.category ?? 'Other', 'debit') === 'everyday').reduce((a, t) => a + t.amount, 0), 0);
  const days = complete.reduce((s, p) => s + daysIn(p.key), 0);
  const usual = days ? Math.round(evTotal / days / 100) : null;

  const f = buildSpendsMain(ds, { reportFrom: null }).FIXES[0] as { kind?: string; title: string; sub: string } | undefined;
  const cat = f?.kind === 'pace' ? f.title.split(' up ')[0] : null;
  // the latest card bill, only while it is still ahead of the statements' last day (a bill whose date has passed is history, not a to-do)
  const st = [...ds.cardStatements].filter((c) => c.dueDate && c.dueDate >= asOf).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).at(-1);
  const bank = latestBankBalance(ds);
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return {
    mine: true,
    dateLine: `${DAYS[new Date(asOf + 'T00:00:00Z').getUTCDay()]}, ${dm(asOf)}`, inv: false,
    bill: st ? { amount: Math.round(st.totalDue / 100), due: dm(st.dueDate), dueIso: st.dueDate, covered: bank ? bank.balance >= st.totalDue : null } : null,
    verdictSub: `From your statements, up to ${dm(asOf)}`,
    day: { date: day, label: `Your last spending day, ${dm(day)}`, spent: Math.round(spent / 100), usual, top, unsorted: Math.round(unsorted / 100) },
    fix: f ? { title: f.title, sub: f.sub, href: cat ? `/spends/category/${encodeURIComponent(cat)}` : '/spends' } : null,
    sub: subCard(ds),
  };
}
