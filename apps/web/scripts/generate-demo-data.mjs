#!/usr/bin/env node
// Generates the synthetic demo dataset for voice-cfo (fictional person, fictional bank/lenders/insurers).
// Deterministic: same seed -> same files. All money is integer paise internally.
// This file deliberately re-implements EMI/amortisation on its own so tests can cross-check lib/finance.
// Usage: node scripts/generate-demo-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'demo');

// ---------- helpers ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261017);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1)); // inclusive, rupees
const R = (rupees) => Math.round(rupees * 100); // rupees -> paise
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dmy(isoDate) { const [y, m, d] = isoDate.split('-'); return `${d}/${m}/${y}`; }
function dMonY(isoDate) { const [y, m, d] = isoDate.split('-'); return `${d}-${MON[+m - 1]}-${y.slice(2)}`; }
function dMonYYYY(isoDate) { const [y, m, d] = isoDate.split('-'); return `${d}-${MON[+m - 1]}-${y}`; }
function inr(paise) { // Indian grouping, 2 decimals
  const neg = paise < 0; let p = Math.abs(paise);
  const r = Math.floor(p / 100); const ps = String(p % 100).padStart(2, '0');
  let s = String(r); let out = '';
  if (s.length > 3) { out = ',' + s.slice(-3); s = s.slice(0, -3); while (s.length > 2) { out = ',' + s.slice(-2) + out; s = s.slice(0, -2); } out = s + out; } else out = s;
  return (neg ? '-' : '') + out + '.' + ps;
}
const inr0 = (paise) => inr(paise).replace(/\.00$/, '');
function addMonths(isoDate, k) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + k, d));
  return t.toISOString().slice(0, 10);
}

// ---------- loans (independent implementation) ----------
function emiRupees(P, annualPct, n) { const r = annualPct / 1200; const f = Math.pow(1 + r, n); return Math.round((P * r * f) / (f - 1)); }
function outstandingAfter(Ppaise, annualPct, emiPaise, k) {
  const r = annualPct / 1200; let b = Ppaise;
  for (let i = 0; i < k; i++) { const int = Math.round(b * r); b = b + int - emiPaise; }
  return b;
}
const LOANS = [
  { id: 'car', lender: 'Kestrel Auto Finance Ltd', last4: '3301', type: 'Car Loan', principalR: 600000, rate: 9.5, n: 60, first: '2024-04-05', day: 5,
    prepay: 'Part-prepayment: permitted after 12 EMIs. Part-prepayment charges: NIL.', foreclose: 'Foreclosure: permitted after 12 EMIs. Foreclosure charges: 3% of principal outstanding + GST.' },
  { id: 'pl', lender: 'Orbit Finserv Pvt Ltd', last4: '7788', type: 'Personal Loan', principalR: 300000, rate: 13.5, n: 36, first: '2026-01-20', day: 20,
    prepay: 'Part-prepayment: permitted after 12 EMIs. Part-prepayment charges: 4% of amount prepaid + GST.', foreclose: 'Foreclosure: permitted after 12 EMIs. Foreclosure charges: 5% of principal outstanding + GST.' },
];
for (const L of LOANS) L.emi = R(emiRupees(L.principalR, L.rate, L.n));
const emiOf = (id) => LOANS.find((l) => l.id === id).emi;

// ---------- transactions ----------
const bank = []; // {date, desc, ref, dr, cr}
const card = []; // {date, desc, dr, cr}
const bankAdd = (date, desc, dr, cr = 0) => bank.push({ date, desc, dr, cr });
const cardAdd = (date, desc, dr, cr = 0) => card.push({ date, desc, dr, cr });

const FOOD = [['SWIGGY', 'UPI/SWIGGY/swiggy@icici/Food order'], ['ZOMATO', 'UPI/ZOMATO/zomato@hdfcbank/Food order']];
const QUICK = ['UPI/BLINKIT/blinkit@axisbank/Order', 'UPI/ZEPTO/zepto@ybl/Order'];
const CABS = ['UPI/UBER INDIA/uber@icici/Trip', 'UPI/OLA/olacabs@ybl/Ride', 'UPI/RAPIDO/rapido@axl/Ride'];
const DINING_CARD = ['POS TRUFFLES CAFE GURUGRAM', 'POS BIRYANI BLUES DLF PH4', 'POS SOCIAL CYBERHUB', 'POS CHAAYOS SECTOR 29'];
const AMAZON = ['AMAZON PAY INDIA ECOM', 'AMAZON IN RETAIL'];
const FUEL = ['HPCL FUEL STN SOHNA RD', 'IOCL COCO MG ROAD'];

function monthBank(y, m, opts) {
  const D = (d) => iso(y, m, d);
  const tag = `${MON[m - 1].toUpperCase()}${String(y).slice(2)}`;
  bankAdd(D(1), `NEFT CR/ACME TECHNOLOGIES PVT LTD/SALARY ${tag}`, 0, R(145000));
  bankAdd(D(2), 'UPI/P2P/RAJESH KUMAR/rajesh.k@okaxis/House rent', R(26000));
  bankAdd(D(3), 'IMPS/SELF/OWN A/C NEO BANK XX6610/Savings', R(10000));
  bankAdd(D(5), `ACH DR/KESTREL AUTO FINANCE/LN XX3301/EMI`, emiOf('car'));
  bankAdd(D(5), 'ACH DR/BSE LTD/MF SIP/ICCL', R(10000));
  bankAdd(D(7), 'UPI/P2P/RAKESH MEHTA/rakesh.m@oksbi/Papa monthly', R(10000));
  bankAdd(D(8), 'UPI/AUTOPAY/CULTFIT/cult@ybl/Membership', R(1999));
  if (opts.debitCardFee) bankAdd(D(1), 'DEBIT CARD ANNUAL FEE INCL GST', R(708));
  bankAdd(D(10), 'ACH DR/BHAROSA LIFE INSURANCE/POL XX8812/Premium', R(5000));
  if (opts.health) bankAdd(D(10), 'BILLPAY/SURAKSHA HEALTH INSURANCE/POL XX4410/Renewal', R(18900));
  bankAdd(D(12), 'BBPS/DHBVN ELECTRICITY/Bill', R(opts.elec));
  bankAdd(D(15), 'BBPS/AIRTEL POSTPAID/Bill', R(599));
  bankAdd(D(16), 'BBPS/ACT FIBERNET/Broadband', R(1059));
  bankAdd(D(18), 'UPI/AUTOPAY/NETFLIX/netflix@hdfcbank/Subscription', R(649));
  if (opts.netflixDup) bankAdd(D(18), 'UPI/AUTOPAY/NETFLIX/netflix@hdfcbank/Subscription', R(649));
  bankAdd(D(20), `ACH DR/ORBIT FINSERV/PL XX7788/EMI`, emiOf('pl'));
  bankAdd(D(22), 'BILLPAY/SAFFRON BANK CREDIT CARD XX9012', opts.cardBill);
  bankAdd(D(25), 'UPI/AUTOPAY/JIOHOTSTAR/hotstar@ybl/Subscription', R(299));
  bankAdd(D(opts.atmDay), 'ATM WDL/SAFFRON ATM SECTOR 44 GGN', R(5000));
  for (let i = 0; i < opts.food; i++) { const f = pick(FOOD); bankAdd(D(between(1, opts.last)), f[1], R(between(240, 690))); }
  for (let i = 0; i < 4; i++) bankAdd(D(between(1, opts.last)), QUICK[i % 2], R(between(320, 980)));
  for (let i = 0; i < 2; i++) bankAdd(D(between(1, opts.last)), 'UPI/DMART/dmart@ybl/Groceries', R(between(1800, 3200)));
  for (let i = 0; i < 6; i++) bankAdd(D(between(1, opts.last)), pick(CABS), R(between(140, 520)));
  if (opts.interest) bankAdd(D(opts.last), 'SB INTEREST CREDIT', 0, R(opts.interest));
  if (opts.smsChg) bankAdd(D(opts.last), 'SMS ALERT CHARGES QTR INCL GST', R(17.7));
}

function cycleCard(startIso, endIso, extras) {
  const [y1, m1] = startIso.split('-').map(Number);
  const days = [];
  for (let d = new Date(startIso + 'T00:00:00Z'); d <= new Date(endIso + 'T00:00:00Z'); d = new Date(d.getTime() + 86400000)) days.push(d.toISOString().slice(0, 10));
  const onDay = (dayOfMonth) => days.find((x) => +x.slice(8) === dayOfMonth);
  const sp = onDay(9); if (sp) cardAdd(sp, 'SPOTIFY INDIA SUBSCRIPTION', R(119));
  const yt = onDay(14); if (yt) cardAdd(yt, 'GOOGLE YOUTUBEPREMIUM', R(149));
  for (let i = 0; i < 3; i++) cardAdd(pick(days), pick(AMAZON), R(between(450, 3400)));
  for (let i = 0; i < 2; i++) cardAdd(pick(days), pick(FUEL), R(between(1500, 2600)));
  for (let i = 0; i < 3; i++) cardAdd(pick(days), pick(DINING_CARD), R(between(780, 2900)));
  for (const e of extras) cardAdd(e[0], e[1], e[2], e[3] || 0);
  void y1; void m1;
}

// Card cycles: 5th..4th. Statement date = 4th, due = 24th, paid from bank on 22nd.
const CYCLES = [
  { start: '2026-06-05', end: '2026-07-04', due: '2026-07-24', extras: [] },
  { start: '2026-07-05', end: '2026-08-04', due: '2026-08-24', extras: [['2026-07-20', 'AMAZON PRIME MEMBERSHIP ANNUAL', R(1499)]] },
  { start: '2026-08-05', end: '2026-09-04', due: '2026-09-24', extras: [
    ['2026-08-10', 'MYNTRA DESIGNS ONLINE', R(1299)], ['2026-08-16', 'REFUND MYNTRA DESIGNS ONLINE', 0, R(1299)],
    ['2026-08-28', 'CROMA RETAIL DLF CYBERHUB', R(38990)]] },
  { start: '2026-09-05', end: '2026-10-04', due: '2026-10-24', extras: [
    ['2026-09-12', 'MAKEMYTRIP INDIA PVT LTD', R(14200)], ['2026-09-13', 'GOA BEACH RESORT CANDOLIM', R(6800)]] },
];
const PREV_BAL_FIRST = R(18420); // previous statement (stmt dated 04-Jun-26) total due
const CASHBACK_FIRST = R(212);

const statements = [];
let prevTotal = PREV_BAL_FIRST; let prevPurch = null;
for (let i = 0; i < CYCLES.length; i++) {
  const c = CYCLES[i];
  const before = card.length;
  cycleCard(c.start, c.end, c.extras);
  // payment of previous statement, received on the 22nd of the start month
  const payDate = c.start.slice(0, 8) + '22';
  cardAdd(payDate, 'PAYMENT RECEIVED - THANK YOU', 0, prevTotal);
  const cashback = prevPurch === null ? CASHBACK_FIRST : Math.min(R(1500), Math.floor(prevPurch / 100) * 1); // 1% of prior-cycle purchases, floor to rupee... (paise/100 = rupees*1%)
  const cbDate = addMonths(c.start, 0).slice(0, 8) + '06';
  cardAdd(cbDate, 'CASHBACK CREDIT PREVIOUS CYCLE', 0, Math.floor(cashback / 100) * 100);
  const tx = card.slice(before).sort((a, b) => a.date.localeCompare(b.date));
  card.splice(before, tx.length, ...tx);
  const purchases = tx.reduce((s, t) => s + t.dr, 0);
  const payments = tx.filter((t) => t.desc.startsWith('PAYMENT RECEIVED')).reduce((s, t) => s + t.cr, 0);
  const otherCredits = tx.filter((t) => t.cr && !t.desc.startsWith('PAYMENT RECEIVED')).reduce((s, t) => s + t.cr, 0);
  const total = prevTotal - payments + purchases - otherCredits;
  const minDue = Math.max(R(200), Math.round(total * 0.05 / 100) * 100);
  statements.push({ ...c, prev: prevTotal, payments, purchases, credits: otherCredits, charges: 0, total, minDue, tx, payDate });
  prevTotal = total; prevPurch = purchases;
}

// Bank months Jul-Sep 2026: card bill on 22nd pays the statement whose cycle ended on the 4th of that month.
monthBank(2026, 7, { elec: 2140, health: true, atmDay: 13, food: 11, last: 31, cardBill: statements[0].total });
monthBank(2026, 8, { elec: 2860, debitCardFee: true, atmDay: 9, food: 12, last: 31, cardBill: statements[1].total });
monthBank(2026, 9, { elec: 2410, netflixDup: true, atmDay: 11, food: 21, last: 30, cardBill: statements[2].total, interest: 1186, smsChg: true });
// Bank-side payments must equal what the card statements show as received (cross-document check).
console.assert(statements[1].payments === statements[0].total && statements[2].payments === statements[1].total);

const OPENING = R(98250.35);
const order = (a, b) => a.date.localeCompare(b.date) || (b.cr - a.cr); // credits first within a day
bank.sort(order);
let bal = OPENING;
for (const t of bank) { bal = bal - t.dr + t.cr; t.bal = bal; }
const CLOSING = bal;

// ---------- SMS (Oct 1-15): continues the bank balance; card spends from the new cycle ----------
const smsTx = [];
const smsBank = (date, desc, dr, cr = 0) => smsTx.push({ date, desc, dr, cr, acct: 'bank' });
const smsCard = (date, desc, dr) => smsTx.push({ date, desc, dr, cr: 0, acct: 'card' });
smsBank('2026-10-01', 'ACME TECHNOLOGIES PVT LTD SALARY', 0, R(145000));
smsBank('2026-10-02', 'UPI/RAJESH KUMAR', R(26000));
smsBank('2026-10-03', 'IMPS/OWN A/C NEO BANK XX6610', R(10000));
smsBank('2026-10-05', 'ACH/KESTREL AUTO FINANCE', emiOf('car'));
smsBank('2026-10-05', 'ACH/BSE LTD MF SIP', R(10000));
smsBank('2026-10-07', 'UPI/RAKESH MEHTA', R(10000));
smsBank('2026-10-08', 'UPI AUTOPAY/CULTFIT', R(1999));
smsBank('2026-10-09', 'ATM WDL SECTOR 44 GGN', R(5000));
smsBank('2026-10-10', 'ACH/BHAROSA LIFE INSURANCE', R(5000));
smsBank('2026-10-12', 'BBPS/DHBVN ELECTRICITY', R(1980));
smsBank('2026-10-15', 'BBPS/AIRTEL POSTPAID', R(599));
for (let i = 0; i < 9; i++) { const f = pick(FOOD); smsBank(`2026-10-${String(between(1, 15)).padStart(2, '0')}`, `UPI/${f[0]}`, R(between(260, 720))); }
for (let i = 0; i < 2; i++) smsBank(`2026-10-${String(between(1, 15)).padStart(2, '0')}`, `UPI/${pick(['BLINKIT', 'ZEPTO'])}`, R(between(350, 900)));
for (let i = 0; i < 3; i++) smsBank(`2026-10-${String(between(1, 15)).padStart(2, '0')}`, `UPI/${pick(['UBER INDIA', 'OLA', 'RAPIDO'])}`, R(between(150, 480)));
smsCard('2026-10-06', 'AMAZON PAY INDIA ECOM', R(between(600, 2400)));
smsCard('2026-10-09', 'SPOTIFY INDIA', R(119));
smsCard('2026-10-11', 'LINGOPRO LEARNING APP', R(4999));
smsCard('2026-10-13', 'HPCL FUEL STN SOHNA RD', R(2200));
smsCard('2026-10-14', 'GOOGLE YOUTUBEPREMIUM', R(149));
smsTx.sort(order);
let sbal = CLOSING; let cardAvail = R(200000) - statements[3].total;
const smsLines = [];
const smsNoise = [
  ['2026-10-02 09:14', 'VM-SAFFRN', '482913 is your OTP for login to Saffron NetBanking. Do not share it with anyone. -Saffron Bank'],
  ['2026-10-06 18:40', 'VK-MYNTRA', 'BIG FASHION FESTIVAL is LIVE! Flat 60% off on top brands. Shop now: myntra.example/bff'],
  ['2026-10-11 12:02', 'AD-LNGPRO', 'Welcome to LingoPro Premium! Your annual plan is now active. Happy learning!'],
];
let hh = 7; let lastDay = '';
for (const t of smsTx) {
  if (t.date !== lastDay) { hh = 7; lastDay = t.date; }
  hh += 1; // strictly increasing within a day, so sorting by timestamp keeps the balance order
  const ts = `${t.date} ${String(hh).padStart(2, '0')}:${String(between(10, 59)).padStart(2, '0')}`;
  if (t.acct === 'bank') {
    sbal = sbal - t.dr + t.cr; t.bal = sbal;
    const body = t.cr
      ? `INR ${inr(t.cr)} credited to A/c XX4521 on ${dMonY(t.date)} by ${t.desc}. Avl Bal INR ${inr(sbal)} -Saffron Bank`
      : `INR ${inr(t.dr)} debited from A/c XX4521 on ${dMonY(t.date)} for ${t.desc}. Avl Bal INR ${inr(sbal)}. Not you? Call 1800-000-1234 -Saffron Bank`;
    smsLines.push([ts, 'VM-SAFFRN', body]);
  } else {
    cardAvail -= t.dr;
    smsLines.push([ts, 'VM-SAFFRN', `Rs ${inr(t.dr)} spent on Saffron Bank Credit Card XX9012 at ${t.desc} on ${dMonY(t.date)}. Avl Lmt Rs ${inr(cardAvail)} -Saffron Bank`]);
  }
}
smsLines.push(['2026-10-05 10:05', 'VM-SAFFRN', `Statement for Saffron Bank Credit Card XX9012 generated. Total Amt Due Rs ${inr(statements[3].total)}, Min Amt Due Rs ${inr(statements[3].minDue)}, Due Date ${dMonY(statements[3].due)} -Saffron Bank`]);
smsLines.push(['2026-10-14 11:30', 'VM-ORBITF', `Dear Customer, EMI of Rs ${inr(emiOf('pl'))} for loan a/c XX7788 is due on 20-Oct-26. Please maintain sufficient balance. -Orbit Finserv`]);
smsLines.push(...smsNoise);
smsLines.sort((a, b) => a[0].localeCompare(b[0]));
const SMS_CLOSING = sbal;

// ---------- write files ----------
fs.mkdirSync(path.join(OUT, 'emails'), { recursive: true });
const W = (rel, s) => fs.writeFileSync(path.join(OUT, rel), s.replace(/\n/g, '\n'));

// Bank statement CSV (common Indian bank export layout)
const csv = ['Date,Narration,Chq./Ref.No.,Withdrawal Amt.,Deposit Amt.,Closing Balance'];
bank.forEach((t, i) => {
  const ref = String(600000000000 + i * 7919).slice(0, 12);
  const q = (s) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  csv.push([dmy(t.date), q(t.desc), ref, t.dr ? (t.dr / 100).toFixed(2) : '', t.cr ? (t.cr / 100).toFixed(2) : '', (t.bal / 100).toFixed(2)].join(','));
});
W('bank_statement_saffron_jul-sep-2026.csv', [
  '# Saffron Bank (fictional) - Savings Account Statement',
  '# Account holder: Rohan Mehta | A/c No: XXXXXXXX4521 | Branch: Sector 44 Gurugram',
  `# Period: 01/07/2026 to 30/09/2026 | Opening Balance: ${(OPENING / 100).toFixed(2)} | Closing Balance: ${(CLOSING / 100).toFixed(2)}`,
  ...csv, ''].join('\n'));

// Card statements (text, as extracted from a PDF)
for (const s of statements) {
  const lines = [
    'SAFFRON BANK (fictional) - REWARDS CREDIT CARD STATEMENT',
    'Card Number: XXXX XXXX XXXX 9012        Name: ROHAN MEHTA',
    `Statement Date: ${dMonYYYY(s.end)}    Statement Period: ${dMonYYYY(s.start)} to ${dMonYYYY(s.end)}`,
    `Payment Due Date: ${dMonYYYY(s.due)}    Credit Limit: 2,00,000.00`,
    '',
    'ACCOUNT SUMMARY',
    `Previous Balance          ${inr(s.prev)}`,
    `Payments Received         ${inr(s.payments)}`,
    `Purchases & Debits        ${inr(s.purchases)}`,
    `Other Credits             ${inr(s.credits)}`,
    `Finance Charges           ${inr(s.charges)}`,
    `Total Amount Due          ${inr(s.total)}`,
    `Minimum Amount Due        ${inr(s.minDue)}`,
    '',
    'TRANSACTION DETAILS',
    'Date        Description                                   Amount (Rs)',
    ...s.tx.map((t) => `${dmy(t.date)}  ${t.desc.padEnd(44)}  ${t.cr ? inr(t.cr) + ' Cr' : inr(t.dr)}`),
    '',
    'Cashback shown is earned on the previous cycle and credited in this cycle. Paying only the minimum attracts finance charges at 3.6% per month.',
  ];
  W(`card_statement_saffron_${s.end.slice(0, 7)}.txt`, lines.join('\n') + '\n');
}

// SMS dump
W('sms_alerts_oct-2026.txt', '# Exported SMS (timestamp | sender | message)\n' + smsLines.map((l) => l.join(' | ')).join('\n') + '\n');

// Loan agreements
for (const L of LOANS) {
  const tenureEnd = addMonths(L.first, L.n - 1);
  W(`loan_${L.id === 'car' ? 'car_kestrel' : 'personal_orbit'}.txt`, [
    `${L.lender.toUpperCase()} (fictional)`,
    `${L.type.toUpperCase()} - SANCTION LETTER AND KEY FACT STATEMENT`,
    '',
    'Borrower: Rohan Mehta, Gurugram, Haryana',
    `Loan Account Number: XXXXXX${L.last4}`,
    `Sanctioned Loan Amount: Rs ${inr(R(L.principalR))}`,
    `Rate of Interest: ${L.rate.toFixed(2)}% p.a. (fixed, reducing balance)`,
    `Tenure: ${L.n} months`,
    `EMI Amount: Rs ${inr(L.emi)}`,
    `First EMI Date: ${dMonYYYY(L.first)}    Last EMI Date: ${dMonYYYY(tenureEnd)}`,
    `EMI debit date: ${L.day}th of every month via NACH from Saffron Bank A/c XX4521`,
    '',
    'PREPAYMENT AND FORECLOSURE',
    L.prepay,
    L.foreclose,
    '',
    'LATE PAYMENT',
    'Penal charges of 2% per month on the overdue EMI amount. Repeated delays are reported to credit bureaus.',
    '',
    'GRIEVANCE REDRESSAL',
    `Write to care@${L.id === 'car' ? 'kestrel-auto' : 'orbitfinserv'}.example with your loan account number. Nodal officer response within 30 days.`,
    '',
  ].join('\n'));
}

// Insurance policies
W('policy_term_tarang.txt', [
  'TARANG LIFE INSURANCE CO. LTD (fictional)',
  'POLICY SCHEDULE - TARANG SMART TERM PLAN (Pure term, non-linked, non-participating)',
  '',
  'Policyholder / Life Assured: Rohan Mehta    Age at entry: 26',
  'Policy Number: XXXXXX5590',
  'Policy Type: Term Insurance',
  'Sum Assured: Rs 1,00,00,000',
  'Annual Premium: Rs 14,500.00 (incl. GST)',
  'Premium Frequency: Yearly',
  'Policy Start Date: 02-Nov-2023',
  'Next Premium Due Date: 02-Nov-2026',
  'Policy Term: 34 years (cover till age 60)',
  'Nominee: Mother',
  'Grace Period: 30 days from the due date. Cover lapses if premium is unpaid after the grace period.',
  'Death Benefit: Sum Assured paid to the nominee. No maturity benefit.',
  '',
].join('\n'));

W('policy_health_suraksha.txt', [
  'SURAKSHA HEALTH INSURANCE LTD (fictional)',
  'POLICY SCHEDULE - SURAKSHA FAMILY SHIELD (Family Floater)',
  '',
  'Proposer: Rohan Mehta',
  'Policy Number: XXXXXX4410',
  'Policy Type: Health Insurance - Family Floater',
  'Sum Insured: Rs 10,00,000 (floater)',
  'Annual Premium: Rs 18,900.00 (incl. GST)',
  'Premium Frequency: Yearly',
  'First Policy Start Date: 10-Jul-2025    Current Period: 10-Jul-2026 to 09-Jul-2027',
  'Next Premium Due Date: 10-Jul-2027',
  'Insured Members: Self (age 29); Mother (age 56); Father (age 59)',
  '',
  'COVERAGE HIGHLIGHTS',
  'Room Rent: up to 1% of Sum Insured per day (Rs 10,000/day). ICU: up to 2% of Sum Insured per day (Rs 20,000/day).',
  'If a higher room category is chosen, associated medical expenses are reduced proportionately.',
  'Co-payment: 20% on every claim for insured members aged above 60 years at the time of admission.',
  'Pre-hospitalisation: 30 days. Post-hospitalisation: 60 days. Day-care procedures: covered.',
  'Ambulance: up to Rs 2,000 per hospitalisation.',
  '',
  'WAITING PERIODS',
  'Initial waiting period: 30 days from first policy start (except accidents).',
  'Specified illnesses/procedures waiting period: 24 months from first policy start - cataract, hernia, kidney stones, gall bladder stones, piles, sinusitis, tonsillectomy, joint replacement, knee replacement.',
  'Pre-existing diseases waiting period: 36 months from first policy start, for conditions declared in the proposal (declared: Father - hypertension).',
  'Maternity: not covered.',
  '',
  'CLAIMS PROCESS',
  'Cashless: available at network hospitals. Show the health card at the hospital insurance desk; the hospital sends the pre-authorisation request to the TPA.',
  'Intimation: planned hospitalisation at least 48 hours before admission; emergency hospitalisation within 24 hours of admission.',
  'TPA: CareLink TPA (fictional), helpline 1800-000-5678, claims@carelink-tpa.example',
  'Reimbursement: submit the claim within 30 days of discharge.',
  'Documents: claim form (signed), health card and photo ID of the patient, doctor\'s prescription advising admission, discharge summary, final hospital bill with itemised breakup, payment receipts, investigation reports, pharmacy bills with prescriptions, cancelled cheque of the proposer (for reimbursement).',
  '',
].join('\n'));

W('policy_endowment_bharosa.txt', [
  'BHAROSA LIFE INSURANCE CO. LTD (fictional)',
  'POLICY SCHEDULE - BHAROSA JEEVAN NIDHI (Endowment, non-linked, participating)',
  '',
  'Life Assured: Rohan Mehta',
  'Policy Number: XXXXXX8812',
  'Policy Type: Endowment Plan',
  'Sum Assured: Rs 8,00,000',
  'Monthly Premium: Rs 5,000.00 (Rs 60,000 per year)',
  'Premium Frequency: Monthly (NACH, 10th of every month)',
  'Policy Start Date: 10-Apr-2022',
  'Policy Term: 20 years    Premium Paying Term: 20 years',
  'Maturity Date: 10-Apr-2042',
  'Benefit Illustration (as given by the insurer; not guaranteed):',
  '  Maturity value at assumed investment return of 4% p.a.: Rs 12,60,000',
  '  Maturity value at assumed investment return of 8% p.a.: Rs 19,50,000',
  'Death Benefit: Sum Assured plus accrued bonuses.',
  '',
].join('\n'));

// Credit report
const carOut = outstandingAfter(R(600000), 9.5, emiOf('car'), 30); // Apr-24..Sep-26
const plOut = outstandingAfter(R(300000), 13.5, emiOf('pl'), 9);   // Jan-26..Sep-26
const utilNow = Math.round((statements[2].total / R(200000)) * 1000) / 10;
W('credit_report_trustscore.txt', [
  'TRUSTSCORE CREDIT BUREAU (fictional) - CREDIT INFORMATION REPORT',
  'Consumer: Rohan Mehta    Report Date: 01-Oct-2026',
  '',
  'CREDIT SCORE: 768 (range 300-900)',
  'Previous Score: 791 as on 01-Jul-2026',
  '',
  'ACCOUNTS',
  `1. Car Loan | Kestrel Auto Finance | Sanctioned 6,00,000 | Current Balance ${inr0(Math.round(carOut / 100) * 100)} | Opened 05-Mar-2024 | Status: Active | DPD (last 36 months): 0`,
  `2. Personal Loan | Orbit Finserv | Sanctioned 3,00,000 | Current Balance ${inr0(Math.round(plOut / 100) * 100)} | Opened 20-Dec-2025 | Status: Active | DPD (last 36 months): 0`,
  `3. Credit Card | Saffron Bank | Credit Limit 2,00,000 | Current Balance ${inr0(Math.round(statements[2].total / 100) * 100)} | Opened 14-Feb-2021 | Status: Active | DPD history: 30 days past due in Aug-2025, otherwise 0`,
  '4. Credit Card | Comet Bank | Credit Limit 50,000 | Current Balance 0 | Status: Closed (Mar-2023)',
  '',
  `CREDIT UTILISATION (cards): ${utilNow}% (previous report: 9.2%)`,
  '',
  'ENQUIRIES (last 12 months)',
  '18-Aug-2026 | Comet Bank | Credit Card',
  '02-Sep-2026 | Neem Bank | Personal Loan',
  '',
  'KEY FACTORS AFFECTING YOUR SCORE',
  '- Credit card utilisation increased',
  '- 2 new credit enquiries in the last 3 months',
  '- One 30-day late payment in the last 24 months',
  '',
].join('\n'));

// Emails (.eml-like)
const EM = (file, from, subject, date, body) => W(path.join('emails', file), `From: ${from}\nTo: rohan.mehta@example.com\nSubject: ${subject}\nDate: ${date}\nContent-Type: text/plain; charset=utf-8\n\n${body}\n`);
EM('2026-10-02_netflix_price.eml', 'Netflix <info@mailer.netflix.example>', 'Changes to your Netflix membership price', 'Fri, 02 Oct 2026 10:12:00 +0530',
  'Hi Rohan,\n\nWe are updating our prices. Your Standard plan will change from Rs 649/month to Rs 799/month starting from your next billing date, 18 October 2026.\n\nIf you would like to change your plan or cancel, visit Account settings before your billing date.\n\n- The Netflix team');
EM('2026-10-03_tarang_renewal.eml', 'Tarang Life <renewals@tarang-life.example>', 'Premium due: Tarang Smart Term Plan XXXXXX5590', 'Sat, 03 Oct 2026 09:00:00 +0530',
  'Dear Policyholder,\n\nYour annual premium of Rs 14,500.00 for policy XXXXXX5590 is due on 02-Nov-2026. Pay before the due date to keep your Rs 1 crore life cover active. A grace period of 30 days applies.\n\nTarang Life Insurance (fictional)');
EM('2026-10-06_neem_offer.eml', 'Neem Bank Offers <offers@neembank.example>', 'Rohan, you are pre-approved for a personal loan at 11.25% p.a.', 'Tue, 06 Oct 2026 11:45:00 +0530',
  'Dear Rohan,\n\nBased on your credit profile, you are pre-approved for a Neem Bank personal loan.\n\nInterest rate: 11.25% p.a. (fixed)\nLoan amount: up to Rs 5,00,000\nTenure: up to 48 months\nProcessing fee: 1% of loan amount + GST\nOffer valid till: 31-Oct-2026\n\nUse it to consolidate or transfer your existing high-interest loans.\n\nNeem Bank (fictional)');
EM('2026-10-09_cult_inactive.eml', 'cult.fit <hello@cult.example>', 'We miss you at the centre!', 'Fri, 09 Oct 2026 07:30:00 +0530',
  'Hi Rohan,\n\nYou have not booked a class since 12 July 2026. Your membership (Rs 1,999/month, auto-renewing on the 8th) is still active.\n\nBook a class today, or manage your membership from the app.\n\nTeam cult');
EM('2026-10-11_lingopro_charged.eml', 'LingoPro <billing@lingopro.example>', 'Your free trial has ended - annual plan activated', 'Sun, 11 Oct 2026 12:01:00 +0530',
  'Hi Rohan,\n\nYour 7-day free trial of LingoPro Premium has ended and your annual plan is now active. We have charged Rs 4,999.00 to your card ending 9012.\n\nChanged your mind? You can cancel within 14 days of the charge (by 25 October 2026) for a full refund by writing to billing@lingopro.example.\n\nTeam LingoPro (fictional)');
EM('2026-10-13_orbit_emi.eml', 'Orbit Finserv <noreply@orbitfinserv.example>', 'EMI reminder: loan XXXXXX7788', 'Tue, 13 Oct 2026 08:00:00 +0530',
  `Dear Customer,\n\nYour EMI of Rs ${inr(emiOf('pl'))} for personal loan XXXXXX7788 will be debited on 20-Oct-2026 from your Saffron Bank account ending 4521. Please keep sufficient balance to avoid penal charges and impact on your credit score.\n\nOrbit Finserv (fictional)`);

W('README.md', [
  '# Demo dataset (synthetic)',
  '',
  'Fictional person (Rohan Mehta, Gurugram), fictional bank, lenders, insurers and bureau. Merchant names are used only so categorisation looks realistic. Generated by `scripts/generate-demo-data.mjs`; do not edit by hand, regenerate.',
  '',
  '| File | What it is |',
  '|---|---|',
  '| bank_statement_saffron_jul-sep-2026.csv | Savings account, 1 Jul - 30 Sep 2026, running balance |',
  '| card_statement_saffron_2026-0[7-9,10].txt | 4 credit card cycles (5th to 4th), text as extracted from PDF |',
  '| sms_alerts_oct-2026.txt | Bank + card SMS for 1-15 Oct (after the statement), plus OTP/promo noise |',
  '| emails/*.eml | Price change, renewal, loan offer, gym inactivity, trial charge, EMI reminder |',
  '| loan_*.txt | Two loan sanction letters / key fact statements |',
  '| policy_*.txt | Term, family-floater health and endowment policy schedules |',
  '| credit_report_trustscore.txt | Credit report with score change, utilisation, enquiries |',
  '| expected.json | Ground truth computed by the generator; tests compare the engine against it |',
  '',
].join('\n'));

// Ground truth for tests
const expected = {
  opening: OPENING, closing: CLOSING, smsClosing: SMS_CLOSING, bankRows: bank.length,
  bankDebits: bank.reduce((s, t) => s + t.dr, 0), bankCredits: bank.reduce((s, t) => s + t.cr, 0),
  loans: Object.fromEntries(LOANS.map((l) => [l.id, { emi: l.emi, principal: R(l.principalR), rate: l.rate, n: l.n, first: l.first }])),
  outstandingSep30: { car: carOut, pl: plOut },
  cards: statements.map((s) => ({ end: s.end, due: s.due, prev: s.prev, payments: s.payments, purchases: s.purchases, credits: s.credits, total: s.total, minDue: s.minDue, rows: s.tx.length })),
  utilisationPct: utilNow,
  smsTxns: smsTx.length,
};
W('expected.json', JSON.stringify(expected, null, 2) + '\n');

console.log(JSON.stringify({ opening: inr(OPENING), closing: inr(CLOSING), smsClosing: inr(SMS_CLOSING), rows: bank.length,
  emi: LOANS.map((l) => [l.id, inr(l.emi)]), cards: statements.map((s) => [s.end, inr(s.total)]), carOut: inr(carOut), plOut: inr(plOut), util: utilNow }, null, 1));
