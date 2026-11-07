// Invest and Portfolio x-ray in Hindi (variant 'bharat'): every state, sheet and advice mode reads in Hindi; only data names
// (funds, stocks, the sample family's policies and lender) and the allowed Latin terms stay in English. English is unchanged.
/* eslint-disable @typescript-eslint/no-explicit-any */
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
    const ud = (v: number) => (v < 0 ? `down ${Math.abs(v)}%` : `up ${v}%`);
    expect(x).toContain(`Your SIP instalments are ${ud(h.sip.ratePct!)} a year so far; one-time investments ${ud(h.oneTime.ratePct!)}`);
    const xh = text(render(Xray, { variant: 'bharat', data: buildXray(ds, { adviceMode: 'guided' }) }));
    expect(xh).toContain(`नियमित SIP की किश्तें सालाना ${h.sip.ratePct}% बढ़ीं`);
  });
});

describe('What you own (2 Nov)', () => {
  it('each fund\'s gain and share on screen equal the engine; the mix covers the whole portfolio', async () => {
    const { portfolioView } = await import('@core/portfolio/engine');
    const v = portfolioView(ds.portfolio!.holdings, ds.portfolio!.asOf);
    const x = text(render(Xray, { variant: 'standard', data: buildXray(ds, { adviceMode: 'guided' }) }));
    const inr = (p: number) => '₹' + Math.round(Math.abs(p) / 100).toLocaleString('en-IN');
    for (const f of v.funds) {
      expect(x, f.shortName).toContain((f.gain >= 0 ? '+' : '−') + inr(f.gain));
      expect(x, f.shortName).toContain(Math.round(f.value / v.value * 100) + '%');
    }
    const shares = v.mix.map((m) => m.value).reduce((a, b) => a + b, 0);
    expect(shares).toBe(v.value);
  });
});

describe('Against its index and same kind of fund (3 Nov)', () => {
  it('the index card shows the engine\'s comparison, in English and Hindi', async () => {
    const { vsBenchmarks } = await import('@core/portfolio/engine');
    const s: [string, number][] = []; for (let y = 2019; y <= 2026; y++) for (let m = 1; m <= 12; m++) s.push([`${y}-${String(m).padStart(2, '0')}-01`, 100 * Math.pow(1.01, (y - 2019) * 12 + m)]);
    const bench = vsBenchmarks(ds.portfolio!.holdings, { nifty500: s, smallcap250: s, nifty50: s, midcap150: s }, ds.portfolio!.asOf);
    expect(bench.rows.length).toBeGreaterThan(0);
    const data = buildXray(ds, { adviceMode: 'guided' }); (data.XR as Record<string, unknown>).bench = bench;
    const x = text(render(Xray, { variant: 'standard', open: 'details', data }));
    const beat = bench.rows.filter((r) => r.diff > 0).length;
    expect(x).toContain(`${beat} of ${bench.rows.length} funds beat their index on your dates`);
    const inr = (p: number) => '₹' + Math.round(Math.abs(p) / 100).toLocaleString('en-IN');
    for (const r of bench.rows) expect(x).toContain(`${r.fund}: ${inr(r.fundValue)}; in the`);
    expect(x).toContain(inr(bench.rows[0].benchValue));
    const xh = text(render(Xray, { variant: 'bharat', open: 'details', data }));
    expect(xh).toContain(`${bench.rows.length} में से ${beat} फ़ंड आपकी तारीख़ों पर अपने इंडेक्स से आगे`);
  });
  it('same kind of fund shows when real overlap isn\'t known', () => {
    const data = buildXray(ds, { adviceMode: 'guided' });
    const X3 = data.X3 as { overlap: { pairs: unknown[]; top5: unknown[] }; sameCat: unknown };
    const d2 = { ...data, X3: { ...X3, overlap: { ...X3.overlap, pairs: [], top5: [] }, sameCat: [{ category: 'Flexi cap', funds: ['Kestrel Flexi Cap', 'Other Flexi Cap'], value: 70000000 }] } };
    const x = text(render(Xray, { variant: 'standard', open: 'details', data: d2 }));
    expect(x).toContain('You hold 2 flexi cap funds');
    expect(x).toContain('a sign, not a measure of overlap');
  });
});

// owner's CAS, 7 Nov: falls read as falls, a worse-than-FD gap says "less", multi-asset funds aren't "debt", two HDFC funds
// get their own bar labels, the funds a CAS starts part-way through are named, and your own data is never in demo mode
describe('X-ray on a portfolio like the owner\'s (7 Nov)', () => {
  it('reads correctly when things went down', () => {
    const data = buildXray(ds, { adviceMode: 'guided' }) as Record<string, any>;
    const PF = { ...data.PF, habit: { sip: -5.5, one: 4.8 } }, X3 = { ...data.X3, fd: { ...data.X3.fd, extra: -5253200 } };
    const fundsMix = PF.funds.map((f: unknown[], i: number) => (i === 0 ? [...f.slice(0, 3), 'hybrid', ...f.slice(4)] : f));
    const x = text(render(Xray, { variant: 'standard', data: { ...data, PF: { ...PF, funds: fundsMix }, X3, MISSING: ['Parag Parikh Flexi Cap', 'Canara Robeco Large Cap'] } }));
    expect(x).toContain('Your SIP instalments are down 5.5% a year so far; one-time investments up 4.8%');
    expect(x).toContain('₹52,532 less');
    expect(x).not.toMatch(/₹-|grown -/);
    expect(x).toMatch(/Hybrid \d+%/); expect(x).not.toMatch(/· debt \d+%/);
    expect(x).toContain('2 not included');
    expect(x).toContain('Not included: Parag Parikh Flexi Cap, Canara Robeco Large Cap.');
    const xh = text(render(Xray, { variant: 'bharat', data: { ...data, PF, X3 } }));
    expect(xh).toContain('किश्तें सालाना 5.5% घटीं'); expect(xh).toContain('पैसा सालाना 4.8% बढ़ा');
  });
  it('names each fund on its index bar', async () => {
    const { vsBenchmarks } = await import('@core/portfolio/engine');
    const s: [string, number][] = [['2015-01-01', 10], ['2026-12-31', 20]];
    const bench = vsBenchmarks(ds.portfolio!.holdings, { nifty500: s, smallcap250: s, nifty50: s, midcap150: s }, ds.portfolio!.asOf);
    const data = buildXray(ds, { adviceMode: 'guided' }); (data.XR as Record<string, unknown>).bench = bench;
    const x = text(render(Xray, { variant: 'standard', open: 'details', data }));
    for (const r of bench.rows) expect(x).toContain(`${r.fund} vs `);
  });
});
