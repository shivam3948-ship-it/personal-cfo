// Foreign-currency spending on a card and the bank's hidden mark-up (D-096, 15 Nov). Banks fold the mark-up and the GST on it
// into the rupee amount ("Mark-up fee and corresponding GST levied is included in the transaction amount displayed", ICICI),
// so it never shows as a line. Munim estimates it from the card's published mark-up, chosen by the owner over a live market
// rate (no rate lookup, nothing leaves the phone). Pure and deterministic; every figure keeps its formula, inputs and source.
import type { Dataset, Paise, Txn } from '../types';

export interface FxFee {
  bank: string; card: string;
  /** mark-up in basis points of the amount abroad (350 = 3.5%), and GST on the mark-up in % */
  markupBp: number; gstPct: number;
  source: string; asOf: string;
}
/** Published mark-ups, by the bank in the card's label. Only cards checked against a source; one card per bank for now, so the
 *  copy names the card the rate is for (a statement doesn't print the card's name). */
export const FX_FEES: Record<string, FxFee> = {
  icici: { bank: 'ICICI', card: 'Sapphiro', markupBp: 350, gstPct: 18, source: 'CardInsider, "ICICI Bank credit cards forex markup charges" (updated 3 Jan 2026)', asOf: '2026-01-03' },
};

export interface CardForex {
  account: string;
  rows: number;
  /** rupees charged for purchases made in another currency */
  paid: Paise;
  currencies: string[];
  /** the bank's mark-up + GST inside `paid`, estimated from the published rate; null when the card's rate isn't known */
  fee: { amount: Paise; bp: number; rate: FxFee; formula: string } | null;
}

const bankOf = (label: string) => Object.keys(FX_FEES).find((k) => label.toLowerCase().startsWith(k)) ?? null;

/** Each card's purchases made in another currency (rows carrying `fx`). The mark-up is inside the rupee amount, so
 *  fee = paid × f / (1 + f), with f = mark-up × (1 + GST): 3.5% + 18% GST is 4.13% of the amount abroad, 3.97% of the rupees. */
export function cardForex(ds: Dataset): CardForex[] {
  const out: CardForex[] = [];
  for (const a of ds.accounts.filter((x) => x.kind === 'card')) {
    const rows: Txn[] = ds.txns.filter((t) => t.account === a.id && t.dir === 'debit' && t.fx);
    if (!rows.length) continue;
    const paid = rows.reduce((s, t) => s + t.amount, 0);
    const k = bankOf(a.label), rate = k ? FX_FEES[k] : null;
    const bp = rate ? Math.round((rate.markupBp * (100 + rate.gstPct)) / 100) : 0; // 350 × 1.18 = 413
    out.push({ account: a.id, rows: rows.length, paid, currencies: [...new Set(rows.map((t) => t.fx!.currency))],
      fee: rate ? { amount: Math.round((paid * bp) / (10000 + bp)), bp, rate, formula: `paid × ${bp} / ${10000 + bp}` } : null });
  }
  return out;
}
