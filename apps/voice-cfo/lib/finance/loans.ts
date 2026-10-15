import type { Loan, Paise } from '../types';
import { addMonths, daysBetween } from '../dates';

/** Standard reducing-balance EMI, rounded to the rupee like most Indian lenders. */
export function computeEmi(principal: Paise, ratePct: number, months: number): Paise {
  const r = ratePct / 1200;
  if (r === 0) return Math.round(principal / months / 100) * 100;
  const f = Math.pow(1 + r, months);
  return Math.round((principal * r * f) / (f - 1) / 100) * 100;
}

export interface ScheduleRow { n: number; date: string; opening: Paise; interest: Paise; principal: Paise; closing: Paise; payment: Paise }

/** Month-by-month amortisation from a balance; interest rounded to paise; the last payment clears the balance. */
export function schedule(balance: Paise, ratePct: number, emi: Paise, startDate: string, maxMonths = 600): ScheduleRow[] {
  const r = ratePct / 1200;
  const rows: ScheduleRow[] = [];
  let b = balance;
  for (let i = 0; i < maxMonths && b > 0; i++) {
    const interest = Math.round(b * r);
    // Lenders round the EMI to the rupee; the last EMI absorbs the leftover instead of creating an extra month.
    const due = b + interest;
    const pay = due - emi < Math.max(100, emi * 0.02) ? due : emi;
    const closing = b + interest - pay;
    rows.push({ n: i + 1, date: addMonths(startDate, i), opening: b, interest, principal: pay - interest, closing, payment: pay });
    b = closing;
    if (pay <= interest) throw new Error('EMI does not cover interest');
  }
  return rows;
}

/** EMIs already debited on or before `asOf`. */
export function emisPaid(loan: Loan, asOf: string): number {
  if (asOf < loan.firstEmiDate) return 0;
  let k = 0;
  while (k < loan.tenureMonths && addMonths(loan.firstEmiDate, k) <= asOf) k++;
  return k;
}

export interface LoanStatus {
  id: string; lender: string; type: Loan['type']; ratePct: number; emi: Paise; emiStated: Paise; emiMatchesTerms: boolean;
  emisPaid: number; emisLeft: number; outstanding: Paise; interestLeft: Paise; nextEmiDate: string | null; endDate: string;
}

export function loanStatus(loan: Loan, asOf: string): LoanStatus {
  const computed = computeEmi(loan.principal, loan.ratePct, loan.tenureMonths);
  const full = schedule(loan.principal, loan.ratePct, loan.emi, loan.firstEmiDate);
  const k = emisPaid(loan, asOf);
  const outstanding = k === 0 ? loan.principal : full[Math.min(k, full.length) - 1].closing;
  const left = full.slice(k);
  return {
    id: loan.id, lender: loan.lender, type: loan.type, ratePct: loan.ratePct, emi: loan.emi, emiStated: loan.emi,
    emiMatchesTerms: Math.abs(computed - loan.emi) <= 100, // within ₹1
    emisPaid: k, emisLeft: left.length, outstanding,
    interestLeft: left.reduce((s, r) => s + r.interest, 0),
    nextEmiDate: left[0]?.date ?? null,
    endDate: full[full.length - 1].date,
  };
}

const withGst = (x: Paise, gst: boolean) => (gst ? Math.round(x * 1.18) : x);

export interface PrepayResult {
  loanId: string; lender: string; amount: Paise; mode: 'reduce_tenure' | 'reduce_emi';
  allowed: boolean; allowedFrom: string | null; charge: Paise;
  interestSaved: Paise; netSaving: Paise; monthsSaved: number; newEmi: Paise; newEndDate: string | null;
  outstandingBefore: Paise; outstandingAfter: Paise;
}

/** Part-prepayment applied right after the last paid EMI. Charges come from the loan document. */
export function simulatePrepayment(loan: Loan, amount: Paise, asOf: string, mode: 'reduce_tenure' | 'reduce_emi' = 'reduce_tenure'): PrepayResult {
  const st = loanStatus(loan, asOf);
  const amt = Math.min(amount, st.outstanding);
  const allowed = st.emisPaid >= loan.prepay.allowedAfterEmis;
  const allowedFrom = allowed ? null : addMonths(loan.firstEmiDate, loan.prepay.allowedAfterEmis - 1);
  const charge = withGst(Math.round((amt * loan.prepay.chargePct) / 100), loan.prepay.gst);
  const start = st.nextEmiDate ?? asOf;
  const base = schedule(st.outstanding, loan.ratePct, loan.emi, start);
  const after = st.outstanding - amt;
  let newEmi = loan.emi;
  let alt: ScheduleRow[] = [];
  if (after > 0) {
    if (mode === 'reduce_emi') newEmi = computeEmi(after, loan.ratePct, base.length);
    alt = schedule(after, loan.ratePct, newEmi, start);
  }
  const intBase = base.reduce((s, r) => s + r.interest, 0);
  const intAlt = alt.reduce((s, r) => s + r.interest, 0);
  return {
    loanId: loan.id, lender: loan.lender, amount: amt, mode, allowed, allowedFrom, charge,
    interestSaved: intBase - intAlt, netSaving: intBase - intAlt - charge,
    monthsSaved: base.length - alt.length, newEmi, newEndDate: alt.length ? alt[alt.length - 1].date : null,
    outstandingBefore: st.outstanding, outstandingAfter: after,
  };
}

export interface RefinanceResult {
  loanId: string; lender: string; currentRatePct: number; offerRatePct: number; offerLender: string;
  outstanding: Paise; monthsLeft: number;
  interestCurrent: Paise; interestAtOffer: Paise; grossSaving: Paise;
  processingFee: Paise; foreclosureCharge: Paise; switchNetSaving: Paise;
  switchAllowed: boolean; switchAllowedFrom: string | null; offerValidTill: string | null; offerExpiresBeforeLockIn: boolean;
  newEmiAtOffer: Paise; matchSaving: Paise; // if the current lender matches the offer rate: no fees
}

/** Compare switching to an offer vs. asking the current lender to match it, same remaining tenure. */
export function compareRefinance(loan: Loan, offer: { lender: string; ratePct: number; processingFeePct?: number; gstOnFee: boolean; validTill?: string }, asOf: string): RefinanceResult {
  const st = loanStatus(loan, asOf);
  const start = st.nextEmiDate ?? asOf;
  const n = st.emisLeft;
  const cur = schedule(st.outstanding, loan.ratePct, loan.emi, start);
  const newEmi = computeEmi(st.outstanding, offer.ratePct, n);
  const alt = schedule(st.outstanding, offer.ratePct, newEmi, start);
  const iCur = cur.reduce((s, r) => s + r.interest, 0);
  const iAlt = alt.reduce((s, r) => s + r.interest, 0);
  const fee = withGst(Math.round((st.outstanding * (offer.processingFeePct ?? 0)) / 100), offer.gstOnFee);
  const fc = withGst(Math.round((st.outstanding * loan.foreclose.chargePct) / 100), loan.foreclose.gst);
  const allowed = st.emisPaid >= loan.foreclose.allowedAfterEmis;
  const allowedFrom = allowed ? null : addMonths(loan.firstEmiDate, loan.foreclose.allowedAfterEmis - 1);
  return {
    loanId: loan.id, lender: loan.lender, currentRatePct: loan.ratePct, offerRatePct: offer.ratePct, offerLender: offer.lender,
    outstanding: st.outstanding, monthsLeft: n, interestCurrent: iCur, interestAtOffer: iAlt, grossSaving: iCur - iAlt,
    processingFee: fee, foreclosureCharge: fc, switchNetSaving: iCur - iAlt - fee - fc,
    switchAllowed: allowed, switchAllowedFrom: allowedFrom, offerValidTill: offer.validTill ?? null,
    offerExpiresBeforeLockIn: !!(allowedFrom && offer.validTill && offer.validTill < allowedFrom),
    newEmiAtOffer: newEmi, matchSaving: iCur - iAlt,
  };
}

export const daysUntil = (asOf: string, d: string) => daysBetween(asOf, d);
