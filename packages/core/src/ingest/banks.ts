// Statement readers for the banks Munim supports first (D-036, D-048): HDFC, SBI, Canara and Federal Bank savings accounts; HDFC and Axis credit cards.
// Input: text lines rebuilt by position (pdfLines). Output: transactions plus checks against the statement's OWN totals;
// a reader only "passes" when every check reconciles to the paisa. Pure TS: runs on the phone, the PDF never leaves it.
// Only the last 4 digits of an account or card number are kept.
import type { Account, CardStatement, Check, Paise, Txn } from '../types';

export type BankFormat = 'hdfc_savings' | 'sbi_savings' | 'canara_savings' | 'federal_savings' | 'hdfc_card' | 'axis_card';
export interface BankRead { format: BankFormat; account: Account; txns: Txn[]; checks: Check[]; stmt?: CardStatement; period?: { from: string; to: string } }

const AMT = /[\d,]+\.\d{2}/;
const paise = (s: string): Paise => Math.round(Number(s.replace(/[^\d.]/g, '')) * 100);
const yy = (d: string) => { const [dd, mm, y] = d.split(/[/-]/); return `${y.length === 2 ? '20' + y : y}-${mm}-${dd}`; };
const MON: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
const longDate = (s: string) => { const m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})/.exec(s); return m ? `${m[3]}-${MON[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}` : ''; };
const last4 = (s: string | undefined) => (s ? s.replace(/\D/g, '').slice(-4) : '');
const check = (id: string, label: string, ok: boolean, detail: string): Check => ({ id, label, ok, detail });
const rupees = (p: Paise) => (p / 100).toFixed(2);

export function detectFormat(lines: string[]): BankFormat | null {
  const t = lines.slice(0, 120).join('\n');
  if (/Credit Card Statement/i.test(t) && /TOTAL AMOUNT DUE/i.test(t) && /\d{2}\/\d{2}\/\d{4}\|\s*\d{2}:\d{2}/.test(lines.join('\n'))) return 'hdfc_card';
  if (/Withdrawal Amt\.?\s+Deposit Amt\.?\s+Closing Balance/i.test(t)) return 'hdfc_savings';
  if (/^Date\s+Particulars\s+Deposits\s+Withdrawals\s+Balance$/im.test(t) && /^Opening Balance\s+-?[\d,]+\.\d{2}$/im.test(t) && /^Chq:/m.test(t)) return 'canara_savings';
  if (/^Axis Bank\b.*Card.*Statement/im.test(t) && /Transaction Summary/i.test(t) && /Debit\/Credit/i.test(t)) return 'axis_card';
  if (/^Date\s+Value Date\s+Particulars\s+Tran Type\s+Cheque Details\s+Withdrawals\s+Deposits\s+Balance\s+Dr\/Cr$/im.test(t) && /GRAND TOTAL/i.test(lines.join('\n'))) return 'federal_savings';
  if (/STATEMENT OF ACCOUNT/i.test(t) && /\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4}\s/.test(lines.join('\n')) && /Statement Summary/i.test(lines.join('\n'))) return 'sbi_savings';
  return null;
}

export function readBank(lines: string[], file: string): BankRead | null {
  const f = detectFormat(lines);
  const r = f === 'hdfc_savings' ? hdfcSavings(lines, file) : f === 'sbi_savings' ? sbiSavings(lines, file) : f === 'canara_savings' ? canaraSavings(lines, file) : f === 'federal_savings' ? federalSavings(lines, file)
    : f === 'hdfc_card' ? hdfcCard(lines, file) : f === 'axis_card' ? axisCard(lines, file) : null;
  // Axis prints no statement period (its "period" is the rows' own first and last dates), so only the date itself is checked
  if (r) r.checks.push(...dateChecks(r.txns, r.format === 'axis_card' ? undefined : r.period, r.account.kind === 'bank' ? 'bank' : 'card'));
  return r;
}

const realDate = (d: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false; const t = new Date(d + 'T00:00:00Z'); return !isNaN(+t) && t.toISOString().slice(0, 10) === d; };
const shift = (d: string, days: number) => new Date(Date.parse(d + 'T00:00:00Z') + days * 864e5).toISOString().slice(0, 10);
/** How far a genuine row can sit outside the printed period, in days, from real statements (D-053): a bank statement can
 *  carry a row dated a day or two after "To"; a card statement lists a purchase by the day it was made, which can be weeks
 *  before the billing period it was posted in. Wide enough for those, narrow enough to catch a misread year. */
export const DATE_SLACK = { bank: { before: 3, after: 5 }, card: { before: 60, after: 5 } } as const;
/** A bank row may sit up to this many days before the row above it (a real Canara statement has one such step in 390). */
export const ORDER_SLACK_DAYS = 3;

/** Date checks (D-053, borrowed from FinAnalyzer's checker): the amounts can reconcile while a date is wrong (a misread
 *  year, 01 read as 11), and a wrong date puts spending in the wrong month. Every row must carry a real date and sit within
 *  the printed statement period (give or take DATE_SLACK); in a bank account, rows must also come in date order. Card
 *  statements group rows (domestic, then international), so order isn't checked there. */
export function dateChecks(txns: Txn[], period: { from: string; to: string } | undefined, kind: 'bank' | 'card'): Check[] {
  const bad = txns.filter((t) => !realDate(t.date));
  const out = [check('dates', 'Every row has a real date', !bad.length, bad.length ? `${bad.length} rows without a readable date` : `${txns.length} dates read`)];
  if (period && realDate(period.from) && realDate(period.to)) {
    const lo = shift(period.from, -DATE_SLACK[kind].before), hi = shift(period.to, DATE_SLACK[kind].after);
    const outside = txns.filter((t) => t.date < lo || t.date > hi);
    out.push(check('in_period', 'Every row is dated within the statement period', !outside.length, outside.length ? `${outside.length} rows far outside ${period.from} to ${period.to}, first ${outside[0].date}` : `${txns.length} rows near ${period.from} to ${period.to}`));
  }
  if (kind === 'bank') {
    const i = txns.findIndex((t, k) => k > 0 && t.date < shift(txns[k - 1].date, -ORDER_SLACK_DAYS));
    out.push(check('order', 'Rows are in date order', i < 0, i < 0 ? 'in order' : `row ${i + 1} (${txns[i].date}) is dated well before row ${i} (${txns[i - 1].date})`));
  }
  return out;
}

/** Balance walk decides debit vs credit when a row prints one amount without saying which column (HDFC savings). */
function walkChecks(txns: Txn[], opening: Paise, closing: Paise, drCount: number, crCount: number, debits: Paise, credits: Paise): Check[] {
  let bad = 0, first = ''; let bal = opening;
  for (const t of txns) { bal += t.dir === 'credit' ? t.amount : -t.amount; if (t.balance !== undefined && bal !== t.balance) { bad++; if (!first) first = t.date; bal = t.balance; } }
  const dr = txns.filter((t) => t.dir === 'debit'), cr = txns.filter((t) => t.dir === 'credit');
  const sum = (x: Txn[]) => x.reduce((a, t) => a + t.amount, 0);
  return [
    check('walk', 'Running balance matches every row', bad === 0, bad ? `${bad} rows off, first on ${first}` : `${txns.length} rows walk from opening to closing`),
    check('counts', 'Debit and credit counts match the summary', dr.length === drCount && cr.length === crCount, `${dr.length}/${cr.length} vs printed ${drCount}/${crCount}`),
    check('totals', 'Debit and credit totals match the summary', sum(dr) === debits && sum(cr) === credits, `${rupees(sum(dr))}/${rupees(sum(cr))} vs printed ${rupees(debits)}/${rupees(credits)}`),
    check('closing', 'Opening + credits − debits = closing', opening + sum(cr) - sum(dr) === closing, `${rupees(opening + sum(cr) - sum(dr))} vs printed ${rupees(closing)}`),
  ];
}

// ---------- HDFC savings ----------
// Row: "dd/mm/yy NARRATION REF dd/mm/yy AMOUNT CLOSING" (one amount; which column it sat in is lost in text, so the
// balance change decides). Narration wraps onto the next lines. Pages repeat the header block.
export function hdfcSavings(lines: string[], file: string): BankRead {
  const ROW = /^(\d{2}\/\d{2}\/\d{2})\s+(.*?)\s*(\S{6,24})\s+(\d{2}\/\d{2}\/\d{2})\s+([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})$/;
  const acct = last4(/Account No\s*:\s*(\d{6,})/i.exec(lines.join('\n'))?.[1]);
  const id = `bank:${acct || 'hdfc'}`;
  const raw: { date: string; desc: string[]; amount: Paise; balance: Paise }[] = [];
  // Rows are recognised anywhere (two dates + two amounts is specific enough). Only wrapped narration needs to know where
  // the table is: each page repeats an account header block (from "Page No" to "Statement of account"), the column
  // header appears on page 1 only, and the statement ends with a summary and footnotes.
  let header = false, ended = false; let summary: number[] | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^Opening Balance\s+Dr Count/i.test(l)) { summary = (lines[i + 1].match(/[\d,]+\.\d{2}|\b\d+\b/g) ?? []).map((x) => (x.includes('.') ? paise(x) : Number(x))); continue; }
    if (/^Page No/i.test(l)) { header = true; continue; }
    if (/Statement of account/i.test(l) || /^Date\s+Narration/i.test(l)) { header = false; continue; }
    if (/^STATEMENT SUMMARY/i.test(l) || /^\*Closing balance/i.test(l)) { ended = true; continue; }
    const m = ROW.exec(l);
    if (m) { raw.push({ date: yy(m[1]), desc: [m[2].trim()], amount: paise(m[5]), balance: paise(m[6]) }); ended = false; continue; }
    if (!header && !ended && raw.length && l.trim() && raw.at(-1)!.desc.length < 4) raw.at(-1)!.desc.push(l.trim());
  }
  const [opening, drCount, crCount, debits, credits, closing] = summary ?? [0, 0, 0, 0, 0, 0];
  let prev = opening;
  const txns: Txn[] = raw.map((r, i) => {
    const dir: Txn['dir'] = prev + r.amount === r.balance ? 'credit' : 'debit'; prev = r.balance;
    return { id: `${file}#${i + 1}`, date: r.date, desc: r.desc.join(' ').replace(/\s+/g, ' '), amount: r.amount, dir, balance: r.balance, account: id, source: 'bank_statement', sourceFile: file };
  });
  const checks = summary ? walkChecks(txns, opening, closing, drCount, crCount, debits, credits) : [check('summary', 'Statement summary found', false, 'no summary block')];
  return { format: 'hdfc_savings', txns, checks, period: periodFrom(lines), account: { id, kind: 'bank', label: `HDFC Bank ••${acct}`, last4: acct, opening, closing, closingDate: txns.at(-1)?.date } };
}

// ---------- SBI savings ----------
// Row: "dd/mm/yyyy dd/mm/yyyy DESCRIPTION REF DEBIT CREDIT BALANCE" with "-" for an empty column. Description wraps.
export function sbiSavings(lines: string[], file: string): BankRead {
  const START = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.*)$/;
  const acct = last4(/Account Number\s*:\s*(\d{6,})/i.exec(lines.join('\n'))?.[1]);
  const id = `bank:${acct || 'sbi'}`;
  const txns: Txn[] = []; let summary: string[] | null = null; let cont = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/Dr Count\s+Cr Count/i.test(l)) { summary = lines[i + 1].match(/[\d,]+\.\d{2}(?:\s*(?:CR|DR))?|\b\d+\b/gi) ?? []; continue; }
    const m = START.exec(l);
    if (m) {
      const tok = m[3].trim().split(/\s+/);
      const [dr, cr, bal] = tok.slice(-3);
      if (!/^(-|[\d,]+\.\d{2})$/.test(dr) || !/^(-|[\d,]+\.\d{2})$/.test(cr) || !AMT.test(bal)) continue;
      const desc = tok.slice(0, -4).join(' ');
      const debit = dr !== '-', amount = paise(debit ? dr : cr);
      txns.push({ id: `${file}#${txns.length + 1}`, date: yy(m[1]), desc, amount, dir: debit ? 'debit' : 'credit', balance: paise(bal), account: id, source: 'bank_statement', sourceFile: file });
      cont = 0; continue;
    }
    // first wrapped line usually completes the description (UPI handle / payee); skip page furniture
    if (txns.length && cont < 1 && l.trim() && !/^(Page no|Balance$|Statement Summary|Txn Date)/i.test(l) && !/^\d{10,}\s/.test(l)) { txns.at(-1)!.desc += ' ' + l.trim(); cont++; }
  }
  const nums = (summary ?? []).map((x) => x.replace(/\s*(CR|DR)$/i, ''));
  const opening = nums[0] ? paise(nums[0]) : 0, drCount = Number(nums[1] ?? 0), crCount = Number(nums[2] ?? 0);
  const debits = nums[3] ? paise(nums[3]) : 0, credits = nums[4] ? paise(nums[4]) : 0, closing = nums[5] ? paise(nums[5]) : 0;
  const checks = summary ? walkChecks(txns, opening, closing, drCount, crCount, debits, credits) : [check('summary', 'Statement summary found', false, 'no summary block')];
  return { format: 'sbi_savings', txns, checks, period: periodFrom(lines), account: { id, kind: 'bank', label: `SBI ••${acct}`, last4: acct, opening, closing, closingDate: txns.at(-1)?.date } };
}

// ---------- HDFC credit card ----------
// Row: "dd/mm/yyyy| hh:mm DESCRIPTION [+] ₹ AMOUNT [flag]" — "+" marks a payment, refund or cashback.
// Summary: PREVIOUS DUES − PAYMENTS/CREDITS + PURCHASES/DEBITS + FINANCE CHARGES = TOTAL AMOUNT DUE.
// HDFC's card PDF runs words together ("CREDIT CARD PAYMENTNet Banking", "SwiggyBENGALURU", "NETFLIXMUMBAI") and tags purchases
// that are only *eligible* for EMI with a leading "EMI" (the statement's legend: "Eligible for EMI · CONVERT TO EMI"). Read on the
// owner's own statement, 8 Nov: his bill payment was taken as income, a ₹9,995 purchase as a loan EMI, and 8 rows went unsorted.
const CITIES = 'BENGALURU|BANGALORE|MUMBAI|GURGAON|GURUGRAM|NEW DELHI|DELHI|NOIDA|HYDERABAD|CHENNAI|PUNE|KOLKATA|AHMEDABAD|JAIPUR|LUCKNOW|INDORE|BHOPAL|CHANDIGARH|KOCHI|THANE';
export function deglue(desc: string): string {
  return desc
    .replace(/^EMI\s+(?!.*(?:\b\d{1,2}\s*\/\s*\d{1,3}\b|INSTAL+MENT|PRINCIPAL|INTEREST|\bEMI\b))/i, '') // an offer, not a loan; a real instalment line keeps it ("EMI 3/12", "PRINCIPAL")
    .replace(/([A-Z]{2,})(?=[A-Z][a-z])/g, '$1 ')    // PAYMENTNet → PAYMENT Net
    .replace(/([a-z])(?=[A-Z]{3,})/g, '$1 ')         // SwiggyBENGALURU → Swiggy BENGALURU
    .replace(new RegExp(`(?<=[A-Za-z*])(${CITIES})$`, 'i'), ' $1') // NETFLIXMUMBAI → NETFLIX MUMBAI, ZeptoBengaluru → Zepto Bengaluru
    .replace(/\s+/g, ' ').trim();
}

export function hdfcCard(lines: string[], file: string): BankRead {
  const ROW = /^(\d{2}\/\d{2}\/\d{4})\|\s*\d{2}:\d{2}\s+(.*?)\s+(\+\s*)?\D{0,2}\s?([\d,]+\.\d{2})(?:\s+\S{1,3})?$/;
  const all = lines.join('\n');
  const card = last4(/Credit Card No\.?\s*([0-9X*]{8,})/i.exec(all)?.[1]);
  const id = `card:${card || 'hdfc'}`;
  const txns: Txn[] = [];
  for (const l of lines) {
    const m = ROW.exec(l);
    if (!m) continue;
    const credit = !!m[3];
    txns.push({ id: `${file}#${txns.length + 1}`, date: yy(m[1]), desc: deglue(m[2].replace(/\(Ref#[^)]*\)/i, '').trim()), amount: paise(m[4]), dir: credit ? 'credit' : 'debit', account: id, source: 'card_statement', sourceFile: file });
  }
  // the summary row: five amounts joined by + and =
  const sumLine = lines.find((l) => /[\d,]+\.\d{2}.*\+.*[\d,]+\.\d{2}.*\+.*[\d,]+\.\d{2}.*=.*[\d,]+\.\d{2}/.test(l)) ?? '';
  const [prev, pay, purch, fin, total] = (sumLine.match(/[\d,]+\.\d{2}/g) ?? []).map(paise);
  const dueIdx = lines.findIndex((l) => /MINIMUM DUE\s+DUE DATE/i.test(l));
  const dueLine = dueIdx >= 0 ? lines.slice(dueIdx + 1, dueIdx + 4).find((l) => /[\d,]+\.\d{2}\s+\d{1,2}\s+[A-Za-z]{3}/.test(l)) ?? '' : '';
  const minDue = dueLine ? paise(dueLine.match(/[\d,]+\.\d{2}/)![0]) : 0;
  const dueDate = longDate(dueLine);
  const stmtDate = longDate(/Statement Date\s+(.{6,14}\d{4})/i.exec(all)?.[1] ?? '');
  // the limits: three whole-rupee amounts a few lines under "TOTAL CREDIT LIMIT" (total, available, cash) (D-092)
  const limIdx = lines.findIndex((l) => /TOTAL CREDIT LIMIT/i.test(l));
  const limLine = limIdx >= 0 ? lines.slice(limIdx + 1, limIdx + 8).find((l) => /^\D?[\d,]{3,}(?:\.\d{2})?\s+\D?[\d,]{3,}(?:\.\d{2})?\s+\D?[\d,]{3,}(?:\.\d{2})?$/.test(l.trim())) : undefined;
  const lims = limLine ? (limLine.trim().match(/[\d,]{3,}(?:\.\d{2})?/g) ?? []).map(paise) : [];
  const bp = /Billing Period\s+(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})/i.exec(all);
  const sum = (d: Txn['dir']) => txns.filter((t) => t.dir === d).reduce((a, t) => a + t.amount, 0);
  const ok = total !== undefined;
  const checks: Check[] = ok ? [
    check('equation', 'Previous dues − payments + purchases + charges = total due', Math.abs(prev - pay + purch + fin - total) <= 100, `${rupees(prev - pay + purch + fin)} vs printed ${rupees(total)}`),
    check('debits', 'Purchase rows add up to the printed purchases', sum('debit') === purch, `${rupees(sum('debit'))} vs printed ${rupees(purch)}`),
    check('credits', 'Payment and credit rows add up to the printed credits', sum('credit') === pay, `${rupees(sum('credit'))} vs printed ${rupees(pay)}`),
  ] : [check('summary', 'Statement summary found', false, 'no total-due line')];
  const stmt: CardStatement = { account: id, file, periodStart: bp ? longDate(bp[1]) : '', periodEnd: bp ? longDate(bp[2]) : stmtDate, dueDate, prevBalance: prev ?? 0, payments: pay ?? 0, purchases: purch ?? 0, credits: pay ?? 0, charges: fin ?? 0, totalDue: total ?? 0, minDue, ...(lims.length === 3 && lims[0] > 0 ? { limit: lims[0], available: lims[1] } : {}) };
  return { format: 'hdfc_card', txns, checks, stmt, period: { from: stmt.periodStart, to: stmt.periodEnd }, account: { id, kind: 'card', label: `HDFC credit card ••${card}`, last4: card } };
}

// ---------- Canara savings (e-passbook) ----------
// Each row spans several lines: narration lines, then "dd-mm-yyyy [narration tail] AMOUNT BALANCE", then more narration,
// a time "hh:mm:ss", and "Chq: <ref>" closing the row. One amount per row (the column is lost in text), so the balance
// change decides debit vs credit. No count or total lines: the checks are the walk and opening → closing.
export function canaraSavings(lines: string[], file: string): BankRead {
  const ROW = /^(\d{2}-\d{2}-\d{4})\s+(.*?)\s*([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})$/;
  const head = lines.slice(0, 10).join('\n');
  const acct = last4(/A\/c\s+(\S+)/i.exec(head)?.[1]);
  const id = `bank:${acct || 'canara'}`;
  const pm = /(\d{2}-[A-Za-z]{3}-\d{4})\s+and\s+(\d{2}-[A-Za-z]{3}-\d{4})/i.exec(head);
  const dmy = (x: string) => { const [d, m, y] = x.split('-'); return `${y}-${MON[m.toLowerCase()]}-${d}`; };
  let opening: Paise | null = null, closing: Paise | null = null;
  const raw: { date: string; desc: string[]; amount: Paise; balance: Paise }[] = [];
  let buf: string[] = [], open = false;
  for (const l0 of lines) {
    const l = l0.trim();
    if (opening === null) { const m = /^Opening Balance\s+(-?[\d,]+\.\d{2})$/i.exec(l); if (m) opening = paise(m[1]); continue; }
    const cm = /^Closing Balance\s+(-?[\d,]+\.\d{2})$/i.exec(l); if (cm) { closing = paise(cm[1]); break; }
    if (!l || /^page \d+$/i.test(l) || /^Date\s+Particulars\s+Deposits/i.test(l)) continue;
    if (/^Chq:/i.test(l)) { open = false; buf = []; continue; }
    const m = ROW.exec(l);
    if (m) { raw.push({ date: yy(m[1]), desc: [...buf, m[2]], amount: paise(m[3]), balance: paise(m[4]) }); buf = []; open = true; continue; }
    const text = l.replace(/\s*\d{2}:\d{2}:\d{2}$/, '').trim();
    if (!text) continue;
    if (open) raw.at(-1)!.desc.push(text); else buf.push(text);
  }
  const op = opening ?? 0; let prev = op;
  const txns: Txn[] = raw.map((r, i) => {
    const dir: Txn['dir'] = prev + r.amount === r.balance ? 'credit' : 'debit'; prev = r.balance;
    return { id: `${file}#${i + 1}`, date: r.date, desc: r.desc.filter(Boolean).join(' ').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim(), amount: r.amount, dir, balance: r.balance, account: id, source: 'bank_statement', sourceFile: file };
  });
  const checks: Check[] = opening === null || closing === null ? [check('summary', 'Opening and closing balance found', false, `opening ${opening === null ? 'missing' : 'found'}, closing ${closing === null ? 'missing' : 'found'}`)]
    : walkChecks(txns, op, closing, 0, 0, 0, 0).filter((c) => c.id === 'walk' || c.id === 'closing');
  return { format: 'canara_savings', txns, checks, period: pm ? { from: dmy(pm[1]), to: dmy(pm[2]) } : undefined, account: { id, kind: 'bank', label: `Canara Bank ••${acct}`, last4: acct, opening: op, closing: closing ?? 0, closingDate: txns.at(-1)?.date } };
}

// ---------- Axis credit card (one-page statement) ----------
// Row: "dd Mon 'yy MERCHANT,CITY ₹ AMOUNT Debit|Credit". A payment row prints its description on the line above
// and its reference on the line below. Summary: Total Payment Due, Minimum Payment Due, Payment Due Date; Statement
// Month, Credit Limit, Opening Balance. Check: opening + debits − credits = total due.
export function axisCard(lines: string[], file: string): BankRead {
  const ROW = /^(\d{1,2})\s+([A-Za-z]{3})\s+'(\d{2})\s*(.*?)\s*₹\s*([\d,]+\.\d{2})\s+(Debit|Credit)$/i;
  const D = (d: string, m: string, y: string) => `20${y}-${MON[m.toLowerCase()]}-${d.padStart(2, '0')}`;
  const all = lines.join('\n');
  const card = last4(/Card Number\s*:?\s*([0-9X*x]{8,})/i.exec(all)?.[1]);
  const id = `card:${card || 'axis'}`;
  const start = lines.findIndex((l) => /^Date\s+Transaction Details/i.test(l));
  const raw: { date: string; desc: string; amount: Paise; dir: Txn['dir']; pre: string[]; post: string[] }[] = [];
  let orphans: string[] = [];
  for (const l0 of lines.slice(start + 1)) {
    const l = l0.trim();
    if (!l) continue;
    if (/^End of Transaction/i.test(l) || /^Page \d+ of \d+$/i.test(l)) break;
    const m = ROW.exec(l);
    if (m) {
      const last = raw.at(-1);
      if (!m[4] && orphans.length) raw.push({ date: D(m[1], m[2], m[3]), desc: '', amount: paise(m[5]), dir: /credit/i.test(m[6]) ? 'credit' : 'debit', pre: orphans, post: [] });
      else { if (last && orphans.length) last.post.push(...orphans); raw.push({ date: D(m[1], m[2], m[3]), desc: m[4], amount: paise(m[5]), dir: /credit/i.test(m[6]) ? 'credit' : 'debit', pre: [], post: [] }); }
      orphans = []; continue;
    }
    orphans.push(l);
  }
  if (orphans.length && raw.length) raw.at(-1)!.post.push(...orphans);
  const txns: Txn[] = raw.map((r, i) => {
    const text = r.desc || r.pre.join(' ').replace(/\s*-$/, '');
    const desc = text.includes(',') ? text.slice(0, text.lastIndexOf(',')).trim() : text; // drop the merchant's city after the last comma
    return { id: `${file}#${i + 1}`, date: r.date, desc: desc || text, amount: r.amount, dir: r.dir, account: id, source: 'card_statement', sourceFile: file };
  });
  const after = (re: RegExp) => { const i = lines.findIndex((l) => re.test(l)); return i >= 0 ? lines[i + 1] ?? '' : ''; };
  const due = after(/Total Payment Due\s+Minimum Payment Due\s+Payment Due Date/i);
  const dm = /₹\s*([\d,]+\.\d{2})\s+₹\s*([\d,]+\.\d{2})\s+(\d{1,2})\s+([A-Za-z]{3})\s+'(\d{2})/.exec(due);
  const sm = /([A-Za-z]{3})[a-z]*\s+(\d{4})\s+₹\s*([\d,]+\.\d{2})\s+₹\s*(-?[\d,]+\.\d{2})/.exec(after(/Statement Month\s+Credit Limit\s+Opening Balance/i));
  const sum = (d: Txn['dir']) => txns.filter((t) => t.dir === d).reduce((a, t) => a + t.amount, 0);
  const total = dm ? paise(dm[1]) : undefined, minDue = dm ? paise(dm[2]) : 0, opening = sm ? paise(sm[4]) : undefined;
  const checks: Check[] = total !== undefined && opening !== undefined
    ? [check('equation', 'Opening balance + purchases − payments = total due', opening + sum('debit') - sum('credit') === total, `${rupees(opening + sum('debit') - sum('credit'))} vs printed ${rupees(total)}`)]
    : [check('summary', 'Statement summary found', false, `${total === undefined ? 'no total due' : ''} ${opening === undefined ? 'no opening balance' : ''}`.trim())];
  const dates = txns.map((t) => t.date).sort();
  const stmt: CardStatement = { account: id, file, periodStart: dates[0] ?? '', periodEnd: dates.at(-1) ?? '', dueDate: dm ? D(dm[3], dm[4], dm[5]) : '', prevBalance: opening ?? 0, payments: sum('credit'), purchases: sum('debit'), credits: sum('credit'), charges: 0, totalDue: total ?? 0, minDue };
  return { format: 'axis_card', txns, checks, stmt, period: dates.length ? { from: dates[0], to: dates.at(-1)! } : undefined, account: { id, kind: 'card', label: `Axis credit card ••${card}`, last4: card } };
}

// ---------- Federal Bank savings ----------
// Row: "dd/mm/yyyy dd/mm/yyyy PARTICULARS [TRAN TYPE [CHEQUE]] AMOUNT BALANCE Dr|Cr" (owner's statement, 2 Nov 2026). Text
// keeps one amount, not which column it sat in; the last column says whether the row was a withdrawal (Dr) or a deposit
// (Cr), and the running balance must agree. Totals: "GRAND TOTAL <withdrawals> <deposits>"; opening: "Opening Balance".
// No row counts are printed, so the checks are the walk, the totals and opening + deposits − withdrawals = the last balance.
export function federalSavings(lines: string[], file: string): BankRead {
  const ROW = /^(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+(.*?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(Cr|Dr)$/;
  const all = lines.join('\n');
  const acct = last4(/Account Number\s+(\d{6,})/i.exec(all)?.[1]);
  const id = `bank:${acct || 'federal'}`;
  const om = /^Opening Balance\s+(-?[\d,]+\.\d{2})/im.exec(all);
  const opening = om ? paise(om[1]) * (om[1].startsWith('-') ? -1 : 1) : 0;
  const tm = /GRAND TOTAL\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i.exec(all);
  const txns: Txn[] = [];
  for (const l of lines) {
    const m = ROW.exec(l); if (!m) continue;
    const amount = paise(m[3]), balance = paise(m[4]);
    const dir: Txn['dir'] = m[5] === 'Cr' ? 'credit' : 'debit';
    // the tran type (TFR, CASH…) and a cheque number print after the particulars; they say nothing the narration doesn't
    const desc = m[2].replace(/\s+(TFR|CASH|CLG|TRF)(\s+\S+)?$/, '').replace(/\s+/g, ' ').trim();
    txns.push({ id: `${file}#${txns.length + 1}`, date: yy(m[1]), desc, amount, dir, balance, account: id, source: 'bank_statement', sourceFile: file });
  }
  let bad = 0, first = '', bal = opening;
  for (const t of txns) { bal += t.dir === 'credit' ? t.amount : -t.amount; if (bal !== t.balance) { bad++; if (!first) first = t.date; bal = t.balance!; } }
  const sum = (d: Txn['dir']) => txns.filter((t) => t.dir === d).reduce((a, t) => a + t.amount, 0);
  const closing = txns.at(-1)?.balance ?? opening;
  const checks: Check[] = [
    check('walk', 'Running balance matches every row', bad === 0 && txns.length > 0, bad ? `${bad} rows off, first on ${first}` : `${txns.length} rows walk from opening to closing`),
    tm ? check('totals', 'Withdrawal and deposit totals match the grand total', sum('debit') === paise(tm[1]) && sum('credit') === paise(tm[2]), `${rupees(sum('debit'))}/${rupees(sum('credit'))} vs printed ${tm[1]}/${tm[2]}`)
       : check('totals', 'Grand total found', false, 'no GRAND TOTAL line'),
    check('closing', 'Opening + deposits − withdrawals = last balance', opening + sum('credit') - sum('debit') === closing, `${rupees(opening + sum('credit') - sum('debit'))} vs ${rupees(closing)}`),
  ];
  const pm = /PERIOD\s*:\s*(\d{2})-([A-Za-z]{3})-(\d{4})\s+to\s+(\d{2})-([A-Za-z]{3})-(\d{4})/i.exec(all);
  const period = pm ? { from: `${pm[3]}-${MON[pm[2].toLowerCase()]}-${pm[1]}`, to: `${pm[6]}-${MON[pm[5].toLowerCase()]}-${pm[4]}` } : undefined;
  return { format: 'federal_savings', txns, checks, period, account: { id, kind: 'bank', label: `Federal Bank ••${acct}`, last4: acct, opening, closing, closingDate: txns.at(-1)?.date } };
}

function periodFrom(lines: string[]) {
  const m = /From\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})\s*To\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})/i.exec(lines.join('\n')) ?? /Statement From\s*:\s*(\d{2}-\d{2}-\d{4})\s*to\s*(\d{2}-\d{2}-\d{4})/i.exec(lines.join('\n'));
  return m ? { from: yy(m[1]), to: yy(m[2]) } : undefined;
}
