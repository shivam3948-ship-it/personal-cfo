import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadDemo, DATA_DIR } from '../src/demo';
import { xrayInsights, overlap, fdComparison, lots, financialYear } from '../src/portfolio/insights';

// Reference: docs/research/xray_v2_numbers.py and xray_v3_numbers.py (independent Python on the same sample CAS).
const ref2 = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/research/xray_v2_numbers.json'), 'utf8'));
const ref3 = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/research/xray_v3_numbers.json'), 'utf8'));
const rupees = (p: number) => Math.round(p / 100);

describe('x-ray insights match the Python reference', () => {
  it('tax-free gains and the one-move plan', async () => {
    const ds = await loadDemo(); const x = xrayInsights(ds.portfolio!.holdings, ds.portfolio!.asOf);
    expect(x.harvest.daysLeft).toBe(ref2.harvest.daysLeft);
    expect(x.harvest.deadline).toBe('2027-03-31');
    expect(rupees(x.harvest.ltGainAll)).toBe(rupees(ref2.harvest.ltGainAll));
    expect(x.harvest.taxSavedLater).toBe(ref2.harvest.taxSavedLater);
    expect(x.harvest.usedKnown).toBe(true);
    expect(x.harvest.combo.lots).toBe(ref2.harvest.combo.lots);
    expect(rupees(x.harvest.combo.gain)).toBe(rupees(ref2.harvest.combo.gain));
    expect(rupees(x.harvest.combo.value)).toBe(rupees(ref2.harvest.combo.value));
    expect(x.harvest.combo.funds).toEqual(['Kestrel Flexi Cap', 'Monsoon Small Cap']);
  });
  it('regular → direct, net of the cost of switching', async () => {
    const ds = await loadDemo(); const r = xrayInsights(ds.portfolio!.holdings, ds.portfolio!.asOf).regular;
    expect(r.feeTotal).toBe(ref2.regular.feeTotal);
    expect(rupees(r.taxIfSwitchAllLT)).toBe(rupees(ref2.regular.taxIfSwitchAllLT));
    expect(rupees(r.ltValueReg)).toBe(rupees(ref2.regular.ltValueReg));
    expect(rupees(r.feeOnLT)).toBe(rupees(ref2.regular.feeOnLT));
    expect(r.paybackYears).toBe(3.6);
    expect(r.sipReg).toBe(700000);
    expect(rupees(r.rows.reduce((s, x) => s + x.stValue, 0))).toBe(86149);
  });
  it('ELSS out of lock-in, and Monsoon vs the index fund on the same dates', async () => {
    const ds = await loadDemo(); const x = xrayInsights(ds.portfolio!.holdings, ds.portfolio!.asOf);
    expect(rupees(x.elss!.freeValue)).toBe(rupees(ref2.elss.freeValue));
    expect(x.elss!.lockedValue).toBe(0);
    const m = x.vsIndex['Monsoon Small Cap'];
    expect(m.covered).toBe(41);
    expect(rupees(m.indexValue)).toBe(rupees(ref2.vsIndex['Monsoon Small Cap'].indexValue));
    expect(rupees(m.diff)).toBe(rupees(ref2.vsIndex['Monsoon Small Cap'].diff));
    expect(Object.keys(x.vsIndex)).toEqual(['Monsoon Small Cap']); // Kestrel, Teak: no index NAVs before Apr 2022 (data gap)
  });
  it('overlap from the synthetic sample holdings', async () => {
    const ds = await loadDemo();
    const w = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'demo-cas', 'sample_holdings_synthetic.json'), 'utf8')).funds;
    const o = overlap(ds.portfolio!.holdings, Object.fromEntries(Object.entries(w).map(([k, v]) => [k.replace(/ Fund$/, ' Fund'), v])) as never);
    expect(o.pairs.slice(0, 3)).toEqual([['Banyan', 'Teak', 45], ['Kestrel', 'Banyan', 40], ['Kestrel', 'Teak', 33]]);
    expect(o.top5PctOfEquity).toBe(ref3.overlap.top5PctOfEquity);
    expect(o.in3plus).toEqual(ref3.overlap.in3plus);
  });
  it('FD comparison and FY boundaries', async () => {
    const ds = await loadDemo(); const f = fdComparison(ds.portfolio!.holdings, ds.portfolio!.asOf);
    expect(f.invested).toBe(84700000);
    expect(rupees(f.extra)).toBe(rupees(ref3.fd.extra));
    expect(financialYear('2026-03-31')).toEqual({ start: '2025-04-01', end: '2026-03-31' });
    expect(financialYear('2026-04-01')).toEqual({ start: '2026-04-01', end: '2027-03-31' });
  });
  it('FIFO: a redemption uses up the oldest units first', () => {
    const h = { scheme: 'Test Fund - Direct Plan', plan: 'Direct', category: 'Flexi cap', asset: 'equity', nav: 20, value: 0, flows: [
      { date: '2024-01-01', amount: -100000, nav: 10, units: 100 }, { date: '2024-06-01', amount: -120000, nav: 12, units: 100 }, { date: '2025-01-01', amount: 150000, nav: 15, units: -150 }] } as never;
    const ls = lots(h, '2026-01-01');
    expect(ls).toHaveLength(1);
    expect(ls[0].date).toBe('2024-06-01'); expect(ls[0].units).toBe(50); expect(ls[0].amount).toBe(60000); expect(ls[0].value).toBe(100000);
  });
});
