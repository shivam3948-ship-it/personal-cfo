import { describe, expect, it } from 'vitest';
import { compareRefinance, computeEmi, emisPaid, loanStatus, schedule, simulatePrepayment } from '@core/finance/loans';
import { demo, expected } from './helpers';

describe('loan engine (cross-checked against the generator’s independent implementation)', () => {
  it('EMI from principal, rate, tenure', () => {
    expect(computeEmi(60000000, 9.5, 60)).toBe(expected.loans.car.emi);
    expect(computeEmi(30000000, 13.5, 36)).toBe(expected.loans.pl.emi);
    expect(computeEmi(1200000, 0, 12)).toBe(100000);
  });
  it('schedule clears the balance and interest + principal = payments', () => {
    const rows = schedule(60000000, 9.5, 1260100, '2024-04-05');
    expect(rows.at(-1)!.closing).toBe(0);
    expect(rows.length).toBe(60);
    for (const r of rows) expect(r.interest + r.principal).toBe(r.payment);
  });
  it('outstanding on 30 Sep 2026 matches the generator', async () => {
    const ds = await demo();
    const car = ds.loans.find((l) => l.type === 'car')!; const pl = ds.loans.find((l) => l.type === 'personal')!;
    expect(emisPaid(car, '2026-09-30')).toBe(30);
    expect(loanStatus(car, '2026-09-30').outstanding).toBe(expected.outstandingSep30.car);
    expect(loanStatus(pl, '2026-09-30').outstanding).toBe(expected.outstandingSep30.pl);
  });
  it('part-prepayment saves interest and shortens tenure; charges and lock-in come from the document', async () => {
    const ds = await demo();
    const car = ds.loans.find((l) => l.type === 'car')!; const pl = ds.loans.find((l) => l.type === 'personal')!;
    const r = simulatePrepayment(car, 5000000, '2026-10-15');
    expect(r.allowed).toBe(true); expect(r.charge).toBe(0);
    expect(r.interestSaved).toBeGreaterThan(0); expect(r.monthsSaved).toBeGreaterThan(0);
    expect(r.outstandingAfter).toBe(r.outstandingBefore - 5000000);
    const e = simulatePrepayment(car, 5000000, '2026-10-15', 'reduce_emi');
    expect(e.newEmi).toBeLessThan(car.emi); expect(e.monthsSaved).toBe(0);
    const p = simulatePrepayment(pl, 5000000, '2026-10-15');
    expect(p.allowed).toBe(false); expect(p.allowedFrom).toBe('2026-12-20');
    expect(p.charge).toBe(Math.round(5000000 * 0.04 * 1.18)); // 4% + 18% GST
  });
  it('refinance: foreclosure charge and lock-in can make a cheaper offer a loss', async () => {
    const ds = await demo();
    const pl = ds.loans.find((l) => l.type === 'personal')!;
    const c = compareRefinance(pl, ds.offers[0], '2026-10-15');
    expect(c.grossSaving).toBeGreaterThan(0);
    expect(c.switchNetSaving).toBe(c.grossSaving - c.processingFee - c.foreclosureCharge);
    expect(c.switchNetSaving).toBeLessThan(0);
    expect(c.switchAllowed).toBe(false);
    expect(c.offerExpiresBeforeLockIn).toBe(true);
    expect(c.matchSaving).toBe(c.grossSaving);
  });
});
