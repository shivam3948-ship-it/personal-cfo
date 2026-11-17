import { describe, it, expect, vi } from 'vitest';
// renders a screen with a given tap state (the bills sheet open), the way useDC would after setState
vi.mock('@/ui/dc', async (orig) => {
  const m = await orig<typeof import('@/ui/dc')>();
  return { ...m, useDC: (C: new (p: Record<string, unknown>) => { state: object; renderVals: () => unknown }, props: Record<string, unknown>) => { const i = new C(props); i.state = { ...i.state, ...((props.__state as object) ?? {}) }; return i.renderVals(); } };
});
import { emptyDataset, type CardStatement, type Txn } from '@core/types';
import { buildTodayMine } from '@/lib/views/todayMine';
import { buildTransactions } from '@/lib/views/spends';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadDemo } from '@core/demo';
import { buildToday } from '@/lib/views/today';
import Today from '@/screens/Today';
const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// D-092, shaped like the owner's two October card statements: both bills due 5 Nov, the statements end 18 Oct
const stmt = (x: Partial<CardStatement>): CardStatement => ({ account: 'card:8747', file: 'hdfc.pdf', periodStart: '2026-09-17', periodEnd: '2026-10-16', dueDate: '2026-11-05',
  prevBalance: 3275808, payments: 3480757, purchases: 3068900, credits: 0, charges: 0, totalDue: 2864000, minDue: 144000, limit: 50000000, ...x });
let n = 0;
const tx = (x: Partial<Txn>): Txn => ({ id: `t${++n}`, date: '2026-10-10', desc: 'SWIGGY', amount: 50000, dir: 'debit', account: 'card:8747', source: 'card_statement', sourceFile: 'hdfc.pdf', category: 'Food delivery', merchant: 'Swiggy', ...x });
const ds = () => ({ ...emptyDataset(), accounts: [{ id: 'card:8747', kind: 'card' as const, label: 'HDFC Bank credit card', last4: '8747' }, { id: 'card:7001', kind: 'card' as const, label: 'ICICI Bank credit card', last4: '7001' }],
  cardStatements: [stmt({}), stmt({ account: 'card:7001', file: 'icici.pdf', periodStart: '2026-09-19', periodEnd: '2026-10-18', totalDue: 774355, minDue: 39000, limit: 30000000 })],
  txns: [tx({ date: '2026-10-15' }), tx({ account: 'card:7001', sourceFile: 'icici.pdf', date: '2026-10-17', desc: 'ANTHROPIC', merchant: 'Anthropic', category: 'Subscriptions', amount: 1152842 }),
    tx({ account: 'card:7001', sourceFile: 'icici-jul.pdf', date: '2026-07-30', desc: 'IBIBO GROUP PVT LTD', merchant: 'IBIBO GROUP PVT LTD', category: 'Travel', amount: 1960000 }),
    tx({ account: 'card:7001', sourceFile: 'icici.pdf', dir: 'credit', date: '2026-10-18', desc: 'IBIBO GROUP PRIVATE LIMITED', merchant: 'IBIBO GROUP PRIVATE LIMITED', category: 'Refund', amount: 855100 })] });

describe('card bills on Today (D-092)', () => {
  it('both cards count, each with its minimum warning and limit used', () => {
    const t = buildTodayMine(ds());
    expect(t.bill).toMatchObject({ amount: 36384, count: 2, due: '5 Nov' }); // ₹28,640 + ₹7,743.55, to the rupee
    expect(t.bills).toHaveLength(2);
    const icici = t.bills!.find((b) => b.name.includes('7001'))!;
    expect(icici.head).toBe('₹7,743.55 · due 5 Nov');
    expect(icici.line).toContain('Minimum ₹390. Pay the full ₹7,743.55');
    expect(icici.used).toBe('This bill uses 2.6% of your ₹3,00,000 limit');
    expect(icici.name).toBe('ICICI Bank credit card ••7001');
    expect(t.bills!.find((b) => b.name.includes('8747'))!.used).toContain('5.7%');
  });
  it('a refund shows the purchase it goes with', () => {
    const tx = buildTransactions(ds()).TX as unknown[][];
    const row = tx.find((r) => r[3] === 'IBIBO GROUP PRIVATE LIMITED')!;
    expect(row[6]).toEqual({ en: 'Probably part of ₹19,600 paid to Ibibo Group Pvt Ltd on 30 Jul', hi: 'शायद 30 जुलाई को Ibibo Group Pvt Ltd को दिए ₹19,600 का हिस्सा' });
  });
});

describe('the Today screen shows the engine’s bills', () => {
  it('the row sums both cards; the sheet lists each one', async () => {
    const base = buildToday(await loadDemo(), { kind: 'user', memberLabel: 'Me', displayName: 'Asha' });
    const td = buildTodayMine(ds());
    for (const variant of ['standard', 'bharat'] as const) {
      const t = text(renderToStaticMarkup(createElement(Today as never, { theme: 'light', state: 'ready', variant, data: { ...base, NAME: 'Asha', TD: td }, __state: { bills: true } })));
      expect(t).not.toMatch(/NaN|undefined/);
      if (variant === 'standard') {
        expect(t).toContain('Card bill ₹36,384 · 2 cards · due 5 Nov');
        expect(t).toContain('Your card bills');
        for (const b of td.bills!) { expect(t).toContain(b.head); expect(t).toContain(b.used); }
      } else {
        expect(t).toContain('आपके कार्ड बिल');
        for (const b of td.bills!) expect(t).toContain(b.lineHi.slice(0, 30));
      }
    }
  });
});

describe('bill copy before and after the due date (review, 8 Nov)', () => {
  it('no interest or late fee is claimed while there is still time', async () => {
    const { billLines } = await import('@/lib/views/todayMine');
    const b = { account: 'card:8747', last4: '8747', file: 'h.pdf', periodEnd: '2026-10-16', dueDate: '2026-11-05', totalDue: 2864000, minDue: 144000, paid: 144000, status: 'paid_min' as const, pastDue: false };
    expect(billLines(b).line).toBe('₹1,440 paid so far, at least the minimum. Pay the other ₹27,200 by 5 Nov to avoid interest.');
    expect(billLines({ ...b, pastDue: true }).line).toContain('On most cards interest is now running');
    expect(billLines({ ...b, status: 'paid_part', paid: 50000 }).line).not.toMatch(/late fee/);
    expect(billLines({ ...b, status: 'due', paid: 0 }).line).toContain('on most cards');
  });
});
