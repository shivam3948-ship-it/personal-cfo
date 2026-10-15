import type { Account, Check, Txn } from '../types';
import { parseMoney } from '../money';
import { toIso } from '../dates';

/** Minimal RFC-4180 CSV parser; lines starting with '#' are metadata, returned separately. */
export function parseCsv(text: string): { rows: string[][]; meta: string[] } {
  const meta: string[] = []; const rows: string[][] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const body: string[] = [];
  for (const l of lines) { if (l.startsWith('#')) meta.push(l.slice(1).trim()); else body.push(l); }
  const s = body.join('\n');
  let row: string[] = []; let field = ''; let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; field = ''; }
    else field += c;
  }
  row.push(field); if (row.some((x) => x.trim() !== '')) rows.push(row);
  return { rows, meta };
}

const H = {
  date: /^(txn |transaction |value |posting )?date$|^date$|^tran date$/i,
  desc: /narration|description|particulars|details|remarks|transaction details/i,
  debit: /withdrawal|debit|dr\.?( amt| amount)?$|paid out/i,
  credit: /deposit|credit|cr\.?( amt| amount)?$|paid in/i,
  amount: /^amount( \(inr\)| \(rs\.?\))?$|^amt$/i,
  type: /^(type|dr\/cr|cr\/dr|txn type)$/i,
  balance: /balance/i,
};

export interface CsvMapping { date: number; desc: number; debit?: number; credit?: number; amount?: number; type?: number; balance?: number }

export function mapHeader(header: string[]): CsvMapping | null {
  const idx = (re: RegExp, skip: number[] = []) => header.findIndex((h, i) => !skip.includes(i) && re.test(h.trim()));
  const date = idx(H.date); const desc = idx(H.desc);
  const balance = idx(H.balance);
  const debit = idx(H.debit, [balance]); const credit = idx(H.credit, [balance, debit]);
  const amount = idx(H.amount); const type = idx(H.type);
  if (date < 0 || desc < 0) return null;
  if (debit < 0 && amount < 0) return null;
  return { date, desc, debit: debit >= 0 ? debit : undefined, credit: credit >= 0 ? credit : undefined, amount: amount >= 0 ? amount : undefined, type: type >= 0 ? type : undefined, balance: balance >= 0 ? balance : undefined };
}

export function bankCsvToTxns(text: string, file: string): { txns: Txn[]; account: Account; checks: Check[]; problems: string[] } {
  const { rows, meta } = parseCsv(text);
  const problems: string[] = [];
  const hi = rows.findIndex((r) => mapHeader(r) !== null);
  if (hi < 0) throw new Error('No recognisable header (need date, description and debit/credit or amount columns)');
  const map = mapHeader(rows[hi])!;
  const metaText = meta.join(' ');
  const last4 = (metaText.match(/(?:a\/c|account)[^\d]*(?:x+|\*+)?(\d{4})\b/i)?.[1]) ?? '0000';
  const accountId = `bank:${last4}`;
  const txns: Txn[] = [];
  rows.slice(hi + 1).forEach((r, i) => {
    const date = toIso(r[map.date] ?? '');
    if (!date) { if (r.join('').trim()) problems.push(`row ${i + 1}: unreadable date "${r[map.date]}"`); return; }
    let dr = map.debit !== undefined ? parseMoney(r[map.debit] || '0') ?? 0 : 0;
    let cr = map.credit !== undefined ? parseMoney(r[map.credit] || '0') ?? 0 : 0;
    if (map.amount !== undefined && !dr && !cr) {
      const a = parseMoney(r[map.amount] || '0') ?? 0;
      const ty = map.type !== undefined ? (r[map.type] || '').toLowerCase() : '';
      if (/cr|credit/.test(ty) || (!ty && a > 0 && /credit/i.test(rows[hi][map.amount]))) cr = Math.abs(a); else if (ty) dr = Math.abs(a); else if (a < 0) dr = -a; else cr = a;
    }
    const balance = map.balance !== undefined ? parseMoney(r[map.balance] || '') ?? undefined : undefined;
    if (!dr && !cr) return;
    txns.push({ id: `${file}#${i + 1}`, date, desc: (r[map.desc] || '').trim(), amount: dr || cr, dir: dr ? 'debit' : 'credit', balance, account: accountId, source: 'bank_statement', sourceFile: file });
  });
  const opening = parseMoney(metaText.match(/opening balance[:\s]*([\d,]+\.?\d*)/i)?.[1] ?? '') ?? undefined;
  const closing = parseMoney(metaText.match(/closing balance[:\s]*([\d,]+\.?\d*)/i)?.[1] ?? '') ?? undefined;
  const account: Account = { id: accountId, kind: 'bank', label: `Bank account ••${last4}`, last4, opening, closing, closingDate: txns.at(-1)?.date };
  return { txns, account, checks: balanceChecks(txns, opening, closing, 'Bank statement'), problems };
}

/** Running-balance walk + opening/closing reconciliation. Shared by CSV, PDF-text and SMS parsers. */
export function balanceChecks(txns: Txn[], opening: number | undefined, closing: number | undefined, label: string): Check[] {
  const checks: Check[] = [];
  const withBal = txns.filter((t) => t.balance !== undefined);
  if (withBal.length) {
    let prev = opening ?? (withBal[0].balance! - (withBal[0].dir === 'credit' ? withBal[0].amount : -withBal[0].amount));
    let mismatches = 0; let firstBreak = '';
    for (const t of txns) {
      if (t.balance === undefined) continue;
      const expect = prev + (t.dir === 'credit' ? t.amount : -t.amount);
      if (expect !== t.balance) { mismatches++; if (!firstBreak) firstBreak = `${t.date} "${t.desc.slice(0, 40)}"`; }
      prev = t.balance;
    }
    checks.push({ id: 'balance_walk', label: `${label}: running balance walk`, ok: mismatches === 0, detail: mismatches === 0 ? `${withBal.length} rows, 0 mismatches` : `${mismatches} mismatches; first break at ${firstBreak}` });
  }
  if (opening !== undefined && closing !== undefined) {
    const net = txns.reduce((s, t) => s + (t.dir === 'credit' ? t.amount : -t.amount), 0);
    checks.push({ id: 'open_close', label: `${label}: opening + credits − debits = closing`, ok: opening + net === closing, detail: `${opening} + ${net} vs ${closing} (paise)` });
  }
  return checks;
}
