import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classify, parseCas } from '@core/portfolio/cas';
import { portfolioView, xirr } from '@core/portfolio/engine';

const dir = path.join(process.cwd(), 'data', 'demo-cas');
const text = fs.readFileSync(path.join(dir, 'sample_cas_rohan.txt'), 'utf8');
const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8')) as {
  total_cost: number; total_value: number; xirr_pct: number;
  funds: { isin: string; plan: string; asset: string; units: number; nav: number; cost: number; value: number; xirr_pct: number }[];
};

describe('CAS parser vs independent ground truth (scripts/make_sample_cas.py)', () => {
  const r = parseCas(text);
  it('reads every fund with units, NAV, cost and value', () => {
    expect(r.kind).toBe('detailed');
    expect(r.asOf).toBe('2026-10-15');
    expect(r.holdings).toHaveLength(expected.funds.length);
    for (const e of expected.funds) {
      const h = r.holdings.find((x) => x.isin === e.isin)!;
      expect(h, e.isin).toBeDefined();
      expect(h.plan).toBe(e.plan); expect(h.asset).toBe(e.asset);
      expect(h.units).toBeCloseTo(e.units, 3); expect(h.nav).toBeCloseTo(e.nav, 4);
      expect(h.cost).toBe(Math.round(e.cost * 100)); expect(h.value).toBe(Math.round(e.value * 100));
    }
  });
  it('passes all reconciliation checks', () => {
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
    expect(r.checks.find((c) => c.id === 'total')?.ok).toBe(true);
  });
  it('carries no PII: no name, address, email, phone or folio', () => {
    const out = JSON.stringify(r);
    for (const bad of ['Rohan', 'Saffron', 'Example Road', 'example.com', '3210', '1023456', '88412093', 'Folio']) expect(out).not.toContain(bad);
  });
  it('portfolio view matches ground-truth totals and XIRR (code-computed in Python)', () => {
    const v = portfolioView(r.holdings, r.asOf);
    expect(v.value).toBe(Math.round(expected.total_value * 100));
    expect(v.cost).toBe(Math.round(expected.total_cost * 100));
    expect(v.gain).toBe(v.value - v.cost);
    expect(v.xirrPct!).toBeCloseTo(expected.xirr_pct, 0);
    for (const e of expected.funds) expect(v.funds.find((f) => f.isin === e.isin)!.xirrPct!).toBeCloseTo(e.xirr_pct, 0);
    // subtotals reconcile with the grand total
    expect(v.funds.reduce((s, f) => s + f.value, 0)).toBe(v.value);
    expect(v.mix.reduce((s, m) => s + m.value, 0)).toBe(v.value);
    expect(v.regular.funds).toBe(3);
    expect(v.sipPerMonth).toBe(1000000);
  });
});

describe('CAS edge cases', () => {
  const mini = [
    'Consolidated Account Statement',
    'Alpha Mutual Fund',
    'Folio No: 999/1 PAN: OK KYC: OK',
    'Some Holder',
    'A12-Alpha Liquid Fund - Direct Plan - Growth - ISIN: INF000A12AB9(Advisor: DIRECT) Registrar : KFINTECH',
    'Opening Unit Balance: 10.000',
    '01-Apr-2025 Purchase 10,000.00 100.000 100.0000 110.000',
    '01-Apr-2025 *** Stamp Duty *** 0.50',
    '01-Jun-2025 Redemption (5,500.00) (50.000) 110.0000 60.000',
    'Closing Unit Balance: 60.000 NAV on 30-Sep-2025: INR 112.0000 Total Cost Value: 5,000.00 Market Value on 30-Sep-2025: INR 6,720.00',
  ].join('\n');
  it('redemptions are inflows, stamp duty adds no units, opening balance counts in the walk', () => {
    const r = parseCas(mini);
    expect(r.holdings).toHaveLength(1);
    const h = r.holdings[0];
    expect(h.flows).toEqual([{ date: '2025-04-01', amount: -1000000, nav: 100 }, { date: '2025-06-01', amount: 550000, nav: 110 }]);
    expect(h.plan).toBe('Direct'); expect(h.category).toBe('Liquid'); expect(h.asset).toBe('debt');
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });
  it('flags a unit walk that does not add up instead of fixing it', () => {
    const r = parseCas(mini.replace('Closing Unit Balance: 60.000', 'Closing Unit Balance: 61.000').replace('INR 6,720.00', 'INR 6,832.00'));
    expect(r.checks.find((c) => c.id.startsWith('units:'))!.ok).toBe(false);
  });
  it('summary statements are recognised (no transactions to compute returns)', () => {
    expect(parseCas('Consolidated Account Summary\nTotal 1,000.00 1,200.00').kind).toBe('summary');
  });
  it('classifies common SEBI categories', () => {
    expect(classify('XYZ Nifty 50 Index Fund').category).toBe('Index');
    expect(classify('XYZ Balanced Advantage Fund').asset).toBe('hybrid');
    expect(classify('XYZ Banking & PSU Debt Fund').asset).toBe('debt');
    expect(classify('XYZ Flexi Cap Fund').category).toBe('Flexi cap');
  });
  it('XIRR: ₹1,00,000 growing to ₹1,10,000 in exactly one year is 10%', () => {
    expect(xirr([{ date: '2025-01-01', amount: -10000000 }, { date: '2026-01-01', amount: 11000000 }])!).toBeCloseTo(0.1, 4);
    expect(xirr([{ date: '2025-01-01', amount: -100 }])).toBeNull();
  });
});
