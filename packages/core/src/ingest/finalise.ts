// After all files are read: categorise, borrow categories for terse SMS rows, and check documents against each other
// (card payments vs bank debits, EMIs vs loan terms, premiums vs policies). Pure: runs on the phone and the server.
import type { Check, Dataset, Txn } from '../types';
import { categorizeAll } from '../finance/categorize';
import { loanStatus } from '../finance/loans';
import { annualPremium } from '../finance/insurance';
import { daysBetween } from '../dates';
import { inr } from '../money';

/** Categorise, learn categories for terse SMS narrations from history, and run cross-document checks. */
export function finalise(ds: Dataset) {
  ds.txns = categorizeAll(ds.txns.map((t) => ({ ...t, category: undefined, merchant: undefined })));
  // "UPI/RAJESH KUMAR" in an SMS: inherit the category of an earlier statement row with the same amount whose narration contains that counterparty.
  for (const t of ds.txns) {
    if (t.source !== 'sms' || !['Other', 'Other income'].includes(t.category ?? '')) continue;
    const token = t.desc.split('/').pop()?.trim().toLowerCase() ?? '';
    if (token.length < 4) continue;
    const prior = ds.txns.find((p) => p !== t && p.source !== 'sms' && p.amount === t.amount && p.dir === t.dir && p.desc.toLowerCase().includes(token));
    if (prior) { t.category = prior.category; t.merchant = prior.merchant; }
  }
  ds.txns.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  cardPayments(ds);
  crossChecks(ds);
}

/** On a card, the bill payment is a credit ("BPPY CC PAYMENT…", "BBPS…", "NEFT…") that the word rules may read as income
 *  (found on a real HDFC card statement, 28 Oct). On a card account, a credit worded like a payment that isn't cashback
 *  or a refund IS the bill payment. Unworded credits are re-labelled only when they add up, to the paisa, to the payments
 *  total the statement prints (some cards print one combined Payments/Credits figure, so that alone can't be used). */
const PAYMENT_WORDS = /\b(bppy|bbps|payment|paymt|pymt|neft|imps|upi|autopay|auto ?debit|net ?banking|netbanking|thank you)\b/i;
function cardPayments(ds: Dataset) {
  const label = (t: Txn) => { if (t.category !== 'Card bill payment') { t.category = 'Card bill payment'; t.merchant = undefined; t.matched = 'card_payment'; } };
  const notCb = (t: Txn) => !['Cashback', 'Refund', 'Card bill payment'].includes(t.category ?? '');
  for (const t of ds.txns) if (t.account.startsWith('card:') && t.dir === 'credit' && notCb(t) && PAYMENT_WORDS.test(t.desc)) label(t);
  for (const s of ds.cardStatements) {
    if (!(s.payments > 0)) continue;
    const credits = ds.txns.filter((t) => t.account === s.account && t.dir === 'credit' && t.sourceFile === s.file);
    const sum = (xs: Txn[]) => xs.reduce((a, t) => a + t.amount, 0);
    const paid = credits.filter((t) => t.category === 'Card bill payment');
    if (sum(paid) === s.payments) continue;
    const others = credits.filter(notCb);
    if (others.length && sum(paid) + sum(others) === s.payments) others.forEach(label);
  }
}

function crossChecks(ds: Dataset) {
  const checks: Check[] = [];
  const asOf = ds.txns.map((t) => t.date).sort().at(-1) ?? '';
  // 1. Card bill paid from the bank = payment received on the card statement (±3 days). A bank debit of exactly that
  //    amount in that window IS the bill payment, whatever its narration says ("UPI/CRED…", "IB BILLPAY…"): it is
  //    re-labelled so it isn't counted as spending on top of the card's own purchases (the double count).
  const used = new Set<Txn>();
  for (const s of ds.cardStatements) {
    const cardPay = ds.txns.filter((t) => t.account === s.account && t.category === 'Card bill payment' && t.dir === 'credit' && t.date >= s.periodStart && t.date <= s.periodEnd);
    for (const p of cardPay) {
      const near = (t: Txn) => t.account.startsWith('bank:') && t.dir === 'debit' && t.amount === p.amount && !used.has(t) && Math.abs(daysBetween(t.date, p.date)) <= 3;
      let bankSide = ds.txns.find((t) => near(t) && t.category === 'Card bill payment');
      if (!bankSide) {
        const cands = ds.txns.filter(near);
        if (cands.length === 1) { bankSide = cands[0]; bankSide.category = 'Card bill payment'; bankSide.merchant = undefined; bankSide.matched = 'card_payment'; } // only an unambiguous match is re-labelled
      }
      if (bankSide) used.add(bankSide);
      const bankCovers = ds.txns.some((t) => t.account.startsWith('bank:') && t.date <= p.date) && ds.txns.some((t) => t.account.startsWith('bank:') && t.date >= p.date && t.source === 'bank_statement');
      if (bankCovers) checks.push({ id: 'card_payment_match', label: `Card payment ${p.date} matches a bank debit`, ok: !!bankSide, detail: bankSide ? `${inr(p.amount)} on ${bankSide.date}${bankSide.matched === 'card_payment' ? ' (matched by amount and date)' : ''}` : `no bank debit of ${inr(p.amount)} near ${p.date}` });
    }
  }
  // 2. Loans: stated EMI matches the terms; bank EMI debits equal the stated EMI.
  for (const l of ds.loans) {
    const st = loanStatus(l, asOf);
    checks.push({ id: 'emi_terms', label: `${l.lender}: stated EMI matches principal, rate and tenure`, ok: st.emiMatchesTerms, detail: `stated ${inr(l.emi, 'auto')}` });
    const key = l.lender.split(' ')[0].toLowerCase();
    const debits = ds.txns.filter((t) => t.dir === 'debit' && t.category === 'Loan EMI' && t.desc.toLowerCase().includes(key));
    if (debits.length) checks.push({ id: 'emi_debits', label: `${l.lender}: ${debits.length} EMI debits in the bank data equal the stated EMI`, ok: debits.every((t) => t.amount === l.emi), detail: debits.filter((t) => t.amount !== l.emi).map((t) => `${t.date} ${inr(t.amount, 'auto')}`).join(', ') || 'all match' });
    // 3. Credit report balance vs computed outstanding (±1%).
    const rep = ds.credit?.accounts.find((a) => a.lender && l.lender.toLowerCase().includes(a.lender.toLowerCase().split(' ')[0]) && a.balance !== undefined);
    if (rep && ds.credit) {
      const comp = loanStatus(l, ds.credit.asOf).outstanding;
      checks.push({ id: 'bureau_balance', label: `${l.lender}: credit report balance vs amortisation`, ok: Math.abs(comp - rep.balance!) <= comp * 0.01, detail: `report ${inr(rep.balance!)} vs computed ${inr(comp)}` });
    }
  }
  // 4. Policy premiums seen in the bank data equal the policy's premium.
  for (const p of ds.policies) {
    const key = p.insurer.split(' ')[0].toLowerCase();
    const debits = ds.txns.filter((t) => t.dir === 'debit' && t.category === 'Insurance' && t.desc.toLowerCase().includes(key));
    if (debits.length) checks.push({ id: 'premium_debits', label: `${p.insurer}: premium debits equal the policy premium`, ok: debits.every((t) => t.amount === p.premium), detail: `${debits.length} debit(s); policy ${inr(p.premium)} (${inr(annualPremium(p))}/yr)` });
  }
  if (checks.length) ds.log.push({ file: '(all documents)', kind: 'cross-check', parser: 'rule', ok: checks.every((c) => c.ok), summary: `${checks.filter((c) => c.ok).length}/${checks.length} cross-document checks pass`, checks });
}

