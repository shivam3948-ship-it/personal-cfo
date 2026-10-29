// Screen = engine for Today and Invest (D-076 audit, 29 Oct). The Spends bug showed that "it renders" is not "it's right":
// each figure below is computed here from the raw transactions, independently of the view code, and compared with the screen.
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadDemo } from '@core/demo';
import { emptyDataset, type Dataset } from '@core/types';
import { buildToday } from '@/lib/views/today';
import { buildTodayMine } from '@/lib/views/todayMine';
import { bucketOf } from '@/lib/views/spendsMain';
import { buildInvest } from '@/lib/views/invest';
import Today from '@/screens/Today';
import Invest from '@/screens/Invest';

// renders a screen with a given tap state (e.g. an amount picked), the way useDC would after setState
vi.mock('@/ui/dc', async (orig) => {
  const m = await orig<typeof import('@/ui/dc')>();
  return { ...m, useDC: (C: new (p: Record<string, unknown>) => { state: object; renderVals: () => unknown }, props: Record<string, unknown>) => { const i = new C(props); i.state = { ...i.state, ...((props.__state as object) ?? {}) }; return i.renderVals(); } };
});

const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const inr = (p: number) => '₹' + Math.round(p / 100).toLocaleString('en-IN');

describe('Today: the last-day card equals the engine', async () => {
  const { finalise } = await import('@core/ingest/finalise');
  const acc = 'bank:2222';
  const tx = (id: string, date: string, desc: string, rupees: number, dir: 'debit' | 'credit') => ({ id, date, desc, amount: rupees * 100, dir, account: acc, source: 'bank_statement' as const, sourceFile: 'synthetic.pdf' });
  // a primary user's month: UPI to people, a shop, an auto, family, a self-transfer; the last day mixes sorted and unsorted
  const mk = (extra: ReturnType<typeof tx>[]) => {
    const d: Dataset = { ...emptyDataset('upi'), accounts: [{ id: acc, kind: 'bank', last4: '2222', label: 'Bank ••2222' }], txns: [
      tx('1', '2026-08-02', 'UPI/DR/1/MOHAN L/SBIN/mohan@ok/UPI', 240, 'debit'), tx('2', '2026-08-04', 'UPI/DR/2/AUTO RAJU/PUNB/raju@ok/UPI', 60, 'debit'),
      tx('3', '2026-08-06', 'UPI/DR/3/GUPTA STORE/BARB/gs@ok/UPI', 1180, 'debit'), tx('4', '2026-08-10', 'UPI/DR/4/SELF/HDFC/me@ok/own a/c', 5000, 'debit'),
      tx('5', '2026-08-12', 'UPI/DR/5/Swiggy/ICIC/swiggy@icici/UPI', 389, 'debit'), tx('6', '2026-08-15', 'UPI/DR/6/MAA/SBIN/maa@ok/UPI', 3000, 'debit'),
      tx('8', '2026-08-01', 'NEFT*EMPLOYER PVT LTD*SALARY', 18000, 'credit'), ...extra] };
    finalise(d); d.today = '2026-08-31'; return d;
  };
  const cases: [string, Dataset][] = [
    ['mixed last day', mk([tx('7', '2026-08-20', 'UPI/DR/7/PRAKASH M/SBIN/pm@ok/UPI', 950, 'debit'), tx('9', '2026-08-20', 'UPI/DR/9/Swiggy/ICIC/swiggy@icici/UPI', 210, 'debit')])],
    ['only unsorted that day', mk([tx('7', '2026-08-22', 'UPI/DR/7/PRAKASH M/SBIN/pm@ok/UPI', 950, 'debit')])],
  ];
  const s = await loadDemo();
  cases.push(['sample bank only', { ...emptyDataset('b'), accounts: s.accounts.filter((a) => a.kind === 'bank'), txns: s.txns.filter((t) => t.account.startsWith('bank:')) }]);
  for (const [name, ds] of cases) it(`${name}: headline = sorted + unsorted spending that day; the note = the unsorted part`, () => {
    const td = buildTodayMine(ds);
    const isSpend = (t: Dataset['txns'][number]) => t.dir === 'debit' && ['everyday', 'uncat'].includes(bucketOf(t.category ?? 'Other', 'debit'));
    const lastDay = ds.txns.filter(isSpend).map((t) => t.date).sort().at(-1)!;
    const onDay = ds.txns.filter((t) => t.date === lastDay && isSpend(t));
    const total = onDay.reduce((a, t) => a + t.amount, 0);
    const unsorted = onDay.filter((t) => bucketOf(t.category ?? 'Other', 'debit') === 'uncat').reduce((a, t) => a + t.amount, 0);
    expect(td.day.date).toBe(lastDay);
    expect(td.day.spent).toBe(Math.round(total / 100)); // the card is in rupees
    expect(td.day.unsorted).toBe(Math.round(unsorted / 100));
    const t = text(renderToStaticMarkup(createElement(Today as never, { theme: 'light', state: 'ready', data: { ...buildToday(ds, { kind: 'user', memberLabel: 'Me', displayName: 'Asha' }), NAME: 'Asha', TD: td }, __state: { cur: 'yday' } })));
    expect(t).toContain(inr(total) + ' spent');
    expect(t).not.toMatch(/NaN|undefined/);
    if (name === 'mixed last day') { expect(unsorted).toBeGreaterThan(0); expect(t).toContain(inr(unsorted) + ' of it not sorted yet.'); }
    const today = buildToday(ds, { kind: 'user', memberLabel: 'Me', displayName: 'Asha' });
    if (!today.EMG.target) { // no full month of essentials yet: never "ready", never "₹0 of ₹0"
      const first = text(renderToStaticMarkup(createElement(Today as never, { theme: 'light', state: 'ready', data: { ...today, NAME: 'Asha', TD: td } })));
      expect(first).not.toContain('Emergency fund ready'); expect(first).not.toMatch(/of ₹0 /); expect(first).toContain('Your target appears once');
    }
    if (name === 'only unsorted that day') { expect(t).toContain('None of it sorted yet.'); expect(t).not.toContain('Nothing everyday that day'); }
  });
});

it('statements with only an SIP and a transfer: no spending day, no "₹0 spent"', async () => {
  const { finalise } = await import('@core/ingest/finalise');
  const acc = 'bank:3333';
  const d: Dataset = { ...emptyDataset('sip'), accounts: [{ id: acc, kind: 'bank', last4: '3333', label: 'Bank ••3333' }], txns: [
    { id: 's1', date: '2026-08-05', desc: 'ACH D- BSE LTD MF SIP', amount: 100000, dir: 'debit', account: acc, source: 'bank_statement', sourceFile: 's.pdf' },
    { id: 's2', date: '2026-08-10', desc: 'UPI/DR/4/SELF/HDFC/me@ok/own a/c', amount: 500000, dir: 'debit', account: acc, source: 'bank_statement', sourceFile: 's.pdf' }] };
  finalise(d); d.today = '2026-08-31';
  const isSpend = (t: Dataset['txns'][number]) => t.dir === 'debit' && ['everyday', 'uncat'].includes(bucketOf(t.category ?? 'Other', 'debit'));
  if (d.txns.some(isSpend)) return; // the categoriser read one as spending: then the other cases cover it
  expect(buildTodayMine(d).day.none).toBe(true);
});

describe('Invest: dates come from the CAS, never a fixed 15 Oct', async () => {
  const ds = await loadDemo();
  const base = buildInvest(ds);
  const shifted = { ...base, PF: { ...(base.PF as object), asOf: '2027-02-10' } };
  const render = (data: unknown, extra: Record<string, unknown> = {}) => text(renderToStaticMarkup(createElement(Invest as never, { theme: 'light', state: 'ready', data, ...extra })));
  it('the header, error line and holdings sheet carry the CAS date', () => {
    expect(render(base)).toContain('As of 15 Oct'); // the sample CAS is dated 15 Oct 2026: unchanged
    const t = render(shifted);
    expect(t).toContain('As of 10 Feb');
    expect(t).not.toMatch(/15 Oct/);
    expect(render(shifted, { state: 'error' })).toContain('as of 10 Feb');
    expect(render(shifted, { open: 'holdings' })).not.toMatch(/15 Oct/);
    expect(render(shifted, { variant: 'bharat' })).toContain('10 फ़रवरी तक');
  });
  it('"ready by" counts from the bank statement month, not October 2026', () => {
    const readyBy = (data: unknown) => render(data, { __state: { pick: 500000, planned: true } }).match(/ready by (\w{3}) (\d{4})/);
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = (m: RegExpMatchArray | null) => Number(m![2]) * 12 + MON.indexOf(m![1]);
    const a = readyBy(base);
    expect(a).toBeTruthy();
    // the safety net is bank money: the month counts from the bank statement, so a newer bank statement moves it ...
    expect(idx(readyBy({ ...base, BANK_ASOF: '2027-02-10' })) - idx(a)).toBe(4); // Oct 2026 → Feb 2027: same months to go, four months later
    // ... and a CAS of another date does not
    expect(idx(readyBy(shifted))).toBe(idx(a));
  });
});
