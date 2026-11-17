// SIP vs one-time investments (2 Nov 2026): your own money split by habit, each priced at today's NAV.
import { describe, expect, it } from 'vitest';
import { sipVsOneTime } from '../src/portfolio/engine';
import type { Holding } from '../src/portfolio/cas';

const fund = (flows: Holding['flows'], nav: number): Holding => ({ isin: 'X', scheme: 'Test Fund', amc: 'Test', plan: 'Direct', category: 'Flexi Cap', asset: 'equity', units: flows.reduce((a, f) => a + (f.units ?? 0), 0), nav, navDate: '2026-01-01', cost: -flows.reduce((a, f) => a + f.amount, 0), value: 0, flows });
const buy = (date: string, rupees: number, nav: number) => ({ date, amount: -rupees * 100, nav, units: rupees / nav });

describe('sipVsOneTime', () => {
  it('splits monthly repeats from one-offs and prices each at today\'s NAV', () => {
    const h = fund([buy('2025-01-05', 1000, 10), buy('2025-02-05', 1000, 10), buy('2025-03-05', 1000, 10), buy('2025-02-20', 5000, 20)], 20);
    const r = sipVsOneTime([h], '2026-01-05')!;
    expect(r.sip.buys).toBe(3); expect(r.oneTime.buys).toBe(1);
    expect(r.sip.invested).toBe(300000); expect(r.sip.value).toBe(600000); // 300 units at 20
    expect(r.oneTime.value).toBe(500000); // bought at 20, still 20
    expect(r.sip.ratePct!).toBeGreaterThan(90); expect(r.oneTime.ratePct).toBe(0);
  });
  it('leaves out funds you sold from, and returns null without both habits', () => {
    const sold = fund([buy('2025-01-05', 1000, 10), buy('2025-02-05', 1000, 10), buy('2025-03-05', 1000, 10), { date: '2025-06-01', amount: 50000 }], 12);
    expect(sipVsOneTime([sold], '2026-01-05')).toBeNull();
    const onlySip = fund([buy('2025-01-05', 1000, 10), buy('2025-02-05', 1000, 10), buy('2025-03-05', 1000, 10)], 12);
    expect(sipVsOneTime([onlySip], '2026-01-05')).toBeNull();
  });
  it('a yearly top-up of the same amount is one-time, not a SIP', () => {
    const h = fund([buy('2023-03-01', 5000, 10), buy('2024-03-01', 5000, 12), buy('2025-03-01', 5000, 14), buy('2025-04-01', 1000, 14), buy('2025-05-01', 1000, 14), buy('2025-06-01', 1000, 14)], 15);
    const r = sipVsOneTime([h], '2026-01-01')!;
    expect(r.oneTime.buys).toBe(3); expect(r.sip.buys).toBe(3);
  });
});
