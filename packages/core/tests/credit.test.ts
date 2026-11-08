import { describe, it, expect } from 'vitest';
import { loadDemo } from '../src/demo';
import { creditPicture } from '../src/finance/credit';
import { emptyDataset, type Txn } from '../src/types';

describe('credit picture (D-094)', () => {
  it('sample family: owed, monthly EMIs and the due list add up', async () => {
    const c = creditPicture(await loadDemo());
    expect(c.owe).toEqual({ cards: 3634300, loans: 56129369, total: 59763669, unseenLoans: 0 }); // python: 3634300 + 32537772 + 23591597
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
    expect(c.due).toEqual([{ date: '2026-11-03', kind: 'emi', label: 'BAJAJ FINANCE LTD', amount: 450000, approx: true }]);
    expect(c.emiShareOfSalary).toBeNull(); // no salary in the statements: no share claimed
  });
});

describe('credit picture review fixes (8 Nov)', () => {
  let n = 0;
  const t = (date: string, amount: number, desc: string, extra: Partial<Txn> = {}): Txn => ({ id: `r${++n}`, date, desc, merchant: desc, amount, dir: 'debit', account: 'bank:1', source: 'bank_statement', sourceFile: 'b.pdf', category: 'Loan EMI', ...extra });
  it('a stopped EMI is not current; two loans from one bank stay two', () => {
    const txns = [
      t('2026-03-05', 300000, 'HDFC BANK LOAN'), t('2026-04-05', 300000, 'HDFC BANK LOAN'),                       // stopped in April
      t('2026-08-07', 1260000, 'HDFC BANK LOAN'), t('2026-09-07', 1260000, 'HDFC BANK LOAN'), t('2026-10-07', 1260000, 'HDFC BANK LOAN'),
      t('2026-08-15', 520000, 'HDFC BANK LOAN'), t('2026-09-15', 520000, 'HDFC BANK LOAN'), t('2026-10-15', 520000, 'HDFC BANK LOAN'),
      t('2026-10-20', 5000, 'GROCER', { category: 'Groceries' }),
    ];
    const c = creditPicture({ ...emptyDataset(), txns }, '2026-10-25');
    expect(c.seenEmis.map((e) => e.amount)).toEqual([1260000, 520000]);
    expect(c.monthlyEmi).toBe(1780000);
    expect(c.owe.unseenLoans).toBe(2);
    expect(c.due.every((d) => d.approx)).toBe(true);
  });
  it('an EMI whose amount changed is still linked to its loan paper by the lender’s name', async () => {
    const ds = await loadDemo();
    const kestrel = ds.loans!.find((l) => l.lender.startsWith('Kestrel'))!;
    const extra = [t('2026-09-05', kestrel.emi + 5000, 'KESTREL AUTO FINANCE'), t('2026-10-05', kestrel.emi + 5000, 'KESTREL AUTO FINANCE')];
    const c = creditPicture({ ...ds, txns: [...ds.txns, ...extra] });
    expect(c.seenEmis).toEqual([]); // not counted twice
    const other = [t('2026-09-12', 300000, 'KESTREL AUTO FINANCE'), t('2026-10-12', 300000, 'KESTREL AUTO FINANCE')]; // a second loan, same lender
    expect(creditPicture({ ...ds, txns: [...ds.txns, ...other] }).seenEmis.map((e) => e.amount)).toEqual([300000]);
  });
  it('charges alone are not a carried balance; a bill whose payment Munim can’t see is not counted as owed', async () => {
    const ds = await loadDemo();
    const st = ds.cardStatements.map((s, i) => (i === 1 ? { ...s, charges: 5900 } : s)); // a fee on one statement, paid in full
    const c = creditPicture({ ...ds, cardStatements: st }, '2026-11-08');
    expect(c.cards[0].carried).toBe(0); expect(c.cards[0].charges).toBeGreaterThan(0);
    expect(c.cards[0].status).toBe('unknown'); // the phone's date is past the 24 Oct due date and no statement covers it
    expect(c.owe.cards).toBe(0);
  });
});
