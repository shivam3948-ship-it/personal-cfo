import { describe, expect, it } from 'vitest';
import { readBankSms, readOneSms, smsDate, smsFromBackupXml, splitPasted } from '@core/ingest/sms';
import { categorizeAll } from '@core/finance/categorize';
import { counterpartyNames } from '@core/privacy/counterparties';
import { forLlm } from '@core/privacy/forLlm';

// Synthetic alerts in the shapes common Indian bank SMS take (made-up people, accounts and amounts). ⚠ The wording
// is modelled on public examples, not copied from real messages; real SMS from each bank still need a check.
const MSGS = [
  'Sent Rs.250.00 From HDFC Bank A/C *4521 To RAMESH STORES On 24/10/26 Ref 123456789012 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808',
  'Dear UPI user A/C X7788 debited by 120.0 on date 25Oct26 trf to ASHA KIRANA Refno 612345678901 If not u? call 1800111109 for other services-18001234-SBI',
  'ICICI Bank Acct XX903 debited for Rs 1,499.00 on 25-Oct-26; NETFLIX credited. UPI:612399990000. Call 18002662 for dispute. SMS BLOCK 903 to 9215676766.',
  'INR 3,000.00 credited to A/c no. XX6612 on 23-10-26 by NEFT from SUNITA DEVI. Avl Bal INR 12,450.50 -Axis Bank',
  'Received Rs.500.00 in your Kotak Bank AC X3301 from asha@ybl on 22-10-26.UPI Ref:612300001111.',
  'An amount of INR 2,000.00 has been DEBITED to your account XXX1234 on 21/10/2026 towards ATM withdrawal. Total Avail.Bal INR 8,000.00 - Canara Bank',
  'Rs.799.00 spent on your SBI Credit Card ending 5566 at SWIGGY on 20/10/26. Trxn. not done by you? Report at https://example.test',
  'Your OTP for transaction of Rs 5,000 is 482913. Do not share it with anyone. -HDFC Bank',
  'Rs 1,200 will be debited from your A/c XX4521 on 05-11-26 towards your EMI. Keep sufficient balance.',
  'Your UPI payment of Rs.300.00 to ZOMATO failed. Money if debited will be refunded in 3 days.',
  'Get a pre-approved personal loan up to Rs 2,00,000 at 10.5%! Apply now.',
];

describe('bank SMS on the phone (D-055)', () => {
  it('reads the money alerts and skips OTPs, reminders, failures and offers', () => {
    const r = readBankSms(MSGS.map((body) => ({ body })), 'paste', '2026-10-26');
    expect(r.txns.map((t) => [t.account, t.date, t.dir, t.amount])).toEqual([
      ['card:5566', '2026-10-20', 'debit', 79900],
      ['bank:1234', '2026-10-21', 'debit', 200000],
      ['bank:3301', '2026-10-22', 'credit', 50000],
      ['bank:6612', '2026-10-23', 'credit', 300000],
      ['bank:4521', '2026-10-24', 'debit', 25000],
      ['bank:7788', '2026-10-25', 'debit', 12000],
      ['bank:903', '2026-10-25', 'debit', 149900],
    ]);
    expect(r.skipped).toEqual({ otp: 1, notMoney: 3, unreadable: 0, duplicate: 0 });
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.banks).toEqual(expect.arrayContaining(['HDFC Bank', 'SBI', 'ICICI Bank', 'Axis Bank', 'Kotak', 'Canara Bank']));
  });
  it('keeps the balance only from the balance part, never as the amount', () => {
    const t = readBankSms([{ body: MSGS[3] }], 'p', '2026-10-26').txns[0];
    expect([t.amount, t.balance]).toEqual([300000, 1245050]);
  });
  it('names the other side and the rail, so categories and redaction work', () => {
    const r = readBankSms(MSGS.map((body) => ({ body })), 'p', '2026-10-26');
    const d = Object.fromEntries(r.txns.map((t) => [t.account, t.desc]));
    expect(d['bank:4521']).toBe('UPI/RAMESH STORES');
    expect(d['bank:7788']).toBe('UPI/ASHA KIRANA');
    expect(d['bank:903']).toBe('UPI/NETFLIX');
    expect(d['bank:6612']).toBe('NEFT/SUNITA DEVI');
    expect(d['bank:3301']).toBe('UPI/asha@ybl');
    expect(d['bank:1234']).toBe('ATM withdrawal');
    expect(d['card:5566']).toBe('SWIGGY');
  });
  it('a message missing a part is not used, and nothing is guessed', () => {
    expect(readOneSms({ body: 'Rs 500 debited from your account. Thank you.' })).toEqual({ skip: 'unreadable' }); // no account ending, no date
    const noDate = readOneSms({ body: 'Rs 500 debited from A/c XX4521 for UPI/TEA STALL.' });
    expect(noDate).toEqual({ skip: 'unreadable' });
    const withReceived = readOneSms({ body: 'Rs 500 debited from A/c XX4521 for UPI/TEA STALL.', at: '2026-10-25' });
    expect('txn' in withReceived && withReceived.txn.date).toBe('2026-10-25'); // the phone's received date when the text has none
  });
  it('the same message pasted twice counts once; future dates are flagged and dropped', () => {
    const r = readBankSms([{ body: MSGS[0] }, { body: MSGS[0] }], 'p', '2026-10-26');
    expect(r.txns).toHaveLength(1); expect(r.skipped.duplicate).toBe(1);
    const f = readBankSms([{ body: MSGS[0].replace('24/10/26', '24/12/26') }], 'p', '2026-10-26');
    expect(f.txns).toHaveLength(0); expect(f.checks.find((c) => c.id === 'future')!.ok).toBe(false);
  });
  it('a gap in balances is reported, not used to reject', () => {
    const a = 'INR 100.00 debited from A/c XX4521 on 20-10-26 for UPI/A. Avl Bal INR 900.00';
    const b = 'INR 100.00 debited from A/c XX4521 on 22-10-26 for UPI/B. Avl Bal INR 700.00'; // one message missing between
    const r = readBankSms([{ body: a }, { body: b }], 'p', '2026-10-26');
    expect(r.txns).toHaveLength(2);
    expect(r.checks.find((c) => c.id === 'balances')!.detail).toMatch(/1 gap/);
  });
  it('dates in every common shape, and impossible dates refused', () => {
    expect(['on 24/10/26', 'on 24-10-2026', 'on 24.10.26', 'on 24-Oct-26', 'on 24 Oct 2026', 'on 24Oct26', 'on 2026-10-24'].map(smsDate)).toEqual(Array(7).fill('2026-10-24'));
    expect(smsDate('on 31/02/26')).toBeNull();
  });
  it('pasted text splits by blank lines, else by line; backup XML keeps received messages only', () => {
    expect(splitPasted('a b\nc\n\nd e')).toEqual([{ body: 'a b c' }, { body: 'd e' }]);
    expect(splitPasted('one\ntwo\n')).toEqual([{ body: 'one' }, { body: 'two' }]);
    const xml = `<?xml version="1.0"?><smses count="2"><sms protocol="0" address="VM-HDFCBK" date="1761300000000" type="1" body="${MSGS[0].replace(/&/g, '&amp;')}" /><sms address="+91XXXXXXXXXX" date="1761300000000" type="2" body="sent by me" /></smses>`;
    const msgs = smsFromBackupXml(xml);
    expect(msgs).toHaveLength(1); expect(msgs[0].sender).toBe('VM-HDFCBK'); expect(msgs[0].at).toMatch(/^2025-10-2\d$/);
  });
  it('people named in SMS never reach the AI: names are collected for redaction, handles and rails collapse', () => {
    const tx = categorizeAll(readBankSms(MSGS.map((body) => ({ body })), 'p', '2026-10-26').txns);
    const names = counterpartyNames(tx);
    expect(names).toEqual(expect.arrayContaining(['SUNITA DEVI', 'RAMESH STORES', 'ASHA KIRANA']));
    const sent = JSON.stringify(forLlm(tx.map((t) => ({ desc: t.desc, amount: t.amount })), names));
    expect(sent).not.toMatch(/SUNITA|asha@ybl|RAMESH/);
  });
});
