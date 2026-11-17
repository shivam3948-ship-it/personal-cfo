import { describe, expect, it } from 'vitest';
import { loadDemo } from '../src/demo';
import { emptyDataset } from '../src/types';
import { moneyAudit, sipValue } from '../src/finance/audit';

describe('money audit', async () => {
  const ds = await loadDemo();
  it('spending: the leaks the engine knows, ranked by rupees a year, no fund findings', () => {
    const a = moneyAudit(ds, 'spending');
    expect(a.findings.length).toBeGreaterThan(0);
    expect(a.findings.every((f) => f.area !== 'funds')).toBe(true);
    expect(a.findings.some((f) => /cult\.fit/i.test(f.what))).toBe(true);
    const yearly = a.findings.filter((f) => f.perYear).map((f) => f.perYear!);
    expect(yearly).toEqual([...yearly].sort((x, y) => y - x));
  });
  it('funds: regular-plan fees found; no fund named unless allowed', () => {
    const real = moneyAudit(ds, 'funds');
    const reg = real.findings.find((f) => f.kind === 'regular_plans')!;
    expect(reg.perYear).toBeGreaterThan(0);
    const names = (ds.portfolio?.holdings ?? []).map((h) => h.scheme.split(' ')[0]);
    expect(names.some((n) => JSON.stringify(real.findings).includes(n))).toBe(false);
    expect(moneyAudit(ds, 'funds', { nameFunds: true }).findings.find((f) => f.kind === 'regular_plans')!.what).toMatch(/\(/);
  });
  it('all: both areas plus foundation gaps; nothing to audit is said as such', () => {
    const a = moneyAudit(ds, 'all');
    expect(new Set(a.findings.map((f) => f.area)).size).toBeGreaterThanOrEqual(2);
    expect(moneyAudit(emptyDataset('x'), 'funds').checked).toContain('no mutual fund statement yet');
  });
});

describe('SIP calculator', () => {
  it('₹500 a day for 10 years at 12%: about ₹33.9 lakh (not ₹1.15 crore)', () => {
    const v = sipValue(50000, 'day', 10, 12);
    expect(v.invested).toBe(182500000);
    expect(Math.round(v.value / 100)).toBeGreaterThan(3_350_000); expect(Math.round(v.value / 100)).toBeLessThan(3_450_000);
  });
  it('monthly ₹15,208 for 10 years at 12% ≈ ₹35 lakh; a lump sum doubles in about 6 years', () => {
    expect(Math.round(sipValue(1520800, 'month', 10, 12).value / 100)).toBeGreaterThan(3_400_000);
    expect(sipValue(100000, 'once', 6.12, 12).value).toBeGreaterThan(199000);
  });
});
