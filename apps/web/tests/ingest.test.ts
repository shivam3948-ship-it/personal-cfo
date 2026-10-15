import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { classify, bankTextToTxns, emailToNotice } from '@/lib/ingest/parsers';
import { bankCsvToTxns } from '@/lib/ingest/csv';
import { jsonToTxns } from '@/lib/ingest/json';
import { dedupe, ingest } from '@/lib/ingest';
import { demoFiles } from '@/lib/demo';
import { demo, expected } from './helpers';

describe('demo dataset ingestion', () => {
  it('every file parses with rules and every check passes', async () => {
    const ds = await demo();
    const failed = ds.log.flatMap((l) => (l.ok ? [] : [`${l.file}: ${l.summary}`]));
    expect(failed).toEqual([]);
    expect(ds.log.every((l) => l.parser === 'rule')).toBe(true);
    const cross = ds.log.find((l) => l.kind === 'cross-check')!;
    expect(cross.checks.length).toBeGreaterThanOrEqual(10);
    expect(cross.checks.every((c) => c.ok)).toBe(true);
  });
  it('bank statement totals match the generator', async () => {
    const ds = await demo();
    const bank = ds.txns.filter((t) => t.source === 'bank_statement');
    expect(bank.length).toBe(expected.bankRows);
    expect(bank.filter((t) => t.dir === 'debit').reduce((s, t) => s + t.amount, 0)).toBe(expected.bankDebits);
    expect(bank.filter((t) => t.dir === 'credit').reduce((s, t) => s + t.amount, 0)).toBe(expected.bankCredits);
    const acct = ds.accounts.find((a) => a.kind === 'bank')!;
    expect(acct.opening).toBe(expected.opening); expect(acct.closing).toBe(expected.closing);
  });
  it('card statements reconcile to the generator', async () => {
    const ds = await demo();
    const got = ds.cardStatements.map((s) => ({ end: s.periodEnd, total: s.totalDue, purchases: s.purchases, minDue: s.minDue }));
    expect(got).toEqual(expected.cards.map((c: { end: string; total: number; purchases: number; minDue: number }) => ({ end: c.end, total: c.total, purchases: c.purchases, minDue: c.minDue })));
  });
  it('SMS continue the statement balance; OTP/promo skipped', async () => {
    const ds = await demo();
    const sms = ds.txns.filter((t) => t.source === 'sms');
    expect(sms.length).toBe(expected.smsTxns);
    expect(sms.filter((t) => t.balance !== undefined).at(-1)!.balance).toBe(expected.smsClosing);
    expect(sms.some((t) => /otp/i.test(t.desc))).toBe(false);
  });
  it('terse SMS narrations inherit categories from statement history', async () => {
    const ds = await demo();
    const rent = ds.txns.find((t) => t.source === 'sms' && t.desc === 'UPI/RAJESH KUMAR')!;
    expect(rent.category).toBe('Rent');
    expect(rent.merchant).toBe('Person-to-person');
    expect(ds.txns.find((t) => t.source === 'sms' && t.desc === 'UPI/RAKESH MEHTA')!.category).toBe('Family support');
  });
  it('classifies every demo file correctly', () => {
    const kinds = Object.fromEntries(demoFiles().map((f) => [f.name, classify(f.name, new TextDecoder().decode(f.bytes))]));
    for (const [name, kind] of Object.entries(kinds)) {
      const want = name.endsWith('.csv') ? 'bank_csv' : name.startsWith('card_') ? 'card_statement' : name.startsWith('sms') ? 'sms' : name.startsWith('emails/') ? 'email' : name.startsWith('loan_') ? 'loan' : name.startsWith('policy_') ? 'policy' : 'credit_report';
      expect([name, kind]).toEqual([name, want]);
    }
  });
  it('emails become typed notices with extracted fields', async () => {
    const ds = await demo();
    const k = Object.fromEntries(ds.notices.filter((n) => n.file.startsWith('emails/')).map((n) => [n.kind, n.data]));
    expect(k.price_change).toMatchObject({ merchant: 'Netflix', oldPrice: 64900, newPrice: 79900, effective: '2026-10-18' });
    expect(k.trial_charge).toMatchObject({ merchant: 'LingoPro', amount: 499900, refundBy: '2026-10-25' });
    expect(k.inactivity).toMatchObject({ merchant: 'cult.fit', lastUsed: '2026-07-12' });
    expect(ds.offers[0]).toMatchObject({ lender: 'Neem Bank', ratePct: 11.25, processingFeePct: 1, gstOnFee: true, validTill: '2026-10-31' });
  });
});

describe('format coverage for unknown Saturday datasets', () => {
  it('CSV with a single amount column and a Dr/Cr type column', () => {
    const csv = 'Txn Date,Description,Amount,Type,Balance\n01-10-2026,SALARY ACME,50000,CR,60000\n02-10-2026,UPI/SWIGGY,500,DR,59500\n';
    const r = bankCsvToTxns(csv, 'x.csv');
    expect(r.txns.map((t) => [t.dir, t.amount])).toEqual([['credit', 5000000], ['debit', 50000]]);
    expect(r.checks.find((c) => c.id === 'balance_walk')!.ok).toBe(true);
  });
  it('CSV with signed amounts and no balance', () => {
    const r = bankCsvToTxns('Date,Narration,Amount\n2026-10-01,Refund,250.5\n2026-10-02,Uber,-180\n', 'y.csv');
    expect(r.txns.map((t) => [t.dir, t.amount])).toEqual([['credit', 25050], ['debit', 18000]]);
  });
  it('bank statement text (as extracted from a PDF): direction from balance delta', () => {
    const text = 'Statement of Account\nA/c No: XXXX1111\nOpening Balance: 10,000.00\n01/10/2026 SALARY CREDIT ACME 50,000.00 60,000.00\n02/10/2026 UPI/ZOMATO/order 450.00 59,550.00\nClosing Balance: 59,550.00\n';
    const r = bankTextToTxns(text, 'p.pdf');
    expect(r.txns.map((t) => [t.dir, t.amount])).toEqual([['credit', 5000000], ['debit', 45000]]);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });
  it('a PDF goes through unpdf and the text parser', async () => {
    const doc = await PDFDocument.create(); const page = doc.addPage([595, 842]); const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = ['Statement of Account', 'A/c No: XXXX2222', 'Opening Balance: 1,000.00', '03/10/2026 UPI/BLINKIT/order 200.00 800.00', '04/10/2026 REFUND MYNTRA 100.00 900.00', 'Closing Balance: 900.00'];
    lines.forEach((l, i) => page.drawText(l, { x: 40, y: 800 - i * 18, size: 11, font }));
    const bytes = await doc.save();
    const ds = await ingest([{ name: 'stmt.pdf', bytes }], 'pdf', { useLlm: false });
    const tx = ds.txns.filter((t) => t.account === 'bank:2222');
    expect(tx.map((t) => [t.dir, t.amount])).toEqual([['debit', 20000], ['credit', 10000]]);
    expect(ds.log[0].ok).toBe(true);
  });
  it('JSON arrays with flexible keys', () => {
    const tx = jsonToTxns(JSON.stringify({ data: { transactions: [{ txn_date: '2026-10-01', narration: 'NETFLIX', amount: 649, type: 'debit', account: 'XX4521' }, { date: '2026-10-02', description: 'Cashback', amount: 50, direction: 'credit' }] } }), 'd.json')!;
    expect(tx.map((t) => [t.date, t.dir, t.amount, t.account])).toEqual([['2026-10-01', 'debit', 64900, 'bank:4521'], ['2026-10-02', 'credit', 5000, 'bank:0000']]);
  });
  it('dedupe drops SMS rows already in a statement, keeping genuine repeats', () => {
    const base = { desc: 'x', account: 'bank:1', source: 'bank_statement' as const, sourceFile: 'f', dir: 'debit' as const };
    const existing = [{ ...base, id: 'a', date: '2026-10-01', amount: 100 }];
    const incoming = [{ ...base, id: 'b', date: '2026-10-01', amount: 100 }, { ...base, id: 'c', date: '2026-10-01', amount: 100 }];
    expect(dedupe(existing, incoming).map((t) => t.id)).toEqual(['c']);
  });
  it('emails: renewal is not mistaken for an EMI because "premium" contains "emi"', () => {
    const n = emailToNotice('From: Insurer <a@b.example>\nSubject: Premium due\nDate: Sat, 03 Oct 2026 09:00:00 +0530\n\nYour premium of Rs 14,500 is due on 02-Nov-2026.', 'e.eml');
    expect(n.kind).toBe('renewal'); expect(n.data.due).toBe('2026-11-02');
  });
  it('unknown text without an API key is logged, not guessed', async () => {
    const ds = await ingest([{ name: 'notes.txt', bytes: new TextEncoder().encode('random notes about nothing') }], 'u', { useLlm: true });
    expect(ds.log[0]).toMatchObject({ ok: false, parser: 'none' });
  });
});
