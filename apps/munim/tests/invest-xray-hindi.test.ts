// Invest and Portfolio x-ray in Hindi (variant 'bharat'): every state, sheet and advice mode reads in Hindi; only data names
// (funds, stocks, the sample family's policies and lender) and the allowed Latin terms stay in English. English is unchanged.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadDemo } from '@core/demo';
import { buildInvest, buildXray } from '@/lib/views/invest';
import { DISCLAIMER, type AdviceMode } from '@/lib/advice';
import Invest from '@/screens/Invest';
import Xray from '@/screens/Xray';

type Props = Record<string, unknown>;
const render = (C: (p: Props) => unknown, p: Props) => renderToStaticMarkup(createElement(C as never, { theme: 'light', ...p }));
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
/** Visible text plus aria-labels, without the CSS block (it names fonts). */
const text = (html: string) => {
  const h = html.replace(/<style>[\s\S]*?<\/style>/g, '');
  const aria = [...h.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).join(' ');
  return unesc(h.replace(/<[^>]+>/g, ' ') + ' ' + aria);
};
const TERMS = ['SIP', 'EMI', 'UPI', 'FD', 'RD', 'KYC', 'PDF', 'CAS', 'XIRR', 'ELSS', 'NAV', 'app', 'SEBI'];
// proper names in the sample's own documents: policies, lender, CAS services
const NAMES = ['Tarang', 'Suraksha', 'Bharosa', 'Jeevan', 'Nidhi', 'Orbit', 'CAMS', 'KFintech', 'MF', 'Central', 'NSDL', 'CDSL'];
const latin = (t: string, allow: Set<string>) => [...new Set(t.match(/[A-Za-z][A-Za-z'’]*/g) ?? [])].filter((w) => !allow.has(w));
const MODES: AdviceMode[] = ['demo', 'internal', 'guided', 'advised'];

const ds = await loadDemo();
describe('Invest and X-ray in Hindi', () => {
  const inv = buildInvest(ds);
  const pf = inv.PF as unknown as { funds: unknown[][] };
  const xr0 = buildXray(ds, { adviceMode: 'advised' }) as unknown as { X3: { overlap: { top5: [string][]; in3plus: string[] } } };
  const dataWords = [...pf.funds.map((f) => String(f[0])), ...xr0.X3.overlap.top5.map((t) => t[0]), ...xr0.X3.overlap.in3plus].flatMap((n) => n.split(/[\s&]+/));
  const allow = new Set([...TERMS, ...NAMES, ...dataWords]);

  it('Invest: every state, CAS state and sheet has no English left', () => {
    for (const state of ['ready', 'loading', 'error', 'empty']) for (const cas of ['added', 'none']) for (const open of ['none', 'plan', 'path', 'cover', 'cas', 'holdings']) {
      const t = text(render(Invest, { variant: 'bharat', state, cas, open, data: inv }));
      expect(latin(t, allow), `${state}/${cas}/${open}`).toEqual([]);
      expect(t).not.toMatch(/Munim/);
    }
    const t = text(render(Invest, { variant: 'bharat', state: 'ready', data: inv }));
    expect(t).toContain(DISCLAIMER.demo.hi);
    expect(t).toContain('क्या आपका निवेश काम कर रहा है?');
    expect(t).toContain('जनवरी 2021 से एक भी SIP नहीं रुकी');
  });

  it('X-ray: every advice mode, open state and history has no English left, and carries its Hindi disclaimer', () => {
    for (const mode of MODES) {
      const x = buildXray(ds, { adviceMode: mode });
      for (const open of ['none', 'details', 'plan']) for (const history of ['none', 'preview']) {
        const t = text(render(Xray, { variant: 'bharat', open, history, data: x }));
        expect(latin(t, allow), `${mode}/${open}/${history}`).toEqual([]);
        expect(t).not.toMatch(/Munim/);
        expect(t).toContain(DISCLAIMER[mode].hi);
      }
    }
  });

  it('X-ray: the named-fund plan stays advised-only in Hindi (D-051)', () => {
    for (const mode of MODES) {
      const t = text(render(Xray, { variant: 'bharat', open: 'plan', data: buildXray(ds, { adviceMode: mode }) }));
      const named = mode === 'advised';
      for (const s of ['प्लान देखें', 'यहाँ से शुरू', 'एक कदम, दो फ़ायदे', 'सबसे पुरानी यूनिट चुनें', 'Kestrel Flexi Cap और Monsoon Small Cap'])
        expect(t.includes(s), `${mode}: ${s}`).toBe(named);
    }
  });

  it('standard (English) output is unchanged in its key lines and has no Hindi', () => {
    const i = text(render(Invest, { variant: 'standard', state: 'ready', data: inv }));
    for (const s of ['Invest', 'As of 15 Oct', 'Is your investing working?', '5 things worth acting on', 'Grow your safety net to 6 months',
      `SIPs ${(inv.PF as { habit: { sip: number; one: number } }).habit.sip}% a year, one-time ${(inv.PF as { habit: { sip: number; one: number } }).habit.one}% · no SIP paused since Jan 2021`, 'Test build on sample data. For education only, not investment advice.']) expect(i).toContain(s);
    expect(i).not.toMatch(/[ऀ-ॿ]/);
    for (const mode of MODES) {
      const x = text(render(Xray, { open: 'details', history: 'preview', data: buildXray(ds, { adviceMode: mode }) }));
      for (const s of ['Portfolio x-ray', '5 things worth acting on', 'Your money earned', 'than a 7% FD on the same dates. No SIP paused or sold since Jan 2021.',
        '₹1,25,000 of this year’s tax-free gains limit is unused (lapses 31 Mar)', 'Your money vs your funds', DISCLAIMER[mode].en]) expect(x).toContain(s);
      expect(x).not.toMatch(/[ऀ-ॿ]/);
    }
  });
});

describe('SIPs vs one-time investments (2 Nov)', () => {
  it('the screens show the engine\'s split, and the split adds up from the CAS', async () => {
    const { sipVsOneTime } = await import('@core/portfolio/engine');
    const h = sipVsOneTime(ds.portfolio!.holdings, ds.portfolio!.asOf)!;
    expect(h.sip.buys + h.oneTime.buys).toBe(ds.portfolio!.holdings.flatMap((x) => x.flows).filter((f) => f.amount < 0).length); // every purchase counted once
    expect(h.sip.invested + h.oneTime.invested).toBe(-ds.portfolio!.holdings.flatMap((x) => x.flows).filter((f) => f.amount < 0).reduce((a, f) => a + f.amount, 0));
    const x = text(render(Xray, { variant: 'standard', data: buildXray(ds, { adviceMode: 'guided' }) }));
    expect(x).toContain(`Your SIP instalments have grown ${h.sip.ratePct}% a year so far; one-time investments ${h.oneTime.ratePct}%`);
    const xh = text(render(Xray, { variant: 'bharat', data: buildXray(ds, { adviceMode: 'guided' }) }));
    expect(xh).toContain(`नियमित SIP की किश्तें सालाना ${h.sip.ratePct}% बढ़ीं`);
  });
});
