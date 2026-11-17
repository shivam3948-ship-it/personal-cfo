import { describe, expect, it } from 'vitest';
import { readBank, detectFormat } from '@core/ingest/banks';

// Synthetic statements in each bank's layout (as rebuilt by pdfLines). Made-up people, merchants and amounts; the layouts
// match the real statements the readers were verified on (on the owner's Mac; only pass/fail left the device).
const HDFC = [
  'Page No .: 1', 'Account Branch : Example Branch', 'Account No : 50100012345678 OTHER', 'From : 01/09/2026 To : 30/09/2026 Statement of account',
  'Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance',
  '01/09/26 UPI-SWIGGY-SWIGGY@AXIS 0000123456789012 01/09/26 450.00 9,550.00', 'UPI-REF-123',
  '03/09/26 NEFT CR-EXAMPLE EMPLOYER 0000123456789013 03/09/26 50,000.00 59,550.00',
  '05/09/26 ACH D- EXAMPLE MF SIP 0000123456789014 05/09/26 5,000.00 54,550.00',
  'Page No .: 2', 'Account Branch : Example Branch', 'From : 01/09/2026 To : 30/09/2026 Statement of account',
  '10/09/26 UPI-ZOMATO-ZOMATO@HDFC 0000123456789015 10/09/26 1,200.00 53,350.00', 'PAYMENT FROM PHONE',
  'STATEMENT SUMMARY :-', 'Opening Balance Dr Count Cr Count Debits Credits Closing Bal', '10,000.00 3 1 6,650.00 50,000.00 53,350.00',
];
const SBI = [
  'STATEMENT OF ACCOUNT', 'Account Number : 00000012345678', 'Statement From : 01-08-2026 to 31-08-2026',
  '02/08/2026 02/08/2026 UPI/DR/612345678901/EXAMPLE SHOP - 1,500.00 - 18,500.00', '/YBL/shop@ybl', '1234567890123 OF 00000 UPI',
  '05/08/2026 05/08/2026 NEFT*EXAMPLE CO*N1234567 - - 25,000.00 43,500.00',
  'Page no. 1', 'Balance',
  '09/08/2026 09/08/2026 UPI/DR/612345678902/EXAMPLE CAB - 350.00 - 43,150.00',
  'Statement Summary : 01-08-2026 To 31-08-2026', 'Brought Forward ( ) Dr Count Cr Count Total Debits( ) Total Credits( ) Closing Balance ( )',
  '20,000.00CR 2 1 1,850.00 25,000.00 43,150.00CR',
];
const CARD = [
  'Example Bank Credit Card Statement', 'Credit Card No. 412345XXXXXX8747', 'Statement Date 16 Sep, 2026', 'Billing Period 17 Aug, 2026 - 16 Sep, 2026',
  'PREVIOUS STATEMENT DUES PAYMENTS/CREDITS PURCHASES/DEBIT FINANCE CHARGES TOTAL AMOUNT DUE',
  'C10,000.00 C10,050.00 + C2,450.00 + C0.00 = C2,400.00',
  'TOTAL CREDIT LIMIT AVAILABLE CREDIT LIMIT AVAILABLE CASH LIMIT MINIMUM DUE DUE DATE', 'C200.00 05 Oct, 2026',
  'Domestic Transactions', 'DATE & TIME TRANSACTION DESCRIPTION AMOUNT PI',
  '18/08/2026| 20:15 SWIGGY BANGALORE C 650.00 l',
  '20/08/2026| 10:00 BBPS PAYMENT RECEIVED (Ref# ST123456789) + C 10,000.00 l',
  '25/08/2026| 13:30 AMAZON PAY INDIA C 1,800.00 l',
  '01/09/2026| 09:00 10% SWIGGY CashBack + C 50.00 l',
];
const CANARA = [
  'Statement for A/c XXXXXXXX4321 between 01-Jul-2026 and 31-Jul-2026', 'Customer Id 123 Branch Code 0001', 'Name EXAMPLE PERSON Branch Name EXAMPLE',
  'Date Particulars Deposits Withdrawals Balance', 'Opening Balance 10,000.00',
  'UPI/DR/600000000001/SWIGGY', 'LIMITED/YESB/**swiggy@ybl/UPI//', 'ref0001',
  '02-07-2026 note0001/02/07/2026 450.00 9,550.00', '10:15:00', 'Chq: 600000000001',
  'UPI/CR/600000000002/EXAMPLE', 'EMPLOYER/HDFC/**pay@hdfc', '/SALARY',
  '05-07-2026 40,000.00 49,550.00', 'ref0002/05/07/2026', '09:00:00', 'Chq: 600000000002',
  'page 1', '', 'Date Particulars Deposits Withdrawals Balance',
  'UPI/DR/600000000003/EXAMPLE CAB/AXIS/**cab@axis/UPI//', 'ref0003',
  '09-07-2026 ref0003/09/07/2026 350.00 49,200.00', '/2026 18:20:00', 'Chq: 600000000003',
  'Closing Balance 49,200.00', 'TERMS AND CONDITIONS APPLY', 'page 2',
];
const AXIS = [
  'Axis Bank Example Credit Card Statement', 'EXAMPLE PERSON', '123 EXAMPLE ROAD, EXAMPLE CITY',
  'Card No 123456 Credit Card Number: 4321XXXXXXXX9876', 'Payment Summary', 'Total Payment Due Minimum Payment Due Payment Due Date',
  "₹ 2,150.00 ₹ 200.00 08 Aug '26", 'Your Statement Month Credit Limit Opening Balance', 'Jul 2026 ₹ 1,00,000.00 ₹ 5,000.00',
  'Transaction Summary', 'Date Transaction Details Amount (INR) Debit/Credit',
  'BBPS Payment Received -', "02 Jul '26 ₹ 5,000.00 Credit", 'ref123456789',
  "05 Jul '26 SWIGGY LIMITED,BANGALORE ₹ 650.00 Debit",
  "10 Jul '26 AMAZON PAY INDIA,BENGALURU ₹ 1,600.00 Debit",
  "15 Jul '26 REFUND AMAZON,Bengaluru ₹ 100.00 Credit",
  'End of Transaction Details', 'Page 1 of 1',
];

describe('bank and card statement readers', () => {
  it('detects each layout', () => {
    expect(detectFormat(HDFC)).toBe('hdfc_savings'); expect(detectFormat(SBI)).toBe('sbi_savings'); expect(detectFormat(CARD)).toBe('hdfc_card');
    expect(detectFormat(CANARA)).toBe('canara_savings'); expect(detectFormat(AXIS)).toBe('axis_card');
    expect(detectFormat(['Consolidated Account Statement'])).toBeNull();
  });
  it('HDFC savings: debit vs credit from the balance walk, every check passes, wrapped narration joined', () => {
    const r = readBank(HDFC, 'h.pdf')!;
    expect(r.txns.map((t) => [t.date, t.dir, t.amount])).toEqual([['2026-09-01', 'debit', 45000], ['2026-09-03', 'credit', 5000000], ['2026-09-05', 'debit', 500000], ['2026-09-10', 'debit', 120000]]);
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.txns[3].desc).toContain('PAYMENT FROM PHONE');
    expect(r.txns[0].desc).not.toContain('Page No');
    expect(r.account).toMatchObject({ last4: '5678', kind: 'bank' });
  });
  it('SBI savings: "-" columns, CR balances, page furniture skipped', () => {
    const r = readBank(SBI, 's.pdf')!;
    expect(r.txns.map((t) => [t.dir, t.amount])).toEqual([['debit', 150000], ['credit', 2500000], ['debit', 35000]]);
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.txns[0].desc).toContain('/YBL/shop@ybl');
    expect(r.account.last4).toBe('5678');
  });
  it('HDFC card: "+" rows are credits, the due equation and row totals reconcile', () => {
    const r = readBank(CARD, 'c.pdf')!;
    expect(r.txns.map((t) => [t.dir, t.amount])).toEqual([['debit', 65000], ['credit', 1000000], ['debit', 180000], ['credit', 5000]]);
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.stmt).toMatchObject({ totalDue: 240000, minDue: 20000, dueDate: '2026-10-05', periodStart: '2026-08-17', periodEnd: '2026-09-16' });
    expect(r.account.last4).toBe('8747');
    expect(r.txns[1].desc).not.toMatch(/Ref#/);
  });
  it('Canara savings: multi-line rows end at "Chq:", direction from the balance walk, page furniture skipped', () => {
    const r = readBank(CANARA, 'k.pdf')!;
    expect(r.txns.map((t) => [t.date, t.dir, t.amount])).toEqual([['2026-07-02', 'debit', 45000], ['2026-07-05', 'credit', 4000000], ['2026-07-09', 'debit', 35000]]);
    expect(r.checks.map((c) => [c.id, c.ok])).toEqual([['walk', true], ['closing', true], ['dates', true], ['in_period', true], ['order', true]]);
    expect(r.txns[0].desc).toContain('swiggy@ybl');
    expect(r.txns[1].desc).toMatch(/EMPLOYER/);
    expect(r.txns.map((t) => t.desc).join(' ')).not.toMatch(/Chq:|page \d|\d{2}:\d{2}:\d{2}|Particulars/);
    expect(r.period).toEqual({ from: '2026-07-01', to: '2026-07-31' });
    expect(r.account).toMatchObject({ last4: '4321', kind: 'bank', opening: 1000000, closing: 4920000 });
  });
  it('Axis card: payment row split over three lines, city dropped, opening + debits − credits = total due', () => {
    const r = readBank(AXIS, 'a.pdf')!;
    expect(r.txns.map((t) => [t.date, t.dir, t.amount, t.desc])).toEqual([
      ['2026-07-02', 'credit', 500000, 'BBPS Payment Received'], ['2026-07-05', 'debit', 65000, 'SWIGGY LIMITED'],
      ['2026-07-10', 'debit', 160000, 'AMAZON PAY INDIA'], ['2026-07-15', 'credit', 10000, 'REFUND AMAZON']]);
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.stmt).toMatchObject({ totalDue: 215000, minDue: 20000, dueDate: '2026-08-08', prevBalance: 500000 });
    expect(r.account.last4).toBe('9876');
  });
  it('a broken statement fails its checks instead of passing quietly', () => {
    expect(readBank(CANARA.filter((l) => !l.startsWith('05-07-2026')), 'k.pdf')!.checks.some((c) => !c.ok)).toBe(true);
    expect(readBank(AXIS.filter((l) => !l.startsWith("10 Jul")), 'a.pdf')!.checks[0].ok).toBe(false);
    const r = readBank(HDFC.filter((l) => !l.startsWith('05/09/26')), 'h.pdf')!;
    expect(r.checks.find((c) => c.id === 'counts')!.ok).toBe(false);
    expect(r.checks.find((c) => c.id === 'walk')!.ok).toBe(false);
  });
});
