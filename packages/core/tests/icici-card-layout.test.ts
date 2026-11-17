import { describe, it, expect } from 'vitest';
import { detectFormat, readBank, iciciAmount } from '../src/ingest/banks';
import { emptyDataset } from '../src/types';
import { finalise } from '../src/ingest/finalise';

// D-096: the owner's real ICICI card statement (Oct 2026), rebuilt with made-up rows. Its PDF prints text twice and writes each
// amount in a scrambled font (H–P = 1–9, Q = 0) followed by a plain decoy number that is the amount ÷ 1.2.
const D = (s: string) => s + s; // ICICI prints most text twice
const LINES = [
  'CREDIT CARD STATEMENT', 'MR Example Person', 'STATEMENT DATE', 'October 18, 2026',
  'PAYMENT DUE DATE l To update mobile number, visit the nearest branch', 'November 5, 2026 Scan to Pay using',
  'Total Amount due Previous Balance Purchases / Charges Cash Advances Payments / Credits', '= + + -',
  '`2,600.00 `5,000.00 `4,400.00 `0.00 `6,800.00',
  'Minimum Amount due CREDIT SUMMARYCREDIT SUMMARY', '`130.00',
  'Credit Limit (Including cash) Available Credit (Including cash) Cash Limit Available Cash', 'Interest will be charged if your', 'total amount due is not paid',
  '`2,00,000.00 `1,97,400.00 `20,000.00 `20,000.00',
  D('4111XXXXXXXX1234'),
  `${D('20/09/2026')} 11111111111 ${D('EXAMPLE AI SUB')} ${D('40')} ${D('10 USD')} H,QQQ.QQ833.33`, // ₹1,000 shown as 833.33
  D('EXAMPLE.COM US*'),
  `${D('24/09/2026')} 22222222222 ${D('EXAMPLE TRAVEL PVT LTD GURGAON IN')} ${D('-36')} H,OQQ.QQ1500.00 ${D('CR')}`, // ₹1,800 refund, shown as 1,500.00
  `17% ${D('05/10/2026')} 33333333333 ${D('CLICK TO PAY PAYMENT RECEIVED')} ${D('0')} L,QQQ.QQ4166.67 ${D('CR')}`,
  `${D('10/10/2026')} 44444444444 ${D('EXAMPLE STORE BANGALORE IN')} ${D('48')} I,LQQ.QQ2083.33`,
  `${D('17/10/2026')} 55555555555 ${D('EXAMPLE AI SUB')} ${D('36')} ${D('10.50')} PQQ.QQ750.00`, // ₹900, "USDUSD" on the next line
  `${D('EXAMPLE.COM US*')} ${D('USD')}`,
  'Statement period : September 19, 2026 to October 18, 2026 1/1',
  'l Mark-up fee and corresponding GST levied is included in the transaction amount displayed.',
  'ICICI Bank Credit Card GST Number', 'Invoice No: 99999 Page 1 of 9',
];

describe('ICICI card in its real layout (D-096)', () => {
  const r = readBank(LINES, 'icici.pdf')!;
  it('decodes the scrambled amounts, not the decoy digits, and every total reconciles', () => {
    expect(iciciAmount('I,LQQ.QQ')).toBe(250000);
    expect(iciciAmount('2083.33')).toBeNull();
    expect(detectFormat(LINES)).toBe('icici_card');
    expect(r.txns.map((t) => [t.amount, t.dir])).toEqual([[100000, 'debit'], [180000, 'credit'], [500000, 'credit'], [250000, 'debit'], [90000, 'debit']]);
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.stmt).toMatchObject({ periodStart: '2026-09-19', periodEnd: '2026-10-18', dueDate: '2026-11-05', totalDue: 260000, minDue: 13000, limit: 20000000, available: 19740000, creditsInPayments: true });
    expect(r.account.last4).toBe('1234');
  });
  it('reads names once, without reward points, and keeps the amount charged abroad', () => {
    expect(r.txns.map((t) => t.desc)).toEqual(['EXAMPLE AI SUB', 'EXAMPLE TRAVEL PVT LTD GURGAON IN', 'CLICK TO PAY PAYMENT RECEIVED', 'EXAMPLE STORE BANGALORE IN', 'EXAMPLE AI SUB']);
    expect(r.txns[0].fx).toEqual({ currency: 'USD', minor: 1000 });
    expect(r.txns[4].fx).toEqual({ currency: 'USD', minor: 1050 });
    expect(r.txns[3].fx).toBeUndefined();
  });
  it('a merchant credit counted in "Payments / Credits" stays a refund; the worded payment is the bill payment', () => {
    const ds = { ...emptyDataset(), accounts: [r.account], cardStatements: [r.stmt!], txns: r.txns }; finalise(ds);
    const cat = (re: RegExp) => ds.txns.find((t) => re.test(t.desc))!.category;
    expect(cat(/EXAMPLE TRAVEL/)).toBe('Refund');
    expect(cat(/CLICK TO PAY/)).toBe('Card bill payment');
  });
});

describe('the hidden mark-up on foreign purchases (D-096)', async () => {
  const { cardForex } = await import('../src/finance/forex');
  const r = readBank(LINES, 'icici.pdf')!;
  const ds = { ...emptyDataset(), accounts: [r.account], cardStatements: [r.stmt!], txns: r.txns }; finalise(ds);
  it('adds up the rupees paid on USD rows and takes the published 3.5% + 18% GST out of them', () => {
    const [f] = cardForex(ds);
    expect(f).toMatchObject({ account: 'card:1234', rows: 2, paid: 190000, currencies: ['USD'] });
    // ₹1,900 includes the fee: 1,900 × 413 / 10,413 = ₹75.36
    expect(f.fee).toMatchObject({ amount: 7536, bp: 413 });
  });
  it('a card whose bank has no listed rate gets no estimate', () => {
    const other = { ...ds, accounts: [{ ...r.account, label: 'Example Bank credit card ••1234' }] };
    expect(cardForex(other)[0].fee).toBeNull();
  });
});
