import { describe, expect, it } from 'vitest';
import { loadDemo } from '@core/demo';
import design from '../designs/design-data.json';
import { buildInvest, buildXray } from '@/lib/views/invest';
import { buildTransactions, buildCategory } from '@/lib/views/spends';

// The app must show the numbers the reviewed designs show (designs/design-data.json), except where a decision changed them.
const rupees = (p: number) => Math.round(p / 100);
const deep = (x: unknown): unknown => JSON.parse(JSON.stringify(x));

describe('view models reproduce the designs from the engine', () => {
  it('Invest', async () => {
    const v = buildInvest(await loadDemo());
    const d = design.Invest as Record<string, any>;
    expect(v.BANK).toBe(d.BANK);
    expect(v.INCOME_M).toBe(d.INCOME_M);
    expect(v.TERM_COVER).toBe(d.TERM_COVER);
    expect(v.ENDOW).toEqual(d.ENDOW);
    expect(v.XRS).toEqual(d.XRS);
    expect(deep(v.PF)).toMatchObject({ value: d.PF.value, cost: d.PF.cost, xirr: d.PF.xirr, sipGaps: 0, sells: 0, since: 'Jan 2021' });
    expect((v.PF!.funds as unknown[][]).map((f) => f.slice(0, 10))).toEqual(d.PF.funds);
    // D-040 change since the design: yearly premiums are spread over 12 months, so fixed costs differ from the mock's actuals.
    expect(Object.keys(v.ESSM)).toEqual(Object.keys(d.ESSM));
    expect(v.ESSM.Aug.Groceries).toBe(d.ESSM.Aug.Groceries);
    expect(v.ESSM.Jul['Fixed costs']).toBe(2600000 + 2278200 + 778333);
  });
  it('X-ray', async () => {
    const v = buildXray(await loadDemo());
    const d = design.Xray as Record<string, any>;
    expect(v.XR!.harvest.taxSavedLater).toBe(d.XR.harvest.taxSavedLater);
    expect(rupees(v.XR!.harvest.combo.value)).toBe(rupees(d.XR.harvest.combo.value));
    expect(v.XR!.regular.feeTotal).toBe(d.XR.regular.feeTotal);
    expect(rupees(v.XR!.regular.taxIfSwitchAllLT)).toBe(rupees(d.XR.regular.taxIfSwitchAllLT));
    expect(rupees(v.XR!.elss!.freeValue)).toBe(rupees(d.XR.elss.freeValue));
    expect(rupees(v.XR!.vsIndex['Monsoon Small Cap'].diff)).toBe(rupees(d.XR.vsIndex['Monsoon Small Cap'].diff));
    expect(v.X3!.overlap.top5PctOfEquity).toBe(d.X3.overlap.top5PctOfEquity);
    expect(rupees(v.X3!.fd.extra)).toBe(rupees(d.X3.fd.extra));
    expect(rupees(v.X3!.did.feeSavedSoFar)).toBe(rupees(d.X3.did.feeSavedSoFar));
  });
  it('Transactions and categories', async () => {
    const ds = await loadDemo();
    expect(buildTransactions(ds).TX).toEqual((design.Transactions as any).TX);
    const c = buildCategory(ds).DATA, dc = (design.Category as any).DATA;
    for (const k of Object.keys(dc)) { expect(c[k].m, k).toEqual(dc[k].m); expect(c[k].u15, k).toEqual(dc[k].u15); expect(c[k].tx, k).toEqual(dc[k].tx); }
  });
});
