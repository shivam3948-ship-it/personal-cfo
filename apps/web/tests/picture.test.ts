import { describe, expect, it } from 'vitest';
import { cashflowCheck, coverage, creditView, duplicates, emergencyFund, leaks, monthPictures, recurring, unusual, upcoming } from '@/lib/finance/picture';
import { groupOf } from '@/lib/finance/categorize';
import { demo } from './helpers';

describe('money picture', () => {
  it('months: Jul–Sep complete, Oct partial; subtotals reconcile to totals', async () => {
    const ds = await demo();
    expect(coverage(ds).map((c) => [c.key, c.complete])).toEqual([['2026-07', true], ['2026-08', true], ['2026-09', true], ['2026-10', false]]);
    for (const m of monthPictures(ds)) {
      const out = Object.entries(m.byCategory).filter(([k]) => groupOf(k) !== 'income').reduce((s, [, v]) => s + v, 0);
      expect(out).toBe(m.spend + m.committed);
      expect(m.surplus).toBe(m.income - m.spend - m.committed);
      expect(m.income).toBe(14500000); // salary only; interest and cashback are not income
    }
  });
  it('card bill payments and self-transfers are excluded from spend (no double count)', async () => {
    const ds = await demo();
    const sep = monthPictures(ds).find((m) => m.key === '2026-09')!;
    expect(sep.byCategory['Card bill payment']).toBeUndefined();
    expect(sep.byCategory['Self transfer']).toBeUndefined();
    const billPaid = ds.txns.find((t) => t.date === '2026-09-22' && t.category === 'Card bill payment' && t.account.startsWith('bank:'))!;
    expect(sep.nonSpendExcluded).toBeGreaterThanOrEqual(billPaid.amount);
  });
  it('refunds net against the original category', async () => {
    const ds = await demo();
    const aug = monthPictures(ds).find((m) => m.key === '2026-08')!;
    const myntra = ds.txns.filter((t) => t.merchant === 'Myntra');
    expect(myntra.length).toBe(2);
    const shopping = ds.txns.filter((t) => t.date >= '2026-08-01' && t.date <= '2026-08-31' && t.category === 'Shopping').reduce((s, t) => s + t.amount, 0);
    expect(aug.byCategory.Shopping).toBe(shopping - 129900);
  });
  it('finds the duplicate Netflix debit, the trial charge, the unused gym and the price rise', async () => {
    const ds = await demo();
    expect(duplicates(ds)).toEqual([expect.objectContaining({ merchant: 'Netflix', date: '2026-09-18', amount: 64900, extra: 64900 })]);
    const kinds = leaks(ds).map((l) => [l.kind, l.merchant]);
    expect(kinds).toEqual(expect.arrayContaining([['trial_charge', 'LingoPro'], ['inactive', 'cult.fit'], ['price_rise', 'Netflix'], ['duplicate', 'Netflix'], ['fee', 'Bank charges']]));
    expect(leaks(ds).find((l) => l.kind === 'inactive')!.annualCost).toBe(199900 * 12);
    expect(recurring(ds).find((r) => r.merchant === 'Netflix')!.cadence).toBe('monthly');
  });
  it('unusual spending: food delivery spike in September, Croma purchase', async () => {
    const ds = await demo();
    const u = unusual(ds);
    expect(u.some((x) => x.kind === 'category_spike' && x.category === 'Food delivery')).toBe(true);
    expect(u.some((x) => x.kind === 'large_txn' && x.merchant === 'Croma' && x.amount === 3899000)).toBe(true);
  });
  it('upcoming dues before the next salary, with the new Netflix price', async () => {
    const ds = await demo();
    const d = upcoming(ds);
    expect(d.find((x) => x.kind === 'emi')).toMatchObject({ date: '2026-10-20', amount: 1018100 });
    expect(d.find((x) => x.kind === 'card')).toMatchObject({ date: '2026-10-24', amount: 3634300 });
    expect(d.find((x) => x.title === 'Netflix')).toMatchObject({ date: '2026-10-18', amount: 79900 });
    expect(d.find((x) => x.kind === 'premium')).toMatchObject({ date: '2026-11-02', amount: 1450000 });
    const cf = cashflowCheck(ds);
    expect(cf.nextSalary).toBe('2026-11-01');
    expect(cf.balanceAfterDues).toBe(cf.balance! - cf.duesTotal);
    expect(cf.duesTotal).toBe(cf.dues.reduce((s, x) => s + x.amount, 0));
  });
  it('emergency fund and credit view', async () => {
    const ds = await demo();
    const e = emergencyFund(ds);
    expect(e.liquid).toBe(14176365); expect(e.otherAccountsSeen).toBe(true);
    const c = creditView(ds)!;
    expect(c.change).toBe(-23); expect(c.utilisationReported).toBe(28.5); expect(c.enquiriesLast90Days.length).toBe(2);
  });
});
