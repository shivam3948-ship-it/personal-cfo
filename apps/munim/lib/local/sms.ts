'use client';
// Bank and UPI alert SMS, kept in this browser (D-055). Read on the phone (packages/core/src/ingest/sms.ts); the
// messages themselves are never stored or sent, only the transactions read from them. SMS rows are provisional: where
// a statement covers the same account and dates, the statement wins (mergeSms, used by myDataset).
import type { Txn } from '@core/types';
import { readBankSms, smsFromBackupXml, splitPasted, type SmsRead } from '@core/ingest/sms';
import { idbDel, idbGet, idbPut } from './idb';
import { switchToMyData } from './profile';

const KEY = 'sms_txns';

export async function loadSms(): Promise<Txn[]> { return (await idbGet<Txn[]>(KEY)) ?? []; }
export async function deleteAllSms(): Promise<void> { await idbDel(KEY); }

/** Read pasted text or an exported file; save what was read; return the read for the result screen. */
export async function readSmsText(text: string, file = 'pasted SMS'): Promise<SmsRead & { added: number }> {
  const msgs = /<smses\b|<sms\b/.test(text) ? smsFromBackupXml(text) : splitPasted(text);
  const r = readBankSms(msgs, file);
  const old = await loadSms();
  const have = new Set(old.map((t) => t.id));
  const fresh = r.txns.filter((t) => !have.has(t.id));
  if (fresh.length) { await idbPut(KEY, [...old, ...fresh]); switchToMyData(); }
  return { ...r, added: fresh.length };
}

/** Statement rows first; an SMS row is dropped when a statement of the same account covers its date, or when the same
 *  account, date, amount and direction is already there. A 3-digit ending ("XX903") joins the account whose last 4 end with it. */
export function mergeSms(statementTxns: Txn[], periods: { account: string; from: string; to: string }[], sms: Txn[]): Txn[] {
  const accounts = [...new Set(statementTxns.map((t) => t.account).concat(periods.map((p) => p.account)))];
  const norm = (a: string) => {
    const [kind, d] = a.split(':');
    return d && d.length < 4 ? accounts.find((x) => x.startsWith(kind + ':') && x.endsWith(d)) ?? a : a;
  };
  const key = (t: Txn) => `${t.account}|${t.date}|${t.amount}|${t.dir}`;
  const counts = new Map<string, number>();
  for (const t of statementTxns) counts.set(key(t), (counts.get(key(t)) ?? 0) + 1);
  const out: Txn[] = [];
  for (const s0 of sms) {
    const s = { ...s0, account: norm(s0.account) };
    if (periods.some((p) => p.account === s.account && s.date >= p.from && s.date <= p.to)) continue;
    const k = key(s), c = counts.get(k) ?? 0;
    if (c > 0) { counts.set(k, c - 1); continue; }
    out.push(s);
  }
  return out;
}
