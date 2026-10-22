import type { Dataset, Paise, Txn } from '../types';
import { CATEGORIES, groupOf } from './categorize';
import { addDays, addMonths, daysBetween, monthKey, spokenDate } from '../dates';
import { groupIndian, pct, sum } from '../money';
import { monthName } from '../dates';
const monthLabel = (k: string) => monthName(k, 'en');
import { loanStatus } from './loans';
import { annualPremium, nextDueDate } from './insurance';

// ---------- coverage ----------
export interface MonthCoverage { key: string; from: string; to: string; complete: boolean }

/** Months covered by bank-side data (statement or SMS); a month is complete if data spans day 1..last day. */
export function coverage(ds: Dataset): MonthCoverage[] {
  const bankTx = ds.txns.filter((t) => t.account.startsWith('bank:'));
  if (!bankTx.length) return [];
  const dates = bankTx.map((t) => t.date).sort();
  const first = dates[0]; const last = dates[dates.length - 1];
  const stmtStart = ds.accounts.filter((a) => a.kind === 'bank' && a.opening !== undefined).length ? first.slice(0, 8) + '01' : first;
  const out: MonthCoverage[] = [];
  for (let k = monthKey(first); k <= monthKey(last); k = monthKey(addMonths(k + '-01', 1))) {
    const mStart = k + '-01'; const mEnd = addDays(addMonths(mStart, 1), -1);
    const from = mStart < stmtStart ? stmtStart : mStart; const to = mEnd > last ? last : mEnd;
    out.push({ key: k, from, to, complete: from === mStart && to === mEnd });
  }
  return out;
}

export const asOfDate = (ds: Dataset): string => process.env.DEMO_AS_OF || ds.txns.map((t) => t.date).sort().at(-1) || new Date().toISOString().slice(0, 10);

// ---------- refunds net against the original category ----------
export function refundCategory(ds: Dataset, r: Txn): string {
  const prior = ds.txns.filter((t) => t.dir === 'debit' && t.merchant === r.merchant && t.date <= r.date && groupOf(t.category ?? 'Other') === 'spend').sort((a, b) => b.date.localeCompare(a.date));
  return prior.find((t) => t.amount === r.amount)?.category ?? prior[0]?.category ?? 'Other';
}

// ---------- monthly money picture ----------
export interface MonthPicture {
  key: string; complete: boolean; from: string; to: string;
  income: Paise; spend: Paise; committed: Paise; surplus: Paise; savingsRatePct: number;
  byCategory: Record<string, Paise>; nonSpendExcluded: Paise;
}

export function monthPictures(ds: Dataset): MonthPicture[] {
  const cov = coverage(ds);
  return cov.map((c) => {
    const tx = ds.txns.filter((t) => t.date >= c.from && t.date <= c.to);
    const byCategory: Record<string, Paise> = {};
    let income = 0, spend = 0, committed = 0, excluded = 0;
    for (const t of tx) {
      const cat = t.category ?? 'Other';
      const g = groupOf(cat);
      if (t.dir === 'credit') {
        if (g === 'income') { income += t.amount; byCategory[cat] = (byCategory[cat] ?? 0) + t.amount; }
        else if (cat === 'Refund') { const rc = refundCategory(ds, t); byCategory[rc] = (byCategory[rc] ?? 0) - t.amount; spend -= t.amount; }
        else excluded += t.amount;
        continue;
      }
      if (g === 'spend') { spend += t.amount; byCategory[cat] = (byCategory[cat] ?? 0) + t.amount; }
      else if (g === 'committed') { committed += t.amount; byCategory[cat] = (byCategory[cat] ?? 0) + t.amount; }
      else excluded += t.amount;
    }
    // Reconcile: spend + committed must equal the sum of their category subtotals.
    const catOutflow = sum(Object.entries(byCategory).filter(([k]) => groupOf(k) !== 'income').map(([, v]) => v));
    if (catOutflow !== spend + committed) throw new Error(`Category subtotals ${catOutflow} != spend+committed ${spend + committed} for ${c.key}`);
    const surplus = income - spend - committed;
    return { key: c.key, complete: c.complete, from: c.from, to: c.to, income, spend, committed, surplus, savingsRatePct: pct(surplus, income), byCategory, nonSpendExcluded: excluded };
  });
}

// ---------- recurring & subscriptions ----------
export interface Recurring { merchant: string; category: string; amount: Paise; cadence: 'monthly' | 'yearly' | 'once'; count: number; lastDate: string; nextExpected: string | null; annualCost: Paise; account: string; ids: string[] }

export function recurring(ds: Dataset): Recurring[] {
  const debits = ds.txns.filter((t) => t.dir === 'debit');
  const byKey = new Map<string, Txn[]>();
  for (const t of debits) {
    const g = groupOf(t.category ?? 'Other');
    if (g === 'non_spend') continue;
    const key = `${t.merchant}|${t.category}`;
    byKey.set(key, [...(byKey.get(key) ?? []), t]);
  }
  const out: Recurring[] = [];
  for (const [, list] of byKey) {
    const cat = list[0].category ?? 'Other';
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    // Collapse same-day duplicates for cadence detection.
    const days = [...new Set(sorted.map((t) => t.date))];
    const amounts = sorted.map((t) => t.amount);
    const typical = median(amounts);
    const stable = amounts.every((a) => Math.abs(a - typical) <= typical * 0.1);
    const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d));
    const monthly = days.length >= 2 && gaps.every((g) => g >= 25 && g <= 35) && stable;
    const isSubLike = cat === 'Subscriptions' || cat === 'Fitness';
    if (!monthly && !(isSubLike)) continue;
    if (!monthly && isSubLike && days.length > 1 && !stable) continue;
    const last = days[days.length - 1];
    const latestAmt = sorted[sorted.length - 1].amount;
    const yearly = !monthly && isSubLike && /annual|yearly|prime/i.test(sorted.map((t) => t.desc).join(' ') + ' ' + noticeText(ds, sorted[0].merchant ?? ''));
    const cadence: Recurring['cadence'] = monthly ? 'monthly' : yearly ? 'yearly' : 'once';
    out.push({
      merchant: sorted[0].merchant ?? sorted[0].desc, category: cat, amount: latestAmt, cadence, count: days.length, lastDate: last,
      nextExpected: cadence === 'monthly' ? addMonths(last, 1) : cadence === 'yearly' ? addMonths(last, 12) : null,
      annualCost: cadence === 'monthly' ? latestAmt * 12 : latestAmt, account: sorted[0].account, ids: sorted.map((t) => t.id),
    });
  }
  return out.sort((a, b) => b.annualCost - a.annualCost);
}
function noticeText(ds: Dataset, merchant: string) {
  return ds.notices.filter((n) => merchant && n.text.toLowerCase().includes(merchant.toLowerCase().split(' ')[0])).map((n) => n.subject + ' ' + n.text).join(' ');
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

export interface Duplicate { merchant: string; date: string; amount: Paise; count: number; extra: Paise; account: string; ids: string[] }

export function duplicates(ds: Dataset): Duplicate[] {
  const watch = new Set(['Subscriptions', 'Fitness', 'Utilities', 'Mobile & internet', 'Insurance', 'Loan EMI', 'Electronics', 'Travel', 'Shopping', 'Rent']);
  const m = new Map<string, Txn[]>();
  for (const t of ds.txns) {
    if (t.dir !== 'debit' || !watch.has(t.category ?? '')) continue;
    const k = `${t.account}|${t.date}|${t.merchant}|${t.amount}`;
    m.set(k, [...(m.get(k) ?? []), t]);
  }
  return [...m.values()].filter((l) => l.length > 1).map((l) => ({ merchant: l[0].merchant ?? l[0].desc, date: l[0].date, amount: l[0].amount, count: l.length, extra: l[0].amount * (l.length - 1), account: l[0].account, ids: l.map((t) => t.id) }));
}

export interface Leak { kind: 'subscription' | 'duplicate' | 'fee' | 'price_rise' | 'trial_charge' | 'inactive'; title: string; titleHi: string; annualCost: Paise; amount: Paise; merchant: string; evidence: string[]; actionHint: string; deadline?: string }

export function leaks(ds: Dataset): Leak[] {
  const out: Leak[] = [];
  const asOf = asOfDate(ds);
  const rec = recurring(ds).filter((r) => r.category === 'Subscriptions' || r.category === 'Fitness');
  for (const n of ds.notices) {
    const merchant = String(n.data.merchant ?? '');
    if (n.kind === 'trial_charge') out.push({ kind: 'trial_charge', title: `${merchant} free trial turned into a paid plan`, titleHi: `${merchant} का फ़्री ट्रायल पेड प्लान बन गया`, amount: Number(n.data.amount), annualCost: Number(n.data.amount), merchant, evidence: [n.file], actionHint: 'cancel_and_refund', deadline: n.data.refundBy ? String(n.data.refundBy) : undefined });
    if (n.kind === 'inactivity') {
      const r = rec.find((x) => x.merchant.toLowerCase() === merchant.toLowerCase());
      out.push({ kind: 'inactive', title: `${merchant} membership unused since ${n.data.lastUsed ? spokenDate(String(n.data.lastUsed)) : 'a while'}`, titleHi: `${merchant} की मेंबरशिप ${n.data.lastUsed ? `${spokenDate(String(n.data.lastUsed), 'hi')} से` : 'काफ़ी समय से'} इस्तेमाल नहीं हुई`, amount: r?.amount ?? Number(n.data.amount ?? 0), annualCost: r?.annualCost ?? Number(n.data.amount ?? 0) * 12, merchant, evidence: [n.file, ...(r ? [`${r.count} charges in statements`] : [])], actionHint: 'cancel' });
    }
    if (n.kind === 'price_change') {
      const oldP = Number(n.data.oldPrice), newP = Number(n.data.newPrice);
      out.push({ kind: 'price_rise', title: `${merchant} price rises from ₹${oldP / 100} to ₹${newP / 100} on ${n.data.effective ? spokenDate(String(n.data.effective)) : 'the next bill'}`, titleHi: `${merchant} का दाम ${n.data.effective ? `${spokenDate(String(n.data.effective), 'hi')} से` : 'अगले बिल से'} ₹${oldP / 100} से ₹${newP / 100} हो रहा है`, amount: newP - oldP, annualCost: (newP - oldP) * 12, merchant, evidence: [n.file], actionHint: 'review_plan', deadline: String(n.data.effective) });
    }
  }
  for (const d of duplicates(ds)) out.push({ kind: 'duplicate', title: `${d.merchant} charged ${d.count} times on ${spokenDate(d.date)}`, titleHi: `${d.merchant} ने ${spokenDate(d.date, 'hi')} को ${d.count} बार पैसे काटे`, amount: d.extra, annualCost: d.extra, merchant: d.merchant, evidence: d.ids, actionHint: 'dispute' });
  const fees = ds.txns.filter((t) => t.category === 'Fees & charges' && t.dir === 'debit');
  if (fees.length) {
    const total = sum(fees.map((t) => t.amount));
    const months = Math.max(1, coverage(ds).length);
    // Annualise each fee by its own cadence: an annual fee counts once, a quarterly charge four times.
    const annual = sum(fees.map((t) => (/annual|yearly/i.test(t.desc) ? t.amount : /qtr|quarter/i.test(t.desc) ? t.amount * 4 : Math.round((t.amount * 12) / months))));
    out.push({ kind: 'fee', title: `Bank and card charges: ${fees.length} in ${months} months`, titleHi: `बैंक और कार्ड चार्ज: ${months} महीनों में ${fees.length}`, amount: total, annualCost: annual, merchant: 'Bank charges', evidence: fees.map((t) => `${t.date} ${t.desc}`), actionHint: 'ask_waiver' });
  }
  // All active subscriptions, so "what am I subscribed to" has a complete answer.
  for (const r of rec) {
    if (out.some((l) => l.merchant.toLowerCase() === r.merchant.toLowerCase() && l.kind !== 'duplicate' && l.kind !== 'price_rise')) continue;
    if (r.cadence === 'once' && daysBetween(r.lastDate, asOf) > 60) continue;
    out.push({ kind: 'subscription', title: `${r.merchant} (${r.cadence})`, titleHi: `${r.merchant} (${({ monthly: 'मासिक', yearly: 'सालाना', once: 'एक बार' } as Record<string, string>)[r.cadence] ?? r.cadence})`, amount: r.amount, annualCost: r.annualCost, merchant: r.merchant, evidence: r.ids.slice(-3), actionHint: 'review' });
  }
  // Most money first; anything with a deadline in the next 14 days counts double.
  const score = (l: Leak) => l.annualCost * (l.deadline && daysBetween(asOf, l.deadline) <= 14 && daysBetween(asOf, l.deadline) >= 0 ? 2 : 1);
  return out.sort((a, b) => (a.kind === 'subscription' ? 1 : 0) - (b.kind === 'subscription' ? 1 : 0) || score(b) - score(a));
}

// ---------- unusual spending ----------
export interface Unusual { kind: 'category_spike' | 'large_txn' | 'new_merchant'; title: string; titleHi: string; amount: Paise; baseline?: Paise; changePct?: number; category: string; month?: string; date?: string; merchant?: string }

export function unusual(ds: Dataset): Unusual[] {
  const pics = monthPictures(ds).filter((p) => p.complete);
  const out: Unusual[] = [];
  if (pics.length >= 2) {
    const cur = pics[pics.length - 1]; const prev = pics.slice(0, -1);
    for (const [cat, v] of Object.entries(cur.byCategory)) {
      if (groupOf(cat) !== 'spend') continue;
      const base = Math.round(sum(prev.map((p) => p.byCategory[cat] ?? 0)) / prev.length);
      const delta = v - base;
      if (base > 0 && delta >= 200000 && v >= base * 1.4) out.push({ kind: 'category_spike', title: `${cat} up ${pct(delta, base)}% in ${monthLabel(cur.key)} vs the earlier average`, titleHi: `${monthName(cur.key, 'hi')} में ${categoryHi(cat)} पर खर्च पहले के औसत से ${pct(delta, base)}% ज़्यादा`, amount: v, baseline: base, changePct: pct(delta, base), category: cat, month: cur.key });
      if (base === 0 && v >= 500000) out.push({ kind: 'category_spike', title: `New spending on ${cat} in ${monthLabel(cur.key)}`, titleHi: `${monthName(cur.key, 'hi')} में ${categoryHi(cat)} पर नया खर्च`, amount: v, baseline: 0, category: cat, month: cur.key });
    }
  }
  const asOf = asOfDate(ds);
  const recentFrom = addDays(asOf, -60);
  const recIds = new Set(recurring(ds).filter((r) => r.cadence === 'monthly').flatMap((r) => r.ids));
  for (const t of ds.txns) {
    if (t.dir !== 'debit' || t.date < recentFrom || recIds.has(t.id)) continue;
    if (groupOf(t.category ?? 'Other') !== 'spend' || t.category === 'Rent') continue;
    if (t.amount >= 500000) out.push({ kind: 'large_txn', title: `${t.merchant} ₹${groupIndian(Math.round(t.amount / 100))} on ${spokenDate(t.date)}`, titleHi: `${spokenDate(t.date, 'hi')} को ${t.merchant} ₹${groupIndian(Math.round(t.amount / 100))}`, amount: t.amount, category: t.category ?? 'Other', date: t.date, merchant: t.merchant });
  }
  // A subscription-type merchant seen for the first time in the last 30 days.
  const first = new Map<string, string>();
  for (const t of [...ds.txns].sort((a, b) => a.date.localeCompare(b.date))) if (t.dir === 'debit' && !first.has(t.merchant ?? '')) first.set(t.merchant ?? '', t.date);
  for (const t of ds.txns) {
    if (t.dir === 'debit' && t.category === 'Subscriptions' && first.get(t.merchant ?? '') === t.date && daysBetween(t.date, asOf) <= 30 && !out.some((u) => u.merchant === t.merchant))
      out.push({ kind: 'new_merchant', title: `New subscription charge: ${t.merchant}`, titleHi: `नया सब्सक्रिप्शन चार्ज: ${t.merchant}`, amount: t.amount, category: 'Subscriptions', date: t.date, merchant: t.merchant });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

// ---------- upcoming dues ----------
export interface Due { date: string; title: string; titleHi: string; amount: Paise; kind: 'emi' | 'card' | 'premium' | 'subscription' | 'bill'; source: string; fromBank: boolean; note?: string }

export function upcoming(ds: Dataset, days = 21): Due[] {
  const asOf = asOfDate(ds); const until = addDays(asOf, days);
  const out: Due[] = [];
  for (const l of ds.loans) {
    const st = loanStatus(l, asOf);
    if (st.nextEmiDate && st.nextEmiDate > asOf && st.nextEmiDate <= until) out.push({ date: st.nextEmiDate, title: `${l.lender} EMI`, titleHi: `${l.lender} की EMI`, amount: l.emi, kind: 'emi', source: l.file, fromBank: true });
    // EMI dates that fall within the window but were already debited (asOf on the EMI date) are skipped by the > asOf check.
  }
  for (const s of ds.cardStatements) {
    if (s.dueDate < asOf || s.dueDate > until) continue;
    const paid = ds.txns.some((t) => t.category === 'Card bill payment' && t.dir === 'debit' && t.date > s.periodEnd && t.date <= s.dueDate && t.amount >= s.minDue);
    if (!paid) out.push({ date: s.dueDate, title: 'Credit card bill', titleHi: 'क्रेडिट कार्ड बिल', amount: s.totalDue, kind: 'card', source: s.file, fromBank: true, note: `minimum due ₹${Math.round(s.minDue / 100)}` });
  }
  for (const p of ds.policies) {
    const d = nextDueDate(p, asOf);
    if (d && d > asOf && d <= until) out.push({ date: d, title: `${p.insurer} premium (${p.kind})`, titleHi: `${p.insurer} प्रीमियम`, amount: p.premium, kind: 'premium', source: p.file, fromBank: true });
  }
  const loanMerchants = new Set(['Kestrel Auto Finance', 'Orbit Finserv']);
  for (const r of recurring(ds)) {
    if (!r.nextExpected || r.nextExpected <= asOf || r.nextExpected > until) continue;
    if (r.category === 'Loan EMI' || r.category === 'Insurance' || r.category === 'Cash withdrawal' || loanMerchants.has(r.merchant)) continue; // EMIs/premiums come from documents
    if (ds.policies.some((p) => r.merchant.toLowerCase().includes(p.insurer.toLowerCase().split(' ')[0]))) continue;
    const price = ds.notices.find((n) => n.kind === 'price_change' && String(n.data.merchant).toLowerCase() === r.merchant.toLowerCase() && String(n.data.effective) <= r.nextExpected!);
    const amount = price ? Number(price.data.newPrice) : r.amount;
    const kind: Due['kind'] = r.category === 'Subscriptions' || r.category === 'Fitness' ? 'subscription' : 'bill';
    const title = r.merchant === 'Person-to-person' ? r.category : kind === 'bill' && r.category !== r.merchant ? `${r.category}: ${r.merchant}` : r.merchant;
    const titleHi = r.merchant === 'Person-to-person' ? categoryHi(r.category) : kind === 'bill' && r.category !== r.merchant ? `${categoryHi(r.category)}: ${r.merchant}` : r.merchant;
    out.push({ date: r.nextExpected, title, titleHi, amount, kind, source: 'recurring pattern in statements', fromBank: r.account.startsWith('bank:'), note: price ? `new price from ${price.data.effective}` : undefined });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- balances, cash flow, emergency fund ----------
export function latestBankBalance(ds: Dataset): { balance: Paise; date: string } | null {
  const withBal = ds.txns.filter((t) => t.account.startsWith('bank:') && t.balance !== undefined).sort((a, b) => a.date.localeCompare(b.date));
  const last = withBal.at(-1);
  if (last) return { balance: last.balance!, date: last.date };
  const acct = ds.accounts.find((a) => a.kind === 'bank' && a.closing !== undefined);
  return acct ? { balance: acct.closing!, date: acct.closingDate ?? '' } : null;
}

export function nextSalaryDate(ds: Dataset): string | null {
  const sal = ds.txns.filter((t) => t.category === 'Salary').map((t) => t.date).sort();
  return sal.length ? addMonths(sal[sal.length - 1], 1) : null;
}

export function cashflowCheck(ds: Dataset) {
  const bal = latestBankBalance(ds);
  const asOf = asOfDate(ds);
  const salary = nextSalaryDate(ds);
  const horizon = salary ? Math.max(1, daysBetween(asOf, salary)) : 21;
  const dues = upcoming(ds, horizon).filter((d) => d.fromBank && (!salary || d.date < salary));
  const duesTotal = sum(dues.map((d) => d.amount));
  return { balance: bal?.balance ?? null, balanceDate: bal?.date ?? null, nextSalary: salary, dues, duesTotal, balanceAfterDues: bal ? bal.balance - duesTotal : null, note: 'Day-to-day spending (food, cabs, groceries) is not included in the dues.' };
}

export function emergencyFund(ds: Dataset) {
  const bal = latestBankBalance(ds);
  const pics = monthPictures(ds).filter((p) => p.complete);
  const monthly = pics.length ? Math.round(sum(pics.map((p) => p.spend + p.committed)) / pics.length) : 0;
  const months = bal && monthly ? Math.round((bal.balance / monthly) * 10) / 10 : null;
  return { liquid: bal?.balance ?? null, monthlyOutflow: monthly, months, basis: `latest balance of uploaded bank account(s) ÷ average monthly spend + committed outflows over ${pics.length} complete month(s)`, otherAccountsSeen: ds.txns.some((t) => t.category === 'Self transfer') };
}

// ---------- credit ----------
export function creditView(ds: Dataset) {
  const c = ds.credit;
  if (!c) return null;
  const card = ds.accounts.find((a) => a.kind === 'card');
  const lastStmt = [...ds.cardStatements].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd)).at(-1);
  const limit = lastStmt?.limit ?? card?.limit;
  const utilLatest = lastStmt && limit ? pct(lastStmt.totalDue, limit) : null;
  const asOf = asOfDate(ds);
  const recentEnq = c.enquiries.filter((e) => daysBetween(e.date, asOf) <= 90);
  return {
    score: c.score, asOf: c.asOf, previousScore: c.previousScore ?? null, change: c.previousScore ? c.score - c.previousScore : null,
    utilisationReported: c.utilisationPct ?? null, utilisationPrevious: c.previousUtilisationPct ?? null,
    utilisationLatestStatement: utilLatest, latestStatementDate: lastStmt?.periodEnd ?? null,
    enquiriesLast90Days: recentEnq, factors: c.factors,
    latePayments: c.accounts.filter((a) => /\b30|60|90\b/.test(a.dpd) && /past due/i.test(a.dpd)).map((a) => `${a.lender}: ${a.dpd}`),
    steps: [
      'Pay the full card bill before the statement date, not just the due date, so a lower balance is reported.',
      'Avoid new loan or card applications for a few months; each one adds a hard enquiry.',
      'Keep every EMI and card payment on time; one 30-day delay stays on the report for years.',
    ],
  };
}

export const categoryHi = (c: string) => CATEGORIES[c]?.hi ?? c;
export { annualPremium };
