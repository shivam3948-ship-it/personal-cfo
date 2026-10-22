import { describe, expect, it } from 'vitest';
import { loadDemo } from '@core/demo';
import design from '../designs/design-data.json';
import { buildInvest, buildXray } from '@/lib/views/invest';
import { buildTransactions, buildCategory } from '@/lib/views/spends';
import { buildToday } from '@/lib/views/today';
import { safetyNet } from '@core/finance/essentials';
import { getSession } from '@/lib/session';

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

  it('Today: money figures match the design; safety net matches Invest (premiums spread over 12 months, so ESS differs from the design by design)', async () => {
    const ds = await loadDemo();
    const t = buildToday(ds, await getSession(new Request('http://local/')));
    expect(t.M0).toEqual(design.Today.M0);
    expect(t.EMG.saved).toBe(design.Today.EMG.saved);
    const sn = safetyNet(ds, 6);
    expect(t.EMG.target).toBe(Math.round(sn.target / 100));
    expect(t.ESS).toBe(Math.round(sn.essentialsPerMonth / 100));
    expect(t.ESS).not.toBe(design.Today.ESS); // design's 83,414 predates spreading premiums (Invest shows the same engine number)
  });
});

// Advice gate on the X-ray screen itself (D-043): guided users never get the named-fund plan, in the data or on screen.
describe('X-ray advice gate', () => {
  it('guided: no fund names in the plan data, no plan button, SEBI disclaimer; demo keeps the plan', async () => {
    const { renderToString } = await import('react-dom/server');
    const { createElement } = await import('react');
    const Xray = (await import('@/screens/Xray')).default;
    const ds = await loadDemo();
    const g = buildXray(ds, { adviceMode: 'guided' }) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const d = buildXray(ds, { adviceMode: 'demo' }) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(g.XR.harvest.combo.funds).toEqual([]);
    expect(d.XR.harvest.combo.funds.length).toBeGreaterThan(0);
    const html = (data: unknown) => renderToString(createElement(Xray, { theme: 'light', state: 'ready', data }));
    const hg = html(g), hd = html(d);
    expect(hg).not.toContain('See the plan');
    expect(hg).not.toContain('Start here');
    expect(hg).toContain('SEBI-registered');
    expect(hd).toContain('See the plan');
    expect(hd).toContain('For testing only, not investment advice.');
  });
});

describe('Spends view reproduces the design from the engine', () => {
  it('matches, except three intended differences', async () => {
    const { buildSpendsMain } = await import('@/lib/views/spendsMain');
    const v = deep(buildSpendsMain(await loadDemo())) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const d = deep(design.Spends) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    // 1) bank interest now counts as income (Sep), so money in is salary + interest
    expect(v.INCOME - d.INCOME).toBe(118600); expect(v.PAST['09'].inc - d.PAST['09'].inc).toBe(118600);
    // 2) the usual-month curve nets the 16 Aug refund on its date, like the month totals do (the design's curve didn't, after day 15)
    expect(v.USUALCUM.slice(0, 15)).toEqual(d.USUALCUM.slice(0, 15)); expect(v.USUALCUM.at(-1)).toBe(d.USUALCUM.at(-1));
    // 3) merchant names come from the statement cleanup, not hand-shortened ("Biryani Blues Dlf Ph4")
    for (const m of ['07', '08', '09']) expect(v.PAST[m].top.map((t: unknown[]) => t[3])).toEqual(d.PAST[m].top.map((t: unknown[]) => t[3]));
    for (const k of ['INCOME', 'USUALCUM']) { delete v[k]; delete d[k]; }
    for (const m of ['07', '08', '09']) { delete v.PAST[m].top; delete d.PAST[m].top; delete v.PAST[m].inc; delete d.PAST[m].inc; }
    expect(v).toEqual(d);
  });
});
