// Against its index, and same-category duplication (3 Nov 2026). Invented funds and NAVs.
import { describe, expect, it } from 'vitest';
import { benchmarkOf, sameCategory, vsBenchmarks, type NavSeries } from '../src/portfolio/engine';
import type { Holding } from '../src/portfolio/cas';

const h = (scheme: string, category: string, flows: Holding['flows'], value: number, asset: Holding['asset'] = 'equity'): Holding =>
  ({ isin: scheme, scheme: scheme + ' - Direct Plan - Growth', amc: 'X', plan: 'Direct', category, asset, units: 0, nav: 0, navDate: '', cost: 0, value: value * 100, flows });
const s: NavSeries = [['2024-01-01', 10], ['2024-07-01', 12.5], ['2025-01-01', 15], ['2026-01-01', 20]];

describe('benchmarkOf', () => {
  it('maps each kind of active equity fund to an index, and skips index and debt funds', () => {
    expect(benchmarkOf({ asset: 'equity', category: 'Flexi cap' })).toBe('nifty500');
    expect(benchmarkOf({ asset: 'equity', category: 'ELSS' })).toBe('nifty500');
    expect(benchmarkOf({ asset: 'equity', category: 'Small cap' })).toBe('smallcap250');
    expect(benchmarkOf({ asset: 'equity', category: 'Mid cap' })).toBe('midcap150');
    expect(benchmarkOf({ asset: 'equity', category: 'Large cap' })).toBe('nifty50');
    expect(benchmarkOf({ asset: 'equity', category: 'Index' })).toBeNull();
    expect(benchmarkOf({ asset: 'debt', category: 'Debt' })).toBeNull();
    expect(benchmarkOf({ asset: 'equity', category: 'Sector / theme' })).toBeNull();
  });
});

describe('vsBenchmarks', () => {
  it('puts the same money on the same dates into the index fund, buys and sells, valued today', () => {
    // ₹1,000 on 1 Jan 2024 (100 index units) and ₹1,000 on 1 Jan 2025 (66.67 units); ₹500 taken out on 1 Jul 2024 (40 units)
    const f = h('Kestrel Flexi Cap', 'Flexi cap', [{ date: '2024-01-01', amount: -100000 }, { date: '2024-07-01', amount: 50000 }, { date: '2025-01-01', amount: -100000 }], 2600);
    const r = vsBenchmarks([f], { nifty500: s }, '2026-01-01');
    expect(r.rows).toHaveLength(1);
    const units = 100 - 40 + 1000 / 15;
    expect(r.rows[0].benchValue).toBe(Math.round(units * 20 * 100));
    expect(r.rows[0].diff).toBe(260000 - r.rows[0].benchValue);
    expect(r.rows[0].invested).toBe(200000);
  });
  it('a fund bought before the index fund existed, or with no series, is listed as not covered', () => {
    const old = h('Old Fund', 'Flexi cap', [{ date: '2019-01-01', amount: -100000 }], 3000);
    const mid = h('Monsoon Mid Cap', 'Mid cap', [{ date: '2024-01-01', amount: -100000 }], 1500);
    const r = vsBenchmarks([old, mid], { nifty500: s }, '2026-01-01'); expect(r.notCovered).toEqual(['Old']); expect(r.noData).toEqual(['Monsoon Mid Cap']);
  });
});

describe('sameCategory', () => {
  it('flags two or more active equity funds of one kind, not index or debt funds', () => {
    const fs = [h('A Flexi', 'Flexi cap', [], 500), h('B Flexi', 'Flexi cap', [], 300), h('C Small', 'Small cap', [], 100), h('N50 Index', 'Index', [], 100), h('N Next Index', 'Index', [], 100), h('D Debt', 'Debt', [], 100, 'debt'), h('E Debt', 'Debt', [], 100, 'debt')];
    expect(sameCategory(fs)).toEqual([{ category: 'Flexi cap', funds: ['A Flexi', 'B Flexi'], value: 80000 }]);
  });
});

// owner's CAS, 7 Nov: funds bought through Groww carry "(Advisor: …/NEXTBILLION TECHNOLOGY PVT LTD)", read as a technology fund
import { classify } from '../src/portfolio/cas';
describe('classify reads the fund name only', () => {
  it('ignores the distributor, registrar and former name', () => {
    expect(classify('HDFC Focused Fund - Direct Plan - Growth Option (formerly HDFC Core and Satellite Fund) (Advisor: INZ000000000/NEXTBILLION TECHNOLOGY PVT LTD)').category).toBe('Equity (other)');
    expect(classify('SBI Contra Fund - Direct Plan - Growth (Advisor: INZ000000000/NEXTBILLION TECHNOLOGY PRIVATE LIMITED) Registrar : CAMS').category).toBe('Equity (other)');
    expect(classify('Some Fund (formerly Some Infrastructure Fund) - Direct Growth').category).toBe('Other');
    expect(classify('ICICI Prudential Technology Fund - Direct Plan - Growth').category).toBe('Sector / theme'); // a real technology fund still is one
    expect(classify('DSP Credit Risk Fund - Direct Plan - Growth (formerly DSP Income Opportunities Fund) (Advisor: INZ000000000/NEXTBILLION TECHNOLOGY PRIVATE LIMITED)').category).toBe('Debt');
  });
});
