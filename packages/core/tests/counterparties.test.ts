import { describe, expect, it } from 'vitest';
import { categorizeAll } from '../src/finance/categorize';
import { counterpartyNames } from '../src/privacy/counterparties';
import { forLlm } from '../src/privacy/forLlm';
import type { Txn } from '../src/types';

// Compliance review (D-050): payee and sender names come in many narration shapes; none may reach the AI.
const rows = (descs: [string, 'debit' | 'credit'][]) => categorizeAll(descs.map(([desc, dir], i) => ({ id: String(i), date: '2026-10-01', desc, amount: 10000, dir, account: 'bank:1', source: 'bank_statement' } as Txn)));
const T = rows([
  ['UPI/DR/612345678901/RAHUL KUMAR/SBIN/rahul@ybl/UPI', 'debit'],     // SBI / Canara slash format
  ['UPI/CR/612345678902/ASHA SHARMA/HDFC/asha@okhdfc/UPI', 'credit'],
  ['UPI-NEHA JAIN-neha.j@okaxis-HDFC0001234-612345678903-PAYMENT', 'debit'], // HDFC dash format
  ['MB-PRIYA VERMA-REF 12345', 'debit'],                                 // mobile banking transfer
  ['NEFT CR-HDFC0001-RAMESH GUPTA-REF', 'credit'],
  ['UPI-SWIGGY-SWIGGY@AXIS-612345678904', 'debit'],                      // a business: keep it
]);

describe('counterparty names', () => {
  const names = counterpartyNames(T);
  it('finds every person, keeps known businesses', () => {
    for (const n of ['RAHUL KUMAR', 'ASHA SHARMA', 'NEHA JAIN', 'PRIYA VERMA', 'RAMESH GUPTA']) expect(names).toContain(n);
    expect(names).not.toContain('Swiggy');
    expect(names.some((n) => /^(UPI|NEFT|MB|REF|PAYMENT)$/i.test(n))).toBe(false);
  });
  it('with them, no name survives a tool result that lists merchants', () => {
    const result = { by_merchant: T.map((t) => ({ merchant: t.merchant, amount: '₹100' })), note: 'Paid RAHUL KUMAR twice' };
    const out = JSON.stringify(forLlm(result, names));
    for (const n of ['RAHUL', 'ASHA', 'NEHA', 'PRIYA', 'RAMESH']) expect(out).not.toContain(n);
    expect(out).toContain('Swiggy');
  });
});
