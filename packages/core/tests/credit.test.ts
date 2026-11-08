import { describe, it, expect } from 'vitest';
import { loadDemo } from '../src/demo';
import { creditPicture } from '../src/finance/credit';
import { emptyDataset, type Txn } from '../src/types';

describe('credit picture (D-094)', () => {
  it('sample family: owed, monthly EMIs and the due list add up', async () => {
    const c = creditPicture(await loadDemo());
    expect(c.owe).toEqual({ cards: 3634300, loans: 56129369, total: 59763669 }); // python: 3634300 + 32537772 + 23591597
    expect(c.owe.cards + c.owe.loans).toBe(c.owe.total);
    expect(c.monthlyEmi).toBe(2278200); // 12,601 + 10,181
    expect(c.due.map((d) => d.date)).toEqual([...c.due.map((d) => d.date)].sort());
    expect(c.due.map((d) => d.label)).toEqual(['Orbit Finserv', 'Credit card ••9012', 'Kestrel Auto Finance']);
    expect(c.score?.score).toBe(768);
  });
  it('own statements: EMIs seen leaving the bank in two or more months, with no loan paper', () => {
    let n = 0;
    const emi = (date: string, amount = 450000): Txn => ({ id: `e${++n}`, date, desc: 'ACH D- BAJAJ FINANCE LTD', merchant: 'BAJAJ FINANCE LTD', amount, dir: 'debit', account: 'bank:1', source: 'bank_statement', sourceFile: 'b.pdf', category: 'Loan EMI' });
    const ds = { ...emptyDataset(), txns: [emi('2026-08-03'), emi('2026-09-03'), emi('2026-10-04'), { ...emi('2026-10-10', 9995), desc: 'ONE-OFF LOAN FEE', merchant: 'ONE-OFF LOAN FEE' }] };
    const c = creditPicture(ds, '2026-10-20');
    expect(c.seenEmis).toEqual([{ payee: 'BAJAJ FINANCE LTD', amount: 450000, day: 3, months: 3, last: '2026-10-04' }]);
    expect(c.monthlyEmi).toBe(450000);
    expect(c.due).toEqual([{ date: '2026-11-03', kind: 'emi', label: 'BAJAJ FINANCE LTD', amount: 450000 }]);
    expect(c.emiShareOfSalary).toBeNull(); // no salary in the statements: no share claimed
  });
});
