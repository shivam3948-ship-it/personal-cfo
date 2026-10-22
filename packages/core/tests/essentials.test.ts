import { describe, expect, it } from 'vitest';
import { loadDemo } from '../src/demo';
import { essentialsByMonth, monthlyPremiums, safetyNet, monthlyIncome } from '../src/finance/essentials';
import { fundGrowth, investingHabits } from '../src/portfolio/engine';

describe('essentials and the safety net (D-040)', () => {
  it('spreads yearly premiums: term ₹14,500/yr + health ₹18,900/yr + endowment ₹5,000/mo', async () => {
    const ds = await loadDemo();
    // hand-computed: round(1450000/12) + round(1890000/12) + 500000 = 120833 + 157500 + 500000
    expect(monthlyPremiums(ds)).toBe(778333);
    const ess = essentialsByMonth(ds);
    expect(Object.keys(ess)).toEqual(['Jul', 'Aug', 'Sep']);
    // Jul fixed costs = rent 26,000 + EMIs 22,782 + premiums 7,783.33 (not July's actual ₹23,900 premium)
    expect(ess.Jul['Fixed costs']).toBe(2600000 + 2278200 + 778333);
    expect(ess.Jul.Groceries).toBe(511800);
  });
  it('safety net = bank + debt fund vs 6 months of essentials, parts add up', async () => {
    const ds = await loadDemo();
    const n = safetyNet(ds);
    expect(n.bank).toBe(14176365);
    expect(n.debtFunds).toBe(12896200);
    expect(n.have).toBe(n.bank + n.debtFunds);
    expect(n.target).toBe(6 * n.essentialsPerMonth);
    expect(n.gap).toBe(n.target - n.have);
    const ess = Object.values(essentialsByMonth(ds)).map((r) => Object.values(r).reduce((a, b) => a + b, 0));
    expect(n.essentialsPerMonth).toBe(Math.round(ess.reduce((a, b) => a + b, 0) / 3));
    expect(monthlyIncome(ds)).toBe(14500000);
  });
});

describe('your money vs your funds', () => {
  it('fund growth uses the first purchase NAV and today\'s NAV from the CAS', async () => {
    const ds = await loadDemo();
    const k = ds.portfolio!.holdings.find((h) => h.scheme.startsWith('Kestrel'))!;
    const g = fundGrowth(k, '2026-10-15')!;
    expect(g.firstDate).toBe('2021-01-05'); expect(g.navThen).toBe(10); expect(g.navNow).toBe(21.0189);
    const yrs = (Date.parse('2026-10-15') - Date.parse('2021-01-05')) / (365.25 * 86400000);
    expect(g.fundPct).toBe(Math.round((Math.pow(21.0189 / 10, 1 / yrs) - 1) * 1000) / 10);
    expect(g.fundPct).toBe(13.7);
  });
  it('sample family: no SIP gaps, no sells, investing since Jan 2021', async () => {
    const ds = await loadDemo();
    expect(investingHabits(ds.portfolio!.holdings)).toEqual({ sipGaps: 0, sells: 0, since: '2021-01-05' });
  });
  it('a skipped SIP month counts as a gap; a redemption counts as a sell', () => {
    const h = { flows: [{ date: '2025-01-05', amount: -500000 }, { date: '2025-02-05', amount: -500000 }, { date: '2025-04-05', amount: -500000 }, { date: '2025-05-01', amount: 200000 }] } as never;
    expect(investingHabits([h])).toEqual({ sipGaps: 1, sells: 1, since: '2025-01-05' });
  });
});

describe('SIP detection', () => {
  it('the same lump sum once a year is not a SIP with 11 gaps a year', () => {
    const h = { flows: ['2021-03-10', '2022-03-10', '2023-03-10'].map((date) => ({ date, amount: -5000000 })) } as never;
    expect(investingHabits([h]).sipGaps).toBe(0);
  });
});
