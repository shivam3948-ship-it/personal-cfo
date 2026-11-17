import { describe, it, expect } from 'vitest';
import { fdComparison } from '../src/portfolio/insights';
import type { Holding } from '../src/portfolio/cas';

// 15 Nov, the owner's since-inception CAS (D-098): redemptions were left out of the FD comparison, so a portfolio returning
// well above 7% read as behind a 7% FD. The FD mirror takes money out on the dates you did.
describe('FD comparison counts redemptions', () => {
  const h = (flows: { date: string; amount: number }[], value: number) => ({ isin: 'INF000000001', scheme: 'Example Fund', amc: 'Example', plan: 'Direct', category: 'Flexi cap', asset: 'equity', flows, units: 1, nav: 1, navDate: '2026-01-01', cost: 0, value } as unknown as Holding);
  it('₹1,00,000 in, ₹50,000 out a year later, worth ₹60,000 after two years: the FD mirror is 1,00,000×1.07² − 50,000×1.07', () => {
    const r = fdComparison([h([{ date: '2024-01-01', amount: -10000000 }, { date: '2025-01-01', amount: 5000000 }], 6000000)], '2026-01-01');
    // 1,00,000 × 1.07^(731/365) − 50,000 × 1.07^(365/365) = 1,14,511.36 − 53,500 = ₹61,011 (2024 is a leap year: 731 days)
    expect(r.fdValue).toBe(Math.round(10000000 * Math.pow(1.07, 731 / 365) - 5000000 * 1.07));
    expect(r.extra).toBe(6000000 - r.fdValue);
    expect(r.invested).toBe(10000000);
  });
});
