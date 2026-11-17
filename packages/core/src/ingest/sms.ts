// Bank and UPI alert SMS, read on the phone (D-055). For savers who never download a statement PDF, SMS is the data
// they already have. Input: pasted messages, a .txt export, or an "SMS Backup & Restore" XML file.
// Banks word their alerts differently, so this reads the parts every money alert has (amount, debit or credit,
// account or card ending, date) instead of one template per bank. The patterns follow common alert wording and are
// tested on synthetic messages; ⚠ verify against real SMS from each bank before claiming support for it.
// A message is used only when every part is found; nothing is guessed. OTPs, offers, requests and failed payments
// are skipped. SMS carry no statement totals, so rows are provisional: a statement for the same account and period
// replaces them (lib/local/statements.ts in the app).
import type { Check, Paise, Txn } from '../types';

export interface SmsIn { body: string; at?: string; sender?: string } // `at`: the date the phone received it (YYYY-MM-DD)
export interface SmsRead {
  txns: Txn[];
  messages: number;
  skipped: { otp: number; notMoney: number; unreadable: number; duplicate: number };
  checks: Check[];
  banks: string[];
}

const BANKS: [RegExp, string][] = [
  [/\bhdfc\b/i, 'HDFC Bank'], [/\bsbi\b|state bank/i, 'SBI'], [/\bicici\b/i, 'ICICI Bank'], [/\baxis\b/i, 'Axis Bank'],
  [/\bkotak\b/i, 'Kotak'], [/\bcanara\b/i, 'Canara Bank'], [/\bpnb\b|punjab national/i, 'PNB'], [/\bbob\b|bank of baroda/i, 'Bank of Baroda'],
  [/\bunion bank\b/i, 'Union Bank'], [/\bidfc\b/i, 'IDFC First'], [/\byes bank\b/i, 'Yes Bank'], [/\bindusind\b/i, 'IndusInd'],
  [/\bfederal\b/i, 'Federal Bank'], [/\bindian bank\b/i, 'Indian Bank'], [/\bpaytm payments bank\b/i, 'Paytm Payments Bank'], [/\bairtel payments bank\b/i, 'Airtel Payments Bank'],
];
const MON: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));
const real = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null; };
const paise = (s: string): Paise => Math.round(Number(s.replace(/,/g, '')) * 100);

const OTP = /\b(otp|one[- ]time password|verification code|passcode)\b/i;
// money that hasn't moved: requests, reminders, offers, failures
const NOT_MONEY = /\b(will be (debited|deducted)|is due|due on|due date|requested|collect request|request of|mandate|autopay (set|registered)|pre-?approved|offer|cashback up to|eligible|failed|declined|unsuccessful|could not be|not processed|reminder)\b/i;
const DEBIT = /\b(debited|sent|spent|paid|withdrawn|deducted|purchase|transferred to)\b/i;
const CREDIT = /\b(credited|received|deposited|refunded|refund of)\b/i;
const CUR_AMT = /(?:rs\.?|inr|₹)\s?([\d,]+(?:\.\d{1,2})?)/gi;
const BAL = /(?:avl|avail|available|clr|clear)\.?\s*(?:bal(?:ance)?|bal\.)\s*(?:is|:|-)?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i;
const ACCT = /(?:\ba\/c\b|\bacct\b|\baccount\b|\bac\b|\bcard\b)\s*(?:no\.?)?\s*(?:ending(?:\s+with)?)?\s*[:\-]?\s*[x*.]*\s*(\d{3,6})\b/i;

/** The date in the message: 26-10-26, 26/10/2026, 26.10.26, 26-Oct-26, 26 Oct 2026, 26Oct26, 2026-10-26. */
export function smsDate(body: string): string | null {
  let m = body.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return real(+m[1], +m[2], +m[3]);
  m = body.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (m) return real(fullYear(m[3]), +m[2], +m[1]);
  m = body.match(/\b(\d{1,2})[\s-]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,-]*(\d{4}|\d{2})\b/i);
  if (m) return real(fullYear(m[3]), MON[m[2].toLowerCase()], +m[1]);
  return null;
}

/** Who the money went to or came from, when the message says. Trimmed at the usual tails (Ref, UPI, Avl Bal…). */
function counterparty(body: string, dir: 'debit' | 'credit'): string | null {
  const stop = String.raw`(?=\s+(?:on\b|ref\b|refno\b|upi\b|via\b|avl\b|avail\b|info\b|not you|if not|towards\b|for\b|is\b)|\s*[.;,(]|\s*$)`;
  const pats = dir === 'debit'
    ? [new RegExp(String.raw`;\s*([A-Za-z][\w&.' @-]{1,40}?)\s+credited`, 'i'), new RegExp(String.raw`(?:\btrf to\b|\bpaid to\b|\bsent to\b|\btransferred to\b|\bto\b|\bat\b|\btowards\b)\s+(?:vpa\s+)?([A-Za-z0-9][\w&.' @-]{1,40}?)${stop}`, 'i')]
    : [new RegExp(String.raw`\bfrom\b\s+(?:vpa\s+)?([A-Za-z0-9][\w&.' @-]{1,40}?)${stop}`, 'i'), new RegExp(String.raw`\bby\b\s+(?:vpa\s+)?([A-Za-z0-9][\w&.' @-]{1,40}?)${stop}`, 'i')];
  for (const re of pats) {
    const m = body.match(re);
    const v = m?.[1]?.trim();
    if (v && !/^(rs|inr|a\/c|ac|acct|account|your|you|the|card|bank|hdfc|sbi|icici|axis|kotak|canara)\b/i.test(v) && !/^\d+$/.test(v)) return v;
  }
  return null;
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

/** One message → a transaction, or the reason it isn't one. */
export function readOneSms(m: SmsIn, file = 'sms'): { txn: Txn; bank: string | null } | { skip: 'otp' | 'notMoney' | 'unreadable' } {
  const body = m.body.replace(/&amp;/g, '&').replace(/&#10;|\s+/g, ' ').trim();
  if (OTP.test(body)) return { skip: 'otp' };
  if (NOT_MONEY.test(body)) return { skip: 'notMoney' };
  const d = body.search(DEBIT), c = body.search(CREDIT);
  if (d < 0 && c < 0) return { skip: 'notMoney' };
  const dir: Txn['dir'] = d >= 0 && (c < 0 || d < c) ? 'debit' : 'credit';
  const balM = body.match(BAL);
  const rest = balM ? body.replace(balM[0], ' ') : body;
  const amts = [...rest.matchAll(CUR_AMT)].map((x) => x[1]);
  const amt = amts[0] ?? rest.match(/(?:debited|credited)\s+(?:by|with|for)\s+([\d,]+(?:\.\d{1,2})?)/i)?.[1];
  const acct = body.match(ACCT);
  const date = smsDate(body) ?? (m.at && /^\d{4}-\d{2}-\d{2}$/.test(m.at) ? m.at : null);
  if (!amt || !acct || !date || paise(amt) <= 0) return { skip: 'unreadable' };
  const isCard = /\bcard\b/i.test(acct[0]) || /credit card/i.test(body);
  const digits = acct[1].slice(-4);
  const who = counterparty(body, dir);
  const rail = /\bupi\b|@\w/i.test(body) ? 'UPI' : /\bneft\b/i.test(body) ? 'NEFT' : /\bimps\b/i.test(body) ? 'IMPS' : /\batm\b/i.test(body) ? 'ATM' : null;
  const desc = rail && who ? `${rail}/${who}` : who ?? (rail === 'ATM' ? 'ATM withdrawal' : rail ? `${rail} payment` : dir === 'debit' ? 'Payment' : 'Money received');
  const bank = BANKS.find(([re]) => re.test(body) || (m.sender ? re.test(m.sender) : false))?.[1] ?? null;
  const amount = paise(amt);
  const key = `${isCard ? 'card' : 'bank'}:${digits}|${date}|${amount}|${dir}|${body.toLowerCase()}`;
  const txn: Txn = { id: `sms:${hash(key)}`, date, desc, amount, dir, account: `${isCard ? 'card' : 'bank'}:${digits}`, source: 'sms', sourceFile: file,
    ...(balM && !isCard ? { balance: paise(balM[1]) } : {}) };
  return { txn, bank };
}

export function readBankSms(msgs: SmsIn[], file = 'sms', today?: string): SmsRead {
  const out: Txn[] = []; const seen = new Set<string>(); const banks = new Set<string>();
  const skipped = { otp: 0, notMoney: 0, unreadable: 0, duplicate: 0 };
  for (const m of msgs) {
    const r = readOneSms(m, file);
    if ('skip' in r) { skipped[r.skip]++; continue; }
    if (seen.has(r.txn.id)) { skipped.duplicate++; continue; }
    seen.add(r.txn.id); out.push(r.txn); if (r.bank) banks.add(r.bank);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  const limit = today ?? new Date().toISOString().slice(0, 10);
  const future = out.filter((t) => t.date > limit);
  // balances, where messages carry them: each must follow from the previous one on the same account. A gap usually means
  // a message wasn't pasted, so it's reported, not used to reject anything.
  let gaps = 0;
  for (const acct of new Set(out.map((t) => t.account))) {
    const rows = out.filter((t) => t.account === acct && t.balance !== undefined);
    for (let i = 1; i < rows.length; i++) if (rows[i - 1].balance! + (rows[i].dir === 'credit' ? rows[i].amount : -rows[i].amount) !== rows[i].balance) gaps++;
  }
  const checks: Check[] = [
    { id: 'parts', label: 'Every message used has an amount, debit or credit, an account and a date', ok: true, detail: `${out.length} used, ${skipped.unreadable} missing a part` },
    { id: 'future', label: 'No message is dated in the future', ok: future.length === 0, detail: future.length ? `${future.length} dated after ${limit}` : 'none' },
    { id: 'balances', label: 'Balances follow from one message to the next', ok: true, detail: gaps ? `${gaps} gap${gaps > 1 ? 's' : ''}: a message may be missing` : 'no gaps' },
  ];
  return { txns: future.length ? out.filter((t) => t.date <= limit) : out, messages: msgs.length, skipped, checks, banks: [...banks] };
}

/** Pasted text: one message per blank-line-separated block, or one per line when there are no blank lines. */
export function splitPasted(text: string): SmsIn[] {
  const t = text.replace(/\r/g, '').trim();
  if (!t) return [];
  const blocks = /\n\s*\n/.test(t) ? t.split(/\n\s*\n/) : t.split('\n');
  return blocks.map((b) => ({ body: b.replace(/\n/g, ' ').trim() })).filter((b) => b.body);
}

/** "SMS Backup & Restore" XML: <sms address=".." date="ms since 1970" type="1" body=".." />. Received messages only (type 1). */
export function smsFromBackupXml(xml: string): SmsIn[] {
  const out: SmsIn[] = [];
  for (const tag of xml.match(/<sms\b[^>]*>/g) ?? []) {
    const attr = (k: string) => tag.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1];
    if ((attr('type') ?? '1') !== '1') continue;
    const body = attr('body'); if (!body) continue;
    const ms = Number(attr('date'));
    const at = Number.isFinite(ms) && ms > 0 ? new Date(ms + 5.5 * 3600e3).toISOString().slice(0, 10) : undefined; // received time, India
    out.push({ body: body.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'), at, sender: attr('address') });
  }
  return out;
}
