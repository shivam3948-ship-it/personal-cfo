// The Credit tab's numbers (D-094, 8 Nov): what you owe, what it costs, and what's due next, from data Munim already reads:
// card statements (cards.ts), loan papers (loans.ts), EMIs seen leaving your bank, and a credit report when there is one
// (picture.ts creditView). Pure and deterministic: every figure here, never from a model.
import type { Dataset, Paise, Txn } from '../types';
import { asOfDate, creditView } from './picture';
import { monthlyIncome } from './essentials';
import { loanStatus, type LoanStatus } from './loans';
import { cardBills, merchantKey, type CardBill } from './cards';

export interface CardInfo extends CardBill {
  label: string;
  /** finance charges and fees printed on this card's statements, and how many statements that covers */
  charges: Paise; statements: number;
  /** cycles where the bill was not paid in full (a balance carried into the next one), of the cycles we can check */
  carried: number; cyclesChecked: number;
}
export interface SeenEmi { payee: string; amount: Paise; day: number; months: number; last: string }
export interface DueItem { date: string; kind: 'card' | 'emi'; label: string; amount: Paise }
export interface CreditPicture {
  cards: CardInfo[]; loans: LoanStatus[]; seenEmis: SeenEmi[];
  owe: { cards: Paise; loans: Paise; total: Paise };
  monthlyEmi: Paise;
  /** EMIs as a share of the average monthly salary, one decimal; null without a salary in the statements */
  emiShareOfSalary: number | null;
  due: DueItem[];
  score: ReturnType<typeof creditView>;
  asOf: string;
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const RUPEE = 100;

/** EMIs seen leaving your bank that no loan paper explains: the same payee in two or more months, by the usual amount. */
function seenEmis(ds: Dataset, docEmis: Paise[]): SeenEmi[] {
  const byPayee = new Map<string, Txn[]>();
  for (const t of ds.txns) {
    if (t.dir !== 'debit' || t.category !== 'Loan EMI' || !t.account.startsWith('bank:')) continue;
    if (docEmis.some((e) => Math.abs(e - t.amount) <= RUPEE)) continue; // a loan paper already covers it
    const k = merchantKey(t) || t.desc.slice(0, 20).toLowerCase();
    byPayee.set(k, [...(byPayee.get(k) ?? []), t]);
  }
  const out: SeenEmi[] = [];
  for (const ts of byPayee.values()) {
    const months = new Set(ts.map((t) => t.date.slice(0, 7))).size;
    if (months < 2) continue;
    const last = ts.map((t) => t.date).sort().at(-1)!;
    out.push({ payee: ts[0].merchant ?? ts[0].desc, amount: median(ts.map((t) => t.amount)), day: median(ts.map((t) => +t.date.slice(8, 10))), months, last });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** The next date a monthly payment falls on, on or after `from`. */
function nextOnDay(from: string, day: number): string {
  const [y, m] = from.split('-').map(Number);
  const mk = (yy: number, mm: number) => { const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate(); return `${yy}-${String(mm).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`; };
  const here = mk(y, m);
  return here >= from ? here : m === 12 ? mk(y + 1, 1) : mk(y, m + 1);
}

export function creditPicture(ds: Dataset, today?: string): CreditPicture {
  const asOf = asOfDate(ds), now = today && today > asOf ? today : asOf;
  const label = (id: string) => ds.accounts.find((a) => a.id === id)?.label ?? `Card ••${id.split(':')[1] ?? ''}`;
  const cards: CardInfo[] = cardBills(ds, asOf, today).map((b) => {
    const st = ds.cardStatements.filter((s) => s.account === b.account).sort((x, y) => x.periodEnd.localeCompare(y.periodEnd));
    // a cycle carried a balance when the next statement shows payments below the previous balance, or charges (as advice.ts reads it)
    const later = st.slice(1);
    return { ...b, label: label(b.account), charges: st.reduce((a, s) => a + s.charges, 0), statements: st.length,
      carried: later.filter((s) => s.charges > 0 || s.payments < s.prevBalance - RUPEE).length, cyclesChecked: later.length };
  });
  const loans = (ds.loans ?? []).map((l) => loanStatus(l, asOf)).filter((l) => l.emisLeft > 0);
  const seen = seenEmis(ds, loans.map((l) => l.emi));
  const cardsOwe = cards.filter((c) => c.status !== 'paid_full').reduce((a, c) => a + Math.max(0, c.totalDue - c.paid), 0);
  const loansOwe = loans.reduce((a, l) => a + l.outstanding, 0);
  const monthlyEmi = loans.reduce((a, l) => a + l.emi, 0) + seen.reduce((a, e) => a + e.amount, 0);
  const salary = monthlyIncome(ds);
  const due: DueItem[] = [
    ...cards.filter((c) => c.status !== 'paid_full' && c.dueDate >= now).map((c): DueItem => ({ date: c.dueDate, kind: 'card', label: c.label, amount: Math.max(0, c.totalDue - c.paid) })),
    ...loans.filter((l) => l.nextEmiDate).map((l): DueItem => { const d = l.nextEmiDate! >= now ? l.nextEmiDate! : nextOnDay(now, +l.nextEmiDate!.slice(8, 10)); return { date: d, kind: 'emi', label: l.lender, amount: l.emi }; }),
    ...seen.map((e): DueItem => ({ date: nextOnDay(now, e.day), kind: 'emi', label: e.payee, amount: e.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return { cards, loans, seenEmis: seen, owe: { cards: cardsOwe, loans: loansOwe, total: cardsOwe + loansOwe }, monthlyEmi,
    emiShareOfSalary: salary && monthlyEmi ? Math.round((monthlyEmi / salary) * 1000) / 10 : null, due, score: creditView(ds), asOf };
}
