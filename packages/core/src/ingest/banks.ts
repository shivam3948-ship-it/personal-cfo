// Statement readers for the banks Munim supports first (D-036): HDFC and SBI savings accounts, HDFC credit cards.
// Input: text lines rebuilt by position (pdfLines). Output: transactions plus checks against the statement's OWN totals;
// a reader only "passes" when every check reconciles to the paisa. Pure TS: runs on the phone, the PDF never leaves it.
// Only the last 4 digits of an account or card number are kept.
import type { Account, CardStatement, Check, Paise, Txn } from '../types';

export type BankFormat = 'hdfc_savings' | 'sbi_savings' | 'hdfc_card';
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
  if (/STATEMENT OF ACCOUNT/i.test(t) && /\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4}\s/.test(lines.join('\n')) && /Statement Summary/i.test(lines.join('\n'))) return 'sbi_savings';
  return null;
}

export function readBank(lines: string[], file: string): BankRead | null {
  const f = detectFormat(lines);
  return f === 'hdfc_savings' ? hdfcSavings(lines, file) : f === 'sbi_savings' ? sbiSavings(lines, file) : f === 'hdfc_card' ? hdfcCard(lines, file) : null;
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
    txns.push({ id: `${file}#${txns.length + 1}`, date: yy(m[1]), desc: m[2].replace(/\(Ref#[^)]*\)/i, '').trim(), amount: paise(m[4]), dir: credit ? 'credit' : 'debit', account: id, source: 'card_statement', sourceFile: file });
  }
  // the summary row: five amounts joined by + and =
  const sumLine = lines.find((l) => /[\d,]+\.\d{2}.*\+.*[\d,]+\.\d{2}.*\+.*[\d,]+\.\d{2}.*=.*[\d,]+\.\d{2}/.test(l)) ?? '';
  const [prev, pay, purch, fin, total] = (sumLine.match(/[\d,]+\.\d{2}/g) ?? []).map(paise);
  const dueIdx = lines.findIndex((l) => /MINIMUM DUE\s+DUE DATE/i.test(l));
  const dueLine = dueIdx >= 0 ? lines.slice(dueIdx + 1, dueIdx + 4).find((l) => /[\d,]+\.\d{2}\s+\d{1,2}\s+[A-Za-z]{3}/.test(l)) ?? '' : '';
  const minDue = dueLine ? paise(dueLine.match(/[\d,]+\.\d{2}/)![0]) : 0;
  const dueDate = longDate(dueLine);
  const stmtDate = longDate(/Statement Date\s+(.{6,14}\d{4})/i.exec(all)?.[1] ?? '');
  const bp = /Billing Period\s+(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})/i.exec(all);
  const sum = (d: Txn['dir']) => txns.filter((t) => t.dir === d).reduce((a, t) => a + t.amount, 0);
  const ok = total !== undefined;
  const checks: Check[] = ok ? [
    check('equation', 'Previous dues − payments + purchases + charges = total due', Math.abs(prev - pay + purch + fin - total) <= 100, `${rupees(prev - pay + purch + fin)} vs printed ${rupees(total)}`),
    check('debits', 'Purchase rows add up to the printed purchases', sum('debit') === purch, `${rupees(sum('debit'))} vs printed ${rupees(purch)}`),
    check('credits', 'Payment and credit rows add up to the printed credits', sum('credit') === pay, `${rupees(sum('credit'))} vs printed ${rupees(pay)}`),
  ] : [check('summary', 'Statement summary found', false, 'no total-due line')];
  const stmt: CardStatement = { account: id, file, periodStart: bp ? longDate(bp[1]) : '', periodEnd: bp ? longDate(bp[2]) : stmtDate, dueDate, prevBalance: prev ?? 0, payments: pay ?? 0, purchases: purch ?? 0, credits: pay ?? 0, charges: fin ?? 0, totalDue: total ?? 0, minDue };
  return { format: 'hdfc_card', txns, checks, stmt, period: { from: stmt.periodStart, to: stmt.periodEnd }, account: { id, kind: 'card', label: `HDFC credit card ••${card}`, last4: card } };
}

function periodFrom(lines: string[]) {
  const m = /From\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})\s*To\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})/i.exec(lines.join('\n')) ?? /Statement From\s*:\s*(\d{2}-\d{2}-\d{4})\s*to\s*(\d{2}-\d{2}-\d{4})/i.exec(lines.join('\n'));
  return m ? { from: yy(m[1]), to: yy(m[2]) } : undefined;
}
