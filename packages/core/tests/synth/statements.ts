// Synthetic statements in each layout the readers support (D-053, the idea borrowed from FinAnalyzer's training set):
// seeded, balance-consistent months of made-up transactions, printed the way pdfLines rebuilds each bank's PDF (page
// furniture, wrapped narrations, summary blocks). Made-up people, accounts and amounts; merchants are public brands.
// Used to test the readers on hundreds of statements instead of one fixture each, and to break them on purpose
// (a dropped row, a misread year, a day out of order) to prove the checks catch it.
import type { Paise } from '@core/types';

export type Fmt = 'hdfc_savings' | 'sbi_savings' | 'canara_savings' | 'hdfc_card' | 'axis_card';
export const FORMATS: Fmt[] = ['hdfc_savings', 'sbi_savings', 'canara_savings', 'hdfc_card', 'axis_card'];
export interface Row { date: string; dir: 'debit' | 'credit'; amount: Paise; balance?: Paise; payee: string }
export interface Synth { fmt: Fmt; lines: string[]; rows: Row[]; period: { from: string; to: string } }
/** Ways to print a statement wrong while its totals stay right: drop a row, or print a row's date as something else. */
export interface Break { drop?: number; date?: { row: number; to: string } }

const MERCHANTS = ['SWIGGY', 'ZOMATO', 'BLINKIT', 'ZEPTO', 'UBER', 'OLA', 'AMAZON', 'FLIPKART', 'MYNTRA', 'BIGBASKET', 'DMART', 'APOLLO PHARMACY', 'BESCOM', 'AIRTEL', 'NETFLIX', 'IRCTC', 'DECATHLON'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function rng(seed: number) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const parts = (d: string) => ({ y: d.slice(0, 4), m: d.slice(5, 7), d: d.slice(8, 10), mon: MON3[+d.slice(5, 7) - 1] });
/** Indian grouping, two decimals: 1,00,000.00 */
export function inr(p: Paise): string {
  const [i, f] = (p / 100).toFixed(2).split('.');
  const head = i.slice(0, -3), tail = i.slice(-3);
  return `${head ? head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : ''}${tail}.${f}`;
}
const handle = (m: string) => `${m.toLowerCase().replace(/\s+/g, '')}@ybl`;

interface Ev { date: string; dir: 'debit' | 'credit'; amount: Paise; payee: string; kind: 'upi' | 'salary' | 'rent' | 'sip' | 'refund' | 'payment' | 'cashback' }

/** A month of bank account activity: salary, rent, an SIP, everyday UPI spends and the odd refund. Balance never below 0. */
function bankMonth(r: () => number, y: number, m: number): { evs: Ev[]; opening: Paise } {
  const n = daysIn(y, m), int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const money = (a: number, b: number) => int(a, b) * 100 + (r() < 0.4 ? int(1, 99) : 0);
  const evs: Ev[] = [
    { date: iso(y, m, int(1, 3)), dir: 'credit', amount: int(40, 150) * 100000, payee: 'EXAMPLE EMPLOYER', kind: 'salary' },
    { date: iso(y, m, int(3, 6)), dir: 'debit', amount: int(12, 35) * 100000, payee: 'EXAMPLE LANDLORD', kind: 'rent' },
    { date: iso(y, m, int(5, 10)), dir: 'debit', amount: int(2, 20) * 50000, payee: 'EXAMPLE MF', kind: 'sip' },
  ];
  for (let k = int(8, 26); k > 0; k--) evs.push({ date: iso(y, m, int(1, n)), dir: 'debit', amount: money(40, 4000), payee: MERCHANTS[int(0, MERCHANTS.length - 1)], kind: 'upi' });
  for (let k = int(0, 2); k > 0; k--) evs.push({ date: iso(y, m, int(1, n)), dir: 'credit', amount: money(50, 1500), payee: MERCHANTS[int(0, MERCHANTS.length - 1)], kind: 'refund' });
  evs.sort((a, b) => a.date.localeCompare(b.date));
  return { evs, opening: money(5000, 200000) };
}

function walk(evs: Ev[], opening: Paise): Row[] {
  let bal = opening; const rows: Row[] = [];
  for (const e of evs) {
    if (e.dir === 'debit' && bal - e.amount < 0) continue; // a month with more going out than in: skip what would overdraw
    bal += e.dir === 'credit' ? e.amount : -e.amount;
    rows.push({ date: e.date, dir: e.dir, amount: e.amount, balance: bal, payee: e.payee });
  }
  return rows;
}

export function synth(fmt: Fmt, seed: number, brk: Break = {}): Synth {
  const r = rng(seed * 7919 + FORMATS.indexOf(fmt));
  const y = 2025 + Math.floor(r() * 2), m = 1 + Math.floor(r() * 11);
  const shown = (i: number, d: string) => (brk.date?.row === i ? brk.date.to : d);
  if (fmt === 'hdfc_card' || fmt === 'axis_card') return card(fmt, r, y, m, brk, shown);
  const { evs, opening } = bankMonth(r, y, m);
  const rows = walk(evs, opening);
  const closing = rows.at(-1)?.balance ?? opening;
  const period = { from: iso(y, m, 1), to: iso(y, m, daysIn(y, m)) };
  const dr = rows.filter((x) => x.dir === 'debit'), cr = rows.filter((x) => x.dir === 'credit');
  const total = (xs: Row[]) => xs.reduce((a, x) => a + x.amount, 0);
  const evOf = (i: number) => evs.find((e) => e.date === rows[i].date && e.amount === rows[i].amount && e.payee === rows[i].payee)!;
  const L: string[] = [];
  const PER_PAGE = 12;

  if (fmt === 'hdfc_savings') {
    const f = parts(period.from), t = parts(period.to);
    const d8 = (d: string) => { const p = parts(d); return `${p.d}/${p.m}/${p.y.slice(2)}`; };
    rows.forEach((x, i) => {
      if (i % PER_PAGE === 0) {
        L.push(`Page No .: ${i / PER_PAGE + 1}`, 'Account Branch : Example Branch');
        if (i === 0) L.push('Account No : 50100012345678 OTHER');
        L.push(`From : ${f.d}/${f.m}/${f.y} To : ${t.d}/${t.m}/${t.y} Statement of account`);
        if (i === 0) L.push('Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance');
      }
      if (brk.drop === i) return;
      const e = evOf(i), ref = `0000${String(seed * 1000 + i).padStart(12, '0')}`;
      const narr = e.kind === 'salary' ? `NEFT CR-${e.payee}` : e.kind === 'rent' ? `NEFT DR-${e.payee}` : e.kind === 'sip' ? `ACH D- ${e.payee} SIP` : `UPI-${x.payee}-${handle(x.payee).toUpperCase()}`;
      const d = d8(shown(i, x.date));
      L.push(`${d} ${narr} ${ref} ${d} ${inr(x.amount)} ${inr(x.balance!)}`);
      if (e.kind === 'upi' || e.kind === 'refund') L.push(i % 2 ? 'PAYMENT FROM PHONE' : `UPI-REF-${seed}${i}`);
    });
    L.push('STATEMENT SUMMARY :-', 'Opening Balance Dr Count Cr Count Debits Credits Closing Bal', `${inr(opening)} ${dr.length} ${cr.length} ${inr(total(dr))} ${inr(total(cr))} ${inr(closing)}`);
  }

  if (fmt === 'sbi_savings') {
    const dmy = (d: string, s: string) => { const p = parts(d); return `${p.d}${s}${p.m}${s}${p.y}`; };
    L.push('STATEMENT OF ACCOUNT', 'Account Number : 00000012345678', `Statement From : ${dmy(period.from, '-')} to ${dmy(period.to, '-')}`);
    rows.forEach((x, i) => {
      if (i && i % PER_PAGE === 0) L.push(`Page no. ${i / PER_PAGE}`, 'Balance');
      if (brk.drop === i) return;
      const e = evOf(i), d = dmy(shown(i, x.date), '/');
      const desc = e.kind === 'salary' ? `NEFT*${e.payee}*N${seed}${i}` : e.kind === 'rent' ? `NEFT*${e.payee}*N${seed}${i}` : e.kind === 'sip' ? `ACH/${e.payee}/SIP${i}` : `UPI/${x.dir === 'debit' ? 'DR' : 'CR'}/6123456${String(i).padStart(5, '0')}/${x.payee}`;
      L.push(`${d} ${d} ${desc} - ${x.dir === 'debit' ? inr(x.amount) : '-'} ${x.dir === 'credit' ? inr(x.amount) : '-'} ${inr(x.balance!)}`);
      if (e.kind === 'upi' || e.kind === 'refund') L.push(`/YBL/${handle(x.payee)}`, `1234567890${String(i).padStart(3, '0')} OF 00000 UPI`);
    });
    L.push(`Statement Summary : ${dmy(period.from, '-')} To ${dmy(period.to, '-')}`, 'Brought Forward ( ) Dr Count Cr Count Total Debits( ) Total Credits( ) Closing Balance ( )',
      `${inr(opening)}CR ${dr.length} ${cr.length} ${inr(total(dr))} ${inr(total(cr))} ${inr(closing)}CR`);
  }

  if (fmt === 'canara_savings') {
    const f = parts(period.from), t = parts(period.to);
    L.push(`Statement for A/c XXXXXXXX4321 between ${f.d}-${f.mon}-${f.y} and ${t.d}-${t.mon}-${t.y}`, 'Customer Id 123 Branch Code 0001', 'Name EXAMPLE PERSON Branch Name EXAMPLE',
      'Date Particulars Deposits Withdrawals Balance', `Opening Balance ${inr(opening)}`);
    rows.forEach((x, i) => {
      if (i && i % PER_PAGE === 0) L.push(`page ${i / PER_PAGE}`, '', 'Date Particulars Deposits Withdrawals Balance');
      if (brk.drop === i) return;
      const e = evOf(i), p = parts(shown(i, x.date)), chq = `6000000${String(seed).padStart(3, '0')}${String(i).padStart(2, '0')}`;
      if (e.kind === 'salary') L.push(`NEFT CR/${e.payee}/HDFC`, '/SALARY');
      else if (e.kind === 'rent') L.push(`NEFT DR/${e.payee}`);
      else if (e.kind === 'sip') L.push(`ACH DR/${e.payee}/SIP`);
      else L.push(`UPI/${x.dir === 'debit' ? 'DR' : 'CR'}/${chq}/${x.payee}`, `/YESB/**${handle(x.payee)}/UPI//`);
      L.push(`${p.d}-${p.m}-${p.y} ${i % 3 ? '' : `ref${i}/${p.d}/${p.m}/${p.y} `}${inr(x.amount)} ${inr(x.balance!)}`.replace('  ', ' '), `${pad(8 + (i % 12))}:${pad(i % 60)}:00`, `Chq: ${chq}`);
    });
    L.push(`Closing Balance ${inr(closing)}`, 'TERMS AND CONDITIONS APPLY', `page ${Math.ceil(rows.length / PER_PAGE)}`);
  }
  return { fmt, lines: L, rows, period };
}

/** A card cycle: the previous bill paid, purchases, a cashback or refund; HDFC adds a late-posted purchase dated before the cycle. */
function card(fmt: 'hdfc_card' | 'axis_card', r: () => number, y: number, m: number, brk: Break, shown: (i: number, d: string) => string): Synth {
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const money = (a: number, b: number) => int(a, b) * 100 + (r() < 0.4 ? int(1, 99) : 0);
  const from = iso(y, m, 17), to = iso(y, m + 1, 16); // m is at most 11, so the cycle never crosses a year
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 864e5);
  const prev = money(1000, 60000);
  const evs: Ev[] = [{ date: addDays(from, int(2, 10)), dir: 'credit', amount: prev, payee: 'PAYMENT RECEIVED', kind: 'payment' }];
  for (let k = int(5, 25); k > 0; k--) evs.push({ date: addDays(from, int(0, span)), dir: 'debit', amount: money(80, 6000), payee: MERCHANTS[int(0, MERCHANTS.length - 1)], kind: 'upi' });
  if (r() < 0.6) evs.push({ date: addDays(from, int(0, span)), dir: 'credit', amount: money(10, 300), payee: MERCHANTS[int(0, MERCHANTS.length - 1)], kind: fmt === 'hdfc_card' ? 'cashback' : 'refund' });
  evs.sort((a, b) => a.date.localeCompare(b.date));
  // a purchase posted in this cycle but made before it (real HDFC statements have these), listed last, out of order
  if (fmt === 'hdfc_card' && r() < 0.5) evs.push({ date: addDays(from, -int(3, 25)), dir: 'debit', amount: money(200, 3000), payee: 'MAKEMYTRIP', kind: 'upi' });
  const rows: Row[] = evs.map((e) => ({ date: e.date, dir: e.dir, amount: e.amount, payee: e.payee }));
  const sum = (d: 'debit' | 'credit') => rows.filter((x) => x.dir === d).reduce((a, x) => a + x.amount, 0);
  const fin = fmt === 'hdfc_card' && r() < 0.2 ? money(100, 900) : 0;
  const total = prev - sum('credit') + sum('debit') + fin, min = Math.round(total / 20 / 100) * 100;
  const due = parts(addDays(to, 19)), sd = parts(to), fp = parts(from);
  const L: string[] = [];
  if (fmt === 'hdfc_card') {
    L.push('Example Bank Credit Card Statement', 'Credit Card No. 412345XXXXXX8747', `Statement Date ${sd.d} ${sd.mon}, ${sd.y}`, `Billing Period ${fp.d} ${fp.mon}, ${fp.y} - ${sd.d} ${sd.mon}, ${sd.y}`,
      'PREVIOUS STATEMENT DUES PAYMENTS/CREDITS PURCHASES/DEBIT FINANCE CHARGES TOTAL AMOUNT DUE',
      `C${inr(prev)} C${inr(sum('credit'))} + C${inr(sum('debit'))} + C${inr(fin)} = C${inr(total)}`,
      'TOTAL CREDIT LIMIT AVAILABLE CREDIT LIMIT AVAILABLE CASH LIMIT MINIMUM DUE DUE DATE', `C${inr(min)} ${due.d} ${due.mon}, ${due.y}`,
      'Domestic Transactions', 'DATE & TIME TRANSACTION DESCRIPTION AMOUNT PI');
    rows.forEach((x, i) => {
      if (brk.drop === i) return;
      const p = parts(shown(i, x.date)), e = evs[i];
      const desc = e.kind === 'payment' ? `BBPS PAYMENT RECEIVED (Ref# ST${100000000 + i})` : e.kind === 'cashback' ? `10% ${x.payee} CashBack` : `${x.payee} BANGALORE`;
      L.push(`${p.d}/${p.m}/${p.y}| ${pad(9 + (i % 12))}:${pad((i * 7) % 60)} ${desc} ${x.dir === 'credit' ? '+ ' : ''}C ${inr(x.amount)} l`);
    });
  } else {
    L.push('Axis Bank Example Credit Card Statement', 'EXAMPLE PERSON', '123 EXAMPLE ROAD, EXAMPLE CITY', 'Card No 123456 Credit Card Number: 4321XXXXXXXX9876', 'Payment Summary',
      'Total Payment Due Minimum Payment Due Payment Due Date', `₹ ${inr(total)} ₹ ${inr(min)} ${due.d} ${due.mon} '${due.y.slice(2)}`,
      'Your Statement Month Credit Limit Opening Balance', `${sd.mon} ${sd.y} ₹ 1,00,000.00 ₹ ${inr(prev)}`, 'Transaction Summary', 'Date Transaction Details Amount (INR) Debit/Credit');
    rows.forEach((x, i) => {
      if (brk.drop === i) return;
      const p = parts(shown(i, x.date)), d = `${p.d} ${p.mon} '${p.y.slice(2)}`;
      if (evs[i].kind === 'payment') L.push('BBPS Payment Received -', `${d} ₹ ${inr(x.amount)} Credit`, `ref${100000000 + i}`);
      else L.push(`${d} ${evs[i].kind === 'refund' ? `REFUND ${x.payee}` : x.payee},BANGALORE ₹ ${inr(x.amount)} ${x.dir === 'credit' ? 'Credit' : 'Debit'}`);
    });
    L.push('End of Transaction Details', 'Page 1 of 1');
  }
  return { fmt, lines: L, rows, period: { from, to } };
}
