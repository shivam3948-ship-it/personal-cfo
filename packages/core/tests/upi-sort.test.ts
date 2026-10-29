// Sorting UPI without asking (D-078): who was paid, read from the narration on the phone. Synthetic narrations shaped like
// real SBI and HDFC lines (names and handles invented).
import { describe, expect, it } from 'vitest';
import { categorize, upiPayee } from '../src/finance/categorize';
import { regularPayments } from '../src/ingest/finalise';
import { emptyDataset, type Txn } from '../src/types';
import { finalise } from '../src/ingest/finalise';

const d = (desc: string) => categorize({ desc, dir: 'debit' });

describe('UPI payee type', () => {
  it('SBI: phone-number handle (cut short, no @) is a person; a QR handle or a shop word is a shop', () => {
    expect(upiPayee('UPI/DR/612345678901/RAMESH K/SBIN/9876543210/UPI')).toBe('person');
    expect(upiPayee('UPI/DR/612345678901/RAMESH K/SBIN/ramesh.k1/UPI')).toBe('person');
    expect(upiPayee('UPI/DR/612345678901/GUPTA GENERAL/YESB/paytmqr2810/UPI')).toBe('shop');
    expect(upiPayee('UPI/DR/612345678901/SHARMA MEDICAL/BARB/sharma12/UPI')).toBe('shop');
    expect(upiPayee('UPI/DR/612345678901/A KUMAR/ICIC/q48213907@ybl/UPI')).toBe('shop');
  });
  it('HDFC: UPI-NAME-handle@bank-…', () => {
    expect(upiPayee('UPI-PRIYA VERMA-9812345678@ybl-HDFC0001234-612345678901-SENT')).toBe('person');
    expect(upiPayee('UPI-JAI MATA DI STORES-bharatpe.90123@fbpe-YESB0000001-612345678901-PAY')).toBe('shop');
  });
  it('not UPI, or nothing to go on: no guess', () => {
    expect(upiPayee('NEFT*EMPLOYER PVT LTD*SALARY')).toBeNull();
    expect(upiPayee('UPI/DR/612345678901/X1/SBIN/ab12cd34ef/UPI')).toBeNull();
  });
  it('categories: people stay unsorted (who, not what for); shops are everyday; word rules still win', () => {
    expect(d('UPI/DR/1/RAMESH K/SBIN/9876543210/UPI')).toBe('Paid to people');
    expect(d('UPI/DR/1/GUPTA GENERAL/YESB/paytmqr2810/UPI')).toBe('Shops & businesses');
    expect(d('UPI/DR/1/Swiggy/ICIC/swiggy@icici/UPI')).toBe('Food delivery');
    expect(d('UPI/DR/1/MAA/SBIN/9876543210/UPI')).toBe('Family support');
    expect(d('UPI/DR/1/SELF/HDFC/9876543210/own a/c')).toBe('Self transfer');
    expect(categorize({ desc: 'UPI/CR/1/RAMESH K/SBIN/9876543210/UPI', dir: 'credit' })).toBe('Other income'); // money in is not "paid to"
  });
  it('an FD sweep is your own money moving; a CBDT payment is tax', () => {
    expect(d('SWEEP TFR DR 00000000000 AT 12345 PBB TOWN')).toBe('Self transfer');
    expect(d('DIRECT T 00000000000 OF CBDT TIN 2.0 POOLING A AT')).toBe('Tax');
  });
});

describe('regular payments', () => {
  const acc = 'bank:1111';
  const tx = (id: string, date: string, name: string, rupees: number): Txn => ({ id, date, desc: `UPI/DR/${id}/${name}/SBIN/9876543210/UPI`, amount: rupees * 100, dir: 'debit', account: acc, source: 'bank_statement', sourceFile: 's.pdf' });
  const run = (txns: Txn[]) => { const ds = { ...emptyDataset('x'), accounts: [{ id: acc, kind: 'bank' as const, last4: '1111', label: 'b' }], txns }; finalise(ds); return ds.txns; };
  it('same person, about the same amount, two months running: a regular payment (rent, maid, tuition)', () => {
    const t = run([tx('1', '2026-08-03', 'RAMESH K', 8000), tx('2', '2026-09-02', 'RAMESH K', 8200), tx('3', '2026-09-15', 'PRIYA V', 1500)]);
    expect(t.filter((x) => x.category === 'Regular payments').map((x) => x.id)).toEqual(['1', '2']);
    expect(t.find((x) => x.id === '3')!.category).toBe('Paid to people');
  });
  it('not regular: one month only, very different amounts, small amounts, or twice in a month', () => {
    const cats = (xs: Txn[]) => run(xs).map((x) => x.category);
    expect(cats([tx('1', '2026-09-03', 'RAMESH K', 8000), tx('2', '2026-09-20', 'RAMESH K', 8000)])).not.toContain('Regular payments');
    expect(cats([tx('1', '2026-08-03', 'RAMESH K', 8000), tx('2', '2026-09-03', 'RAMESH K', 3000)])).not.toContain('Regular payments');
    expect(cats([tx('1', '2026-08-03', 'CHAI WALA', 300), tx('2', '2026-09-03', 'CHAI WALA', 300)])).not.toContain('Regular payments');
  });
  it('is exported for reuse and leaves other categories alone', () => {
    const ds = { ...emptyDataset('x'), txns: [{ ...tx('1', '2026-08-03', 'RAMESH K', 8000), category: 'Food delivery', merchant: 'RAMESH K' }, { ...tx('2', '2026-09-03', 'RAMESH K', 8000), category: 'Food delivery', merchant: 'RAMESH K' }] };
    regularPayments(ds);
    expect(ds.txns.map((x) => x.category)).toEqual(['Food delivery', 'Food delivery']);
  });
});

describe('review fixes (29 Oct)', () => {
  it('regular payments need months in a row', async () => {
    const acc = 'bank:1111';
    const tx = (id: string, date: string): Txn => ({ id, date, desc: `UPI/DR/${id}/RAMESH K/SBIN/9876543210/UPI`, amount: 800000, dir: 'debit', account: acc, source: 'bank_statement', sourceFile: 's.pdf' });
    const ds = { ...emptyDataset('x'), txns: [tx('1', '2026-08-03'), tx('2', '2026-10-03')] }; finalise(ds);
    expect(ds.txns.map((x) => x.category)).toEqual(['Paid to people', 'Paid to people']);
  });
  it('a business name with a common first word is still masked before any AI sees it', async () => {
    const { counterpartyNames } = await import('../src/privacy/counterparties');
    const t: Txn = { id: '1', date: '2026-09-01', desc: 'UPI/DR/5/INDIA GATE STORES/SBIN/igs12/UPI', amount: 10000, dir: 'debit', account: 'bank:1', source: 'bank_statement', sourceFile: 's.pdf', category: 'Shops & businesses', merchant: 'INDIA GATE STORES' };
    expect(counterpartyNames([t])).toContain('INDIA GATE STORES');
    expect(counterpartyNames([{ ...t, desc: 'NEFT Payment for rent', merchant: 'Payment for rent', category: 'Rent' }])).not.toContain('Payment for rent');
  });
});
