// Deterministic parsers for text documents (PDF text, .txt, .eml, SMS dumps).
// Every parser returns structured data plus the checks it could run; nothing here guesses silently.
import type { Account, CardStatement, Check, CreditReport, HealthTerms, Loan, LoanOffer, Notice, Policy, Txn } from '../types';
import { parseMoney } from '../money';
import { findDate, toIso } from '../dates';
import { balanceChecks } from './csv';

const MONEY = String.raw`(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)`;
const DATE = String.raw`(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}[\s-][A-Za-z]{3,9}[\s,-]+\d{2,4})`;
const field = (text: string, label: string, kind: 'money' | 'date' | 'num' | 'text' = 'text'): string | null => {
  const re = new RegExp(`(?:${label})\\s*[:\\-]?\\s*` + (kind === 'money' ? MONEY : kind === 'date' ? DATE : kind === 'num' ? String.raw`([\d.]+)` : '([^\\n]+)'), 'i');
  return text.match(re)?.[1]?.trim() ?? null;
};
const money = (text: string, label: string) => { const v = field(text, label, 'money'); return v ? parseMoney(v) : null; };
const date = (text: string, label: string) => { const v = field(text, label, 'date'); return v ? toIso(v) : null; };
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Emi|Sip|Tpa|Ltd|Pvt)\b/g, (w) => w.toUpperCase());
}
/** "KESTREL AUTO FINANCE LTD (fictional)" -> "Kestrel Auto Finance"; insurers also drop "Insurance". */
export function cleanOrg(s: string, insurer: boolean): string {
  let t = s.replace(/\(fictional\)/i, '').replace(/\b(co|company|ltd|limited|pvt|private)\b\.?/gi, ' ');
  if (insurer) t = t.replace(/\binsurance\b/gi, ' ');
  return titleCase(t.replace(/[.\s]+$/g, '').replace(/\s+/g, ' ').trim());
}
const last4 = (s: string | null) => s?.match(/(\d{4})\b(?!.*\d{4})/)?.[1] ?? '0000';

// ---------- classification ----------
export type DocKind = 'bank_csv' | 'bank_text' | 'card_statement' | 'sms' | 'email' | 'loan' | 'policy' | 'credit_report' | 'json' | 'unknown';

export function classify(name: string, text: string): DocKind {
  const t = text.slice(0, 4000).toLowerCase();
  const n = name.toLowerCase();
  if (n.endsWith('.json')) return 'json';
  if (n.endsWith('.csv') && /(date|txn)/.test(t) && /(balance|withdrawal|debit|amount)/.test(t)) return 'bank_csv';
  if (/^from:.*\n(.*\n)*subject:/im.test(text.slice(0, 2000)) || n.endsWith('.eml')) return 'email';
  const smsLike = (t.match(/(debited|credited|spent on)[^\n]*(a\/c|card)/g)?.length ?? 0);
  if (smsLike >= 3 && smsLike >= (t.match(/\n/g)?.length ?? 0) * 0.3) return 'sms';
  if (/credit (information )?report|credit score|cibil|bureau/.test(t) && /enquir/.test(t)) return 'credit_report';
  if (/credit card/.test(t) && /(total amount due|total amt due|minimum amount due)/.test(t)) return 'card_statement';
  if (/(sanction|loan agreement|key fact statement|loan account)/.test(t) && /(rate of interest|roi|interest rate)/.test(t)) return 'loan';
  if (/(policy schedule|policy number|sum assured|sum insured)/.test(t) && /premium/.test(t)) return 'policy';
  if (/(debited|credited|spent on).*(a\/c|card|acct)/.test(t) && (t.match(/\n/g)?.length ?? 0) >= 2) return 'sms';
  if (/(opening balance|closing balance|statement of account|account statement)/.test(t)) return 'bank_text';
  return 'unknown';
}

// ---------- bank statement text (from a PDF) ----------
/** Lines like "05/07/2026  UPI/SWIGGY/...   450.00   1,23,456.78". Direction comes from the balance delta, which is robust to column order. */
export function bankTextToTxns(text: string, file: string): { txns: Txn[]; account: Account; checks: Check[]; problems: string[] } {
  const acct = last4(field(text, String.raw`a\/c no\.?|account (?:no|number)\.?`));
  const opening = money(text, 'opening balance') ?? undefined;
  const closing = money(text, 'closing balance') ?? undefined;
  const id = `bank:${acct}`;
  const txns: Txn[] = []; const problems: string[] = [];
  let prev = opening;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/^\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}[\s-][A-Za-z]{3}[\s-]\d{2,4})\s+(.+?)\s+((?:[\d,]+\.\d{2}\s*(?:cr|dr)?\s+){1,2}[\d,]+\.\d{2})\s*(cr|dr)?\s*$/i);
    if (!m) return;
    const d = toIso(m[1]); if (!d) return;
    const nums = m[3].trim().split(/\s+/).filter((x) => /[\d]/.test(x)).map((x) => parseMoney(x)!);
    const bal = nums[nums.length - 1]; const amt = nums[nums.length - 2];
    let dir: Txn['dir'];
    if (prev !== undefined) dir = bal - prev === amt ? 'credit' : prev - bal === amt ? 'debit' : /\bcr\b|credit|salary|refund|interest/i.test(m[2]) ? 'credit' : 'debit';
    else dir = /\bcr\b|credit|salary|refund|interest/i.test(m[2]) ? 'credit' : 'debit';
    if (prev !== undefined && Math.abs(bal - prev) !== amt) problems.push(`line ${i + 1}: amount does not explain the balance change`);
    txns.push({ id: `${file}#${i + 1}`, date: d, desc: m[2].trim(), amount: amt, dir, balance: bal, account: id, source: 'bank_statement', sourceFile: file });
    prev = bal;
  });
  return { txns, account: { id, kind: 'bank', label: `Bank account ••${acct}`, last4: acct, opening, closing, closingDate: txns.at(-1)?.date }, checks: balanceChecks(txns, opening, closing, 'Bank statement'), problems };
}

// ---------- credit card statement ----------
export function cardTextToStatement(text: string, file: string): { stmt: CardStatement; txns: Txn[]; account: Account; checks: Check[] } {
  const l4 = text.match(/card (?:number|no)\.?\s*[:\-]?\s*[x*\s\d]*?(\d{4})\b/i)?.[1] ?? '0000';
  const id = `card:${l4}`;
  const period = text.match(new RegExp(`statement period\\s*[:\\-]?\\s*${DATE}\\s*(?:to|-)\\s*${DATE}`, 'i'));
  const periodStart = period ? toIso(period[1])! : '';
  const periodEnd = period ? toIso(period[2])! : date(text, 'statement date') ?? '';
  const stmt: CardStatement = {
    account: id, file, periodStart, periodEnd,
    dueDate: date(text, 'payment due date|due date') ?? '',
    prevBalance: money(text, 'previous balance|opening balance|previous dues') ?? 0,
    payments: money(text, 'payments? received|payments?/credits|payment received') ?? 0,
    purchases: money(text, 'purchases (?:&|and) debits|purchases|total debits') ?? 0,
    credits: money(text, 'other credits|credits') ?? 0,
    charges: money(text, 'finance charges|interest charges') ?? 0,
    totalDue: money(text, 'total amount due|total amt due|total dues') ?? 0,
    minDue: money(text, 'minimum amount due|min amt due|minimum due') ?? 0,
    limit: money(text, 'credit limit') ?? undefined,
  };
  const txns: Txn[] = [];
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(cr)?\s*$/i);
    if (!m) return;
    const d = toIso(m[1]); if (!d) return;
    txns.push({ id: `${file}#${i + 1}`, date: d, desc: m[2].trim(), amount: parseMoney(m[3])!, dir: m[4] ? 'credit' : 'debit', account: id, source: 'card_statement', sourceFile: file });
  });
  const debits = txns.filter((t) => t.dir === 'debit').reduce((s, t) => s + t.amount, 0);
  const pay = txns.filter((t) => t.dir === 'credit' && /payment/i.test(t.desc)).reduce((s, t) => s + t.amount, 0);
  const otherCr = txns.filter((t) => t.dir === 'credit' && !/payment/i.test(t.desc)).reduce((s, t) => s + t.amount, 0);
  const formula = stmt.prevBalance - stmt.payments + stmt.purchases - stmt.credits + stmt.charges;
  const checks: Check[] = [
    { id: 'card_total', label: `Card ${periodEnd}: previous − payments + purchases − credits + charges = total due`, ok: Math.abs(formula - stmt.totalDue) <= 100, detail: `${formula} vs ${stmt.totalDue} (paise)` },
    { id: 'card_lines', label: `Card ${periodEnd}: line items match the summary`, ok: debits === stmt.purchases && pay === stmt.payments && otherCr === stmt.credits, detail: `purchases ${debits}/${stmt.purchases}, payments ${pay}/${stmt.payments}, credits ${otherCr}/${stmt.credits}` },
  ];
  return { stmt, txns, account: { id, kind: 'card', label: `Credit card ••${l4}`, last4: l4, limit: stmt.limit }, checks };
}

// ---------- SMS alerts ----------
export function smsToTxns(text: string, file: string): { txns: Txn[]; notices: Notice[]; skipped: number } {
  const txns: Txn[] = []; const notices: Notice[] = []; let skipped = 0;
  // PDFs wrap long SMS onto several lines: if most lines start with a timestamp, glue the others onto the previous one.
  const rawLines = text.split('\n').filter((l) => l.trim());
  const stamp = /^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|#)/;
  const lines: string[] = [];
  if (rawLines.filter((l) => stamp.test(l)).length >= rawLines.length * 0.5) { for (const l of rawLines) { if (stamp.test(l) || !lines.length) lines.push(l); else lines[lines.length - 1] += ' ' + l.trim(); } }
  else lines.push(...rawLines);
  lines.forEach((raw, i) => {
    const line = raw.trim(); if (!line || line.startsWith('#')) return;
    const parts = line.split(' | ');
    const body = parts.length >= 3 ? parts.slice(2).join(' | ') : line;
    const ts = parts.length >= 3 ? parts[0] : '';
    if (/\botp\b|one time password/i.test(body)) { skipped++; return; }
    let m = body.match(/(?:inr|rs\.?)\s*([\d,]+\.?\d*)\s+(debited|credited)\s+(?:from|to)\s+a\/c\s+\S*?(\d{4})\s+on\s+(\S+)\s+(?:for|by)\s+(.+?)\.\s*avl bal\s*(?:inr|rs\.?)\s*([\d,]+\.?\d*)/i);
    if (m) {
      txns.push({ id: `${file}#${i + 1}`, date: toIso(m[4]) ?? ts.slice(0, 10), desc: m[5].trim(), amount: parseMoney(m[1])!, dir: /credit/i.test(m[2]) ? 'credit' : 'debit', balance: parseMoney(m[6])!, account: `bank:${m[3]}`, source: 'sms', sourceFile: file });
      return;
    }
    m = body.match(/(?:inr|rs\.?)\s*([\d,]+\.?\d*)\s+spent on .*?card\s+\S*?(\d{4})\s+at\s+(.+?)\s+on\s+(\S+?)\.?\s/i);
    if (m) {
      txns.push({ id: `${file}#${i + 1}`, date: toIso(m[4].replace(/\.$/, '')) ?? ts.slice(0, 10), desc: m[3].trim(), amount: parseMoney(m[1])!, dir: 'debit', account: `card:${m[2]}`, source: 'sms', sourceFile: file });
      return;
    }
    if (/\bemi\b/i.test(body) && /due/i.test(body)) {
      notices.push({ id: `${file}#${i + 1}`, date: ts.slice(0, 10), from: parts[1] ?? 'SMS', subject: 'EMI due', kind: 'emi_due', text: body, file, data: { amount: parseMoney(body.match(new RegExp(`emi of ${MONEY}`, 'i'))?.[1] ?? '') ?? 0, due: findDate(body.split(/due on/i)[1] ?? '') ?? '' } });
      return;
    }
    if (/statement .*generated|total amt due/i.test(body)) {
      notices.push({ id: `${file}#${i + 1}`, date: ts.slice(0, 10), from: parts[1] ?? 'SMS', subject: 'Card statement', kind: 'statement', text: body, file, data: { total: parseMoney(body.match(new RegExp(`total amt due ${MONEY}`, 'i'))?.[1] ?? '') ?? 0, due: findDate(body.split(/due date/i)[1] ?? '') ?? '' } });
      return;
    }
    skipped++;
  });
  return { txns, notices, skipped };
}

// ---------- emails ----------
export function emailToNotice(text: string, file: string): Notice {
  const head = text.split(/\n\s*\n/)[0];
  const body = text.slice(head.length).trim();
  const from = head.match(/^from:\s*(.+)$/im)?.[1]?.trim() ?? '';
  const subject = head.match(/^subject:\s*(.+)$/im)?.[1]?.trim() ?? '';
  const dateHdr = head.match(/^date:\s*(.+)$/im)?.[1] ?? '';
  const d = (() => { const p = Date.parse(dateHdr); return Number.isFinite(p) ? new Date(p + 5.5 * 3600e3).toISOString().slice(0, 10) : findDate(dateHdr) ?? ''; })();
  const all = `${subject}\n${body}`;
  const merchant = (from.split('<')[0].replace(/["']/g, '').trim().split(/\s+(?:offers|team|billing)\b/i)[0]) || from;
  const n: Notice = { id: file, date: d, from, subject, kind: 'other', text: all, file, data: { merchant } };
  const amounts = [...all.matchAll(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi)].map((m) => parseMoney(m[1])!);
  if (/price|changing from|will change from/i.test(all) && amounts.length >= 2) {
    n.kind = 'price_change'; n.data.oldPrice = amounts[0]; n.data.newPrice = amounts[1];
    n.data.effective = findDate(all.split(/starting from|from your next billing date|effective/i)[1] ?? '') ?? '';
  } else if (/free trial (has )?ended|trial .*charged|have charged/i.test(all)) {
    n.kind = 'trial_charge'; n.data.amount = amounts[0] ?? 0;
    n.data.refundBy = findDate(all.match(/\(by ([^)]+)\)/i)?.[1] ?? all.split(/cancel within/i)[1] ?? '') ?? '';
    n.data.contact = all.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] ?? '';
  } else if (/not booked|haven'?t (used|booked)|miss you|inactive/i.test(all)) {
    n.kind = 'inactivity'; n.data.amount = amounts[0] ?? 0; n.data.lastUsed = findDate(all.split(/since/i)[1] ?? '') ?? '';
  } else if (/pre-?approved|offer valid|interest rate/i.test(all) && /loan/i.test(all)) {
    n.kind = 'offer';
  } else if (/\bemi\b/i.test(all) && /(debited on|due on|reminder)/i.test(all)) {
    n.kind = 'emi_due'; n.data.amount = amounts[0] ?? 0; n.data.due = findDate(all.split(/debited on|due on/i)[1] ?? '') ?? '';
  } else if (/premium .*due|renewal|due on/i.test(all)) {
    n.kind = 'renewal'; n.data.amount = amounts[0] ?? 0; n.data.due = findDate(all.split(/due on/i)[1] ?? '') ?? '';
  }
  return n;
}

export function offerFromNotice(n: Notice): LoanOffer | null {
  if (n.kind !== 'offer') return null;
  const rate = Number(n.text.match(/interest rate[:\s]*([\d.]+)%/i)?.[1] ?? n.text.match(/at ([\d.]+)% p\.?a/i)?.[1] ?? NaN);
  if (!Number.isFinite(rate)) return null;
  return {
    lender: String(n.data.merchant).trim(),
    ratePct: rate,
    maxAmount: money(n.text, 'loan amount[:\\s]*up to') ?? undefined,
    maxTenureMonths: Number(n.text.match(/tenure[:\s]*up to (\d+) months/i)?.[1] ?? 0) || undefined,
    processingFeePct: Number(n.text.match(/processing fee[:\s]*([\d.]+)%/i)?.[1] ?? 0),
    gstOnFee: /\+\s*gst/i.test(n.text),
    validTill: date(n.text, 'valid till|valid until') ?? undefined,
    file: n.file,
  };
}

// ---------- loan documents ----------
export function loanFromText(text: string, file: string): { loan: Loan | null; missing: string[] } {
  const lender = cleanOrg(text.split('\n').map((l) => l.trim()).find(Boolean) ?? 'Lender', false);
  const principal = money(text, 'sanctioned loan amount|loan amount|principal amount|sanctioned amount');
  const rate = Number(field(text, 'rate of interest|interest rate|roi', 'num'));
  const tenure = Number(text.match(/tenure\s*[:\-]?\s*(\d+)\s*months/i)?.[1] ?? NaN);
  const emi = money(text, 'emi amount|monthly instalment|emi');
  const first = date(text, 'first emi date|emi start date|first instalment date');
  const missing = Object.entries({ principal, rate: Number.isFinite(rate) ? rate : null, tenure: Number.isFinite(tenure) ? tenure : null, emi, first }).filter(([, v]) => v === null).map(([k]) => k);
  if (missing.length) return { loan: null, missing };
  const t = text.toLowerCase();
  const type: Loan['type'] = /car loan|auto loan|vehicle/.test(t) ? 'car' : /personal loan/.test(t) ? 'personal' : /home loan|housing/.test(t) ? 'home' : /education/.test(t) ? 'education' : 'other';
  const clause = (word: string) => {
    const line = text.split('\n').find((l) => new RegExp(word, 'i').test(l) && /permitted|allowed|charges/i.test(l)) ?? '';
    return {
      allowedAfterEmis: Number(line.match(/after (\d+) emis?/i)?.[1] ?? 0),
      chargePct: /nil/i.test(line) ? 0 : Number(line.match(/([\d.]+)%/)?.[1] ?? 0),
      gst: /\+\s*gst/i.test(line),
    };
  };
  const acct = last4(field(text, 'loan account number|loan a\\/c|account number'));
  return {
    loan: { id: `loan:${acct}`, lender, type, last4: acct, principal: principal!, ratePct: rate, tenureMonths: tenure, emi: emi!, firstEmiDate: first!, emiDay: Number(first!.slice(8)), prepay: clause('part-?prepayment'), foreclose: clause('foreclosure'), file },
    missing: [],
  };
}

// ---------- policies ----------
export function policyFromText(text: string, file: string): { policy: Policy | null; missing: string[] } {
  const lines = text.split('\n').map((l) => l.trim());
  const insurer = cleanOrg(lines.find(Boolean) ?? 'Insurer', true);
  const name = titleCase((lines[1] ?? '').replace(/^policy schedule\s*[-:]\s*/i, '').replace(/\s*\(.*\)$/, ''));
  const t = text.toLowerCase();
  const kind: Policy['kind'] = /term (insurance|plan)/.test(t) ? 'term' : /health|sum insured|hospital/.test(t) ? 'health' : /endowment|money back|jeevan/.test(t) ? 'endowment' : /ulip|unit linked/.test(t) ? 'ulip' : 'other';
  const sum = money(text, 'sum assured|sum insured|life cover');
  const monthly = money(text, 'monthly premium');
  const yearly = money(text, 'annual premium|yearly premium|premium amount|premium');
  const premium = monthly ?? yearly;
  const freq: Policy['premiumFreq'] = monthly || /frequency:\s*monthly/i.test(text) ? 'monthly' : /quarterly/i.test(text) ? 'quarterly' : 'yearly';
  const missing = Object.entries({ sum, premium }).filter(([, v]) => v === null).map(([k]) => k);
  if (missing.length) return { policy: null, missing };
  const acct = last4(field(text, 'policy number|policy no'));
  const p: Policy = {
    id: `policy:${acct}`, insurer, kind, name, last4: acct, sumAssured: sum!, premium: premium!, premiumFreq: freq,
    startDate: date(text, 'first policy start date|policy start date|date of commencement|start date') ?? undefined,
    nextDue: date(text, 'next premium due date|next due date|renewal date|due date') ?? undefined,
    termYears: Number(text.match(/policy term\s*[:\-]?\s*(\d+)\s*years/i)?.[1] ?? 0) || undefined,
    nominee: field(text, 'nominee') ?? undefined, file,
  };
  const ill = [...text.matchAll(/(?:at|of)\s*(?:assumed investment return of\s*)?([\d.]+)%\s*p\.?a\.?\s*[:\-]?\s*(?:rs\.?|inr|₹)\s*([\d,]+)/gi)].map((m) => ({ ratePct: Number(m[1]), value: parseMoney(m[2])! }));
  if (ill.length) p.illustrations = ill;
  if (kind === 'health') p.health = healthTerms(text);
  return { policy: p, missing: [] };
}

function healthTerms(text: string): HealthTerms {
  const membersLine = field(text, 'insured members|members covered|insured persons') ?? '';
  const members = [...membersLine.matchAll(/(self|mother|father|spouse|wife|husband|son|daughter)\s*\(age\s*(\d+)\)/gi)].map((m) => ({ relation: m[1].toLowerCase().replace(/wife|husband/, 'spouse'), age: Number(m[2]) }));
  const spec = text.match(/specified illness[^\n]*?waiting period:?\s*(\d+)\s*months[^\n]*?-\s*([^\n]+)/i);
  const ped = text.match(/pre-?existing[^\n]*?waiting period:?\s*(\d+)\s*months[^\n]*/i);
  const docs = text.match(/^Documents:\s*([^\n]+)/im)?.[1] ?? '';
  return {
    members,
    roomRentPctPerDay: Number(text.match(/room rent:?\s*up to\s*([\d.]+)%/i)?.[1] ?? 0) || undefined,
    icuPctPerDay: Number(text.match(/icu:?\s*up to\s*([\d.]+)%/i)?.[1] ?? 0) || undefined,
    copayPct: Number(text.match(/co-?payment:?\s*([\d.]+)%/i)?.[1] ?? 0) || undefined,
    copayAgeAbove: Number(text.match(/aged above\s*(\d+)/i)?.[1] ?? NaN) || undefined,
    initialWaitingDays: Number(text.match(/initial waiting period:?\s*(\d+)\s*days/i)?.[1] ?? 0) || undefined,
    specificWaitingMonths: spec ? Number(spec[1]) : undefined,
    specificIllnesses: spec ? spec[2].replace(/\.$/, '').split(/,\s*/).map((s) => s.trim().toLowerCase()) : [],
    pedWaitingMonths: ped ? Number(ped[1]) : undefined,
    pedDeclared: ped?.[0].match(/declared:\s*([^)]+)/i)?.[1],
    intimationPlannedHours: Number(text.match(/planned hospitali[sz]ation at least\s*(\d+)\s*hours/i)?.[1] ?? 0) || undefined,
    intimationEmergencyHours: Number(text.match(/emergency hospitali[sz]ation within\s*(\d+)\s*hours/i)?.[1] ?? 0) || undefined,
    reimbursementDays: Number(text.match(/within\s*(\d+)\s*days of discharge/i)?.[1] ?? 0) || undefined,
    tpa: text.match(/^TPA:\s*([^,\n]+)/im)?.[1]?.replace(/\(fictional\)/i, '').trim(),
    helpline: text.match(/helpline\s*([\d-]{10,})/i)?.[1],
    claimsEmail: text.match(/claims@[\w.-]+/i)?.[0],
    documents: docs.split(/,\s*/).map((d) => d.replace(/\.$/, '').trim()).filter(Boolean),
    firstStartDate: date(text, 'first policy start date|policy start date') ?? undefined,
  };
}

// ---------- credit report ----------
export function creditFromText(text: string, file: string): CreditReport | null {
  const score = Number(text.match(/credit score:?\s*(\d{3})/i)?.[1] ?? NaN);
  if (!Number.isFinite(score)) return null;
  const prev = text.match(/previous score:?\s*(\d{3})\s*(?:as on\s*)?(\S+)?/i);
  const accounts = text.split('\n').filter((l) => /\|/.test(l) && /(loan|card)/i.test(l) && /balance/i.test(l)).map((l) => {
    const c = l.split('|').map((x) => x.trim());
    return {
      type: c[0].replace(/^\d+\.\s*/, ''), lender: c[1] ?? '',
      amount: parseMoney(l.match(/(?:sanctioned|credit limit)\s*([\d,]+)/i)?.[1] ?? '') ?? undefined,
      balance: parseMoney(l.match(/current balance\s*([\d,]+)/i)?.[1] ?? '') ?? undefined,
      status: l.match(/status:\s*([^|]+)/i)?.[1]?.trim() ?? '',
      dpd: l.match(/dpd[^:]*:\s*([^|]+)/i)?.[1]?.trim() ?? '',
    };
  });
  const enquiries = text.split('\n').map((l) => l.match(new RegExp(`^\\s*${DATE}\\s*\\|\\s*([^|]+)\\|\\s*(.+)$`))).filter(Boolean).map((m) => ({ date: toIso(m![1])!, lender: m![2].trim(), purpose: m![3].trim() }));
  const util = text.match(/utili[sz]ation[^:]*:\s*([\d.]+)%\s*(?:\(previous report:\s*([\d.]+)%\))?/i);
  const factors = text.split(/key factors[^\n]*\n/i)[1]?.split('\n').filter((l) => l.trim().startsWith('-')).map((l) => l.replace(/^\s*-\s*/, '').trim()) ?? [];
  return {
    bureau: (text.split('\n')[0] ?? '').split(' - ')[0].replace(/\(fictional\)/i, '').trim(), score, asOf: date(text, 'report date') ?? '',
    previousScore: prev ? Number(prev[1]) : undefined, previousAsOf: prev?.[2] ? toIso(prev[2]) ?? undefined : undefined,
    utilisationPct: util ? Number(util[1]) : undefined, previousUtilisationPct: util?.[2] ? Number(util[2]) : undefined,
    accounts, enquiries, factors, file,
  };
}
