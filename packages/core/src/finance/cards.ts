// Credit cards beyond "the bill adds up" (D-092, 8 Nov): where each card's latest bill stands, how much of the limit it
// uses, and which refunds go with which purchase. Asked for by the owner after comparing Munim with his Spend Analyser
// reports on two real card statements. Pure and deterministic: every figure is computed here, never by a model.
import type { CardStatement, Dataset, Paise, Txn } from '../types';
import { merchantOf } from './categorize';

const RUPEE = 100; // paise: banks round the printed total to the rupee

export type BillStatus =
  | 'paid_full'    // payments at least the total due, by the due date
  | 'paid_min'     // at least the minimum, less than the total: interest on the whole bill, and new purchases lose their free days
  | 'paid_part'    // something, but less than the minimum: a late fee too
  | 'due'          // due date still ahead and no payment seen yet
  | 'missed'       // due date passed, your statements cover that day, and no payment to this card is in them
  | 'unknown';     // due date passed, but your statements stop before it: can't tell
export interface CardBill {
  account: string; last4: string; file: string; periodEnd: string; dueDate: string;
  totalDue: Paise; minDue: Paise; paid: Paise; status: BillStatus;
  limit?: Paise; available?: Paise;
  /** the bill as a share of the limit, one decimal (from the statement's own limit; missing when it doesn't print one) */
  usedPct?: number;
}

/** Payments to this card after the statement and by its due date: the card's own credits (a later statement shows them), else
 *  bank debits labelled as card bill payments. A bank payment is credited to this card only when it fits it: the same amount
 *  as its total or minimum due (to the rupee), or this is the only card bill falling due in that window. */
function paidTowards(s: CardStatement, ds: Dataset, due: CardStatement[]): Paise {
  const inWindow = (t: Txn) => t.date > s.periodEnd && t.date <= s.dueDate && t.category === 'Card bill payment';
  const own = ds.txns.filter((t) => t.account === s.account && t.dir === 'credit' && inWindow(t));
  if (own.length) return own.reduce((a, t) => a + t.amount, 0);
  const bank = ds.txns.filter((t) => t.account.startsWith('bank:') && t.dir === 'debit' && inWindow(t));
  const fits = (t: Txn) => Math.abs(t.amount - s.totalDue) <= RUPEE || Math.abs(t.amount - s.minDue) <= RUPEE;
  const others = due.filter((o) => o !== s && o.dueDate >= s.periodEnd && o.periodEnd <= s.dueDate);
  const mine = others.length ? bank.filter(fits) : bank;
  return mine.reduce((a, t) => a + t.amount, 0);
}

/** The latest bill of every card, newest due date first. `asOf` is the last day your statements cover. */
export function cardBills(ds: Dataset, asOf: string): CardBill[] {
  const latest = new Map<string, CardStatement>();
  for (const s of ds.cardStatements) { if (!s.dueDate) continue; const p = latest.get(s.account); if (!p || s.periodEnd > p.periodEnd) latest.set(s.account, s); }
  const due = [...latest.values()];
  const bankTo = ds.txns.filter((t) => t.account.startsWith('bank:')).reduce((m, t) => (t.date > m ? t.date : m), '');
  return due.map((s): CardBill => {
    const paid = s.totalDue <= 0 ? 0 : paidTowards(s, ds, due);
    const ownTo = ds.txns.filter((t) => t.account === s.account && t.date > s.periodEnd).reduce((m, t) => (t.date > m ? t.date : m), '');
    const seenTo = ownTo > bankTo ? ownTo : bankTo; // the last day any statement lets us see payments
    const status: BillStatus = s.totalDue <= 0 || paid >= s.totalDue - RUPEE ? 'paid_full'
      : paid > 0 ? (paid >= s.minDue - RUPEE ? 'paid_min' : 'paid_part')
      : s.dueDate >= asOf ? 'due' : seenTo >= s.dueDate ? 'missed' : 'unknown';
    const limit = s.limit ?? ds.accounts.find((x) => x.id === s.account)?.limit;
    const usedPct = limit && limit > 0 ? Math.round((Math.max(0, s.totalDue) / limit) * 1000) / 10 : undefined;
    return { account: s.account, last4: s.account.split(':')[1] ?? '', file: s.file, periodEnd: s.periodEnd, dueDate: s.dueDate, totalDue: s.totalDue, minDue: s.minDue, paid, status,
      ...(limit ? { limit } : {}), ...(s.available !== undefined ? { available: s.available } : {}), ...(usedPct !== undefined ? { usedPct } : {}) };
  }).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

// ---- refunds ----
export type RefundKind = 'full' | 'partial' | 'none';
export interface RefundMatch { credit: Txn; kind: RefundKind; purchase?: Txn }

const STOP = new Set(['pvt', 'ltd', 'private', 'limited', 'india', 'the', 'www', 'com', 'group', 'online', 'services', 'technologies', 'payments', 'retail', 'store', 'stores']);
/** The merchant's first meaningful word: "IBIBO GROUP PVT LTD" and "Ibibo Group Private Limited" are both "ibibo". */
export function merchantKey(t: Txn): string {
  const words = (t.merchant || merchantOf(t.desc)).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
  return words[0] ?? '';
}
const NOT_REFUND = new Set(['Card bill payment', 'Cashback', 'Salary', 'Interest', 'Self transfer', 'Family support']);
/** A credit that gives money back for a purchase: anything labelled Refund, and any other credit on a card that isn't the
 *  bill payment or cashback (a merchant crediting a card is a refund, whatever the narration says). */
export const isRefundCredit = (t: Txn) => t.dir === 'credit' && (t.category === 'Refund' || (t.account.startsWith('card:') && !NOT_REFUND.has(t.category ?? '')));

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
/** Each refund with the purchase it most likely reverses: the same merchant, before it and within a year. The same amount is a
 *  full refund (each purchase used once); otherwise the nearest larger purchase is a likely part refund (a partial
 *  cancellation can't be proved from statements, so it is said as "probably"); none found is said as none. */
export function matchRefunds(ds: Dataset): RefundMatch[] {
  const credits = ds.txns.filter(isRefundCredit).sort((a, b) => a.date.localeCompare(b.date));
  const used = new Set<string>();
  return credits.map((c): RefundMatch => {
    const k = merchantKey(c);
    if (!k) return { credit: c, kind: 'none' };
    const pool = ds.txns.filter((t) => t.dir === 'debit' && !used.has(t.id) && t.date <= c.date && days(t.date, c.date) <= 365 && t.amount >= c.amount && merchantKey(t) === k)
      .sort((a, b) => Number(b.account === c.account) - Number(a.account === c.account) || b.date.localeCompare(a.date));
    const exact = pool.find((t) => t.amount === c.amount);
    if (exact) { used.add(exact.id); return { credit: c, kind: 'full', purchase: exact }; }
    const part = pool.length ? [...pool].sort((a, b) => a.amount - b.amount || b.date.localeCompare(a.date))[0] : undefined;
    return part ? { credit: c, kind: 'partial', purchase: part } : { credit: c, kind: 'none' };
  });
}
