// A card bill paid from the bank appears twice: as a debit in the bank statement and as "payment received" on the card
// statement. If the bank side isn't recognised (UPI via CRED, IB BILLPAY…), it is counted as spending on top of the card
// purchases. finalise() pairs them by amount and date (±3 days) and re-labels only an unambiguous bank debit.
import { describe, expect, it } from 'vitest';
import { finalise } from '../src/ingest/finalise';
import { emptyDataset, type Dataset, type Txn } from '../src/types';
import { CATEGORIES } from '../src/finance/categorize';

const tx = (id: string, account: string, date: string, desc: string, rupees: number, dir: Txn['dir'], source: Txn['source']): Txn =>
  ({ id, account, date, desc, amount: rupees * 100, dir, source, sourceFile: 'synthetic' });

function data(bankRows: Txn[]): Dataset {
  const ds = emptyDataset('synthetic');
  ds.accounts.push({ id: 'bank:4521', kind: 'bank', last4: '4521', label: 'Bank ••4521' }, { id: 'card:9012', kind: 'card', last4: '9012', label: 'Card ••9012' });
  ds.cardStatements.push({ account: 'card:9012', file: 'synthetic', periodStart: '2026-09-15', periodEnd: '2026-10-14', dueDate: '2026-11-03', prevBalance: 1200000, payments: 1200000, purchases: 450000, credits: 0, charges: 0, totalDue: 450000, minDue: 22500 });
  ds.txns.push(
    tx('b0', 'bank:4521', '2026-09-30', 'OPENING SALARY CREDIT', 40000, 'credit', 'bank_statement'),
    ...bankRows,
    tx('b9', 'bank:4521', '2026-10-20', 'UPI/ASHA KIRANA/groceries', 900, 'debit', 'bank_statement'),
    tx('c1', 'card:9012', '2026-10-06', 'PAYMENT RECEIVED - THANK YOU', 12000, 'credit', 'card_statement'),
    tx('c2', 'card:9012', '2026-10-08', 'SWIGGY BANGALORE', 4500, 'debit', 'card_statement'),
  );
  return ds;
}
const group = (c?: string) => (CATEGORIES as Record<string, { group: string }>)[c ?? '']?.group;

describe('finalise: card bill paid from the bank', () => {
  it('re-labels an unrecognised bank debit that matches the card payment, so it is not spending', () => {
    const ds = data([tx('b1', 'bank:4521', '2026-10-05', 'UPI/CRED CLUB/cred.club@axisb/Payment', 12000, 'debit', 'bank_statement')]);
    finalise(ds);
    const bank = ds.txns.find((t) => t.id === 'b1')!;
    expect(bank.category).toBe('Card bill payment'); expect(bank.matched).toBe('card_payment'); expect(group(bank.category)).toBe('non_spend');
    const check = ds.log.find((l) => l.kind === 'cross-check')!.checks!.find((c) => c.id === 'card_payment_match')!;
    expect(check.ok).toBe(true); expect(check.detail).toContain('matched by amount and date');
    expect(ds.txns.find((t) => t.id === 'b9')!.category).not.toBe('Card bill payment'); // other debits untouched
  });
  it('leaves an ambiguous match alone and says the check failed', () => {
    const ds = data([tx('b1', 'bank:4521', '2026-10-05', 'UPI/RAMESH/rent share', 12000, 'debit', 'bank_statement'), tx('b2', 'bank:4521', '2026-10-07', 'UPI/CRED CLUB/pay', 12000, 'debit', 'bank_statement')]);
    finalise(ds);
    expect(ds.txns.filter((t) => t.matched)).toEqual([]);
    expect(ds.log.find((l) => l.kind === 'cross-check')!.checks![0].ok).toBe(false);
  });
  it('a card-side payment read as income is re-labelled when it adds up to the statement’s payments total', () => {
    const ds = data([tx('b1', 'bank:4521', '2026-10-05', 'UPI/CRED CLUB/pay', 12000, 'debit', 'bank_statement')]);
    const card = ds.txns.find((t) => t.id === 'c1')!; card.desc = 'BPPY CC PAYMENT DP01234 (Ref# 000)';
    ds.txns.push(tx('c3', 'card:9012', '2026-10-09', 'CASHBACK 1% ON SPENDS', 45, 'credit', 'card_statement'));
    finalise(ds);
    expect(ds.txns.find((t) => t.id === 'c1')!.category).toBe('Card bill payment');
    expect(ds.txns.find((t) => t.id === 'c3')!.category).toBe('Cashback');
    expect(ds.txns.find((t) => t.id === 'b1')!.category).toBe('Card bill payment'); // and then its bank side pairs
  });
  it('an unworded card credit is re-labelled only when it adds up to the printed payments total', () => {
    const ds = data([]); const c = ds.txns.find((t) => t.id === 'c1')!; c.desc = 'DP01234 REF 998877';
    finalise(ds);
    expect(ds.txns.find((t) => t.id === 'c1')!.category).toBe('Card bill payment');
    const ds2 = data([]); ds2.cardStatements[0].payments = 999900; ds2.txns.find((t) => t.id === 'c1')!.desc = 'DP01234 REF 998877';
    finalise(ds2); // finalise re-categorises into new objects: look rows up again
    expect(ds2.txns.find((t) => t.id === 'c1')!.category).not.toBe('Card bill payment');
  });
  it('a merchant refund on the card is not taken for a bill payment', () => {
    const ds = data([]); ds.txns.push(tx('c4', 'card:9012', '2026-10-10', 'AMAZON REFUND ORDER 4412', 799, 'credit', 'card_statement'));
    finalise(ds);
    expect(ds.txns.find((t) => t.id === 'c4')!.category).toBe('Refund');
  });
  it('does not re-label anything outside ±3 days', () => {
    const ds = data([tx('b1', 'bank:4521', '2026-10-01', 'UPI/CRED CLUB/pay', 12000, 'debit', 'bank_statement')]);
    finalise(ds);
    expect(ds.txns.find((t) => t.id === 'b1')!.matched).toBeUndefined();
  });
});

describe('bank-side card bill words', () => {
  it.each(['UPI/123456/CC PAYMENT/hdfcbank', 'UPI-AXIS CC-axisbank@okaxis', 'IB BILLPAY DR-HDFC CREDIT CARD', 'NEFT DR-CREDITCARD PAYMENT'])('%s is a card bill payment', (desc) => {
    const ds = emptyDataset('x'); ds.txns.push(tx('b', 'bank:1', '2026-10-01', desc, 5000, 'debit', 'bank_statement')); finalise(ds);
    expect(ds.txns[0].category).toBe('Card bill payment');
  });
  it.each(['UPI/ACCENTURE CANTEEN/lunch', 'UPI/SUCCESS TUITION/fee'])('%s is not', (desc) => {
    const ds = emptyDataset('x'); ds.txns.push(tx('b', 'bank:1', '2026-10-01', desc, 5000, 'debit', 'bank_statement')); finalise(ds);
    expect(ds.txns[0].category).not.toBe('Card bill payment');
  });
});
