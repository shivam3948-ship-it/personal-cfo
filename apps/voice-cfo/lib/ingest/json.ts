// Generic JSON: an array of transaction-like objects, or an object holding one, with flexible key names.
import type { Txn } from '../types';
import { parseMoney } from '../money';
import { toIso } from '../dates';

const KEYS = {
  date: ['date', 'txn_date', 'transaction_date', 'transactionDate', 'value_date', 'posted_at', 'timestamp'],
  desc: ['description', 'narration', 'merchant', 'remarks', 'particulars', 'details', 'payee', 'title'],
  amount: ['amount', 'amt', 'value', 'txn_amount'],
  debit: ['debit', 'withdrawal', 'dr'],
  credit: ['credit', 'deposit', 'cr'],
  type: ['type', 'direction', 'dr_cr', 'txn_type', 'transaction_type'],
  balance: ['balance', 'closing_balance', 'running_balance', 'available_balance'],
  account: ['account', 'account_number', 'account_no', 'card_number', 'source'],
};
const get = (o: Record<string, unknown>, ks: string[]) => { for (const k of Object.keys(o)) if (ks.includes(k) || ks.includes(k.toLowerCase())) return o[k]; return undefined; };
const money = (v: unknown) => (typeof v === 'number' ? Math.round(v * 100) : typeof v === 'string' ? parseMoney(v) : null);

export function findTxnArray(j: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(j) && j.length && typeof j[0] === 'object' && j[0] && get(j[0] as Record<string, unknown>, KEYS.date) !== undefined) return j as Record<string, unknown>[];
  if (j && typeof j === 'object') for (const v of Object.values(j)) { const f = findTxnArray(v); if (f) return f; }
  return null;
}

export function jsonToTxns(text: string, file: string): Txn[] | null {
  let j: unknown;
  try { j = JSON.parse(text); } catch { return null; }
  const arr = findTxnArray(j);
  if (!arr) return null;
  const out: Txn[] = [];
  arr.forEach((o, i) => {
    const rawDate = String(get(o, KEYS.date) ?? '');
    const date = toIso(rawDate.slice(0, 10)) ?? toIso(rawDate);
    if (!date) return;
    let dr = money(get(o, KEYS.debit)) ?? 0; let cr = money(get(o, KEYS.credit)) ?? 0;
    if (!dr && !cr) {
      const a = money(get(o, KEYS.amount)) ?? 0; const ty = String(get(o, KEYS.type) ?? '').toLowerCase();
      if (/cr|credit|in/.test(ty)) cr = Math.abs(a); else if (/dr|debit|out/.test(ty)) dr = Math.abs(a); else if (a < 0) dr = -a; else cr = a;
    }
    if (!dr && !cr) return;
    const acct = String(get(o, KEYS.account) ?? '');
    const isCard = /card/i.test(acct) || /card/i.test(String(get(o, ['account_type', 'instrument']) ?? ''));
    const last4 = acct.match(/(\d{4})\D*$/)?.[1] ?? '0000';
    const bal = money(get(o, KEYS.balance));
    out.push({ id: `${file}#${i + 1}`, date, desc: String(get(o, KEYS.desc) ?? ''), amount: dr || cr, dir: dr ? 'debit' : 'credit', balance: bal ?? undefined, account: `${isCard ? 'card' : 'bank'}:${last4}`, source: /sms/i.test(acct + file) ? 'sms' : isCard ? 'card_statement' : 'bank_statement', sourceFile: file });
  });
  return out;
}
