import { describe, it, expect } from 'vitest';
import { VIEWS } from '@/lib/views/registry';
import { emptyDataset } from '@core/types';
import { loadDemo } from '@core/demo';
import type { Session } from '@/lib/session';

// The owner, 15 Nov: "We should never mix sample data with uploaded data, the 2 modes should run separately." Your own data is
// folded into a frame built from an EMPTY dataset (/api/view/<screen>?base=empty), never into the sample family's view.
const own: Session = { id: 'mine', kind: 'user', memberLabel: 'Me', displayName: null, adviceMode: 'guided', dataset: async () => emptyDataset() };

describe('the own-data frame carries nothing from the sample family', async () => {
  const demo = await loadDemo();
  // names and amounts that only the sample family has: its people, its bank, its merchants
  const sampleMarks = [...new Set([...demo.accounts.map((a) => a.label), ...demo.txns.slice(0, 40).map((t) => t.merchant ?? '').filter((m) => m.length > 5)])];
  for (const k of Object.keys(VIEWS) as (keyof typeof VIEWS)[]) {
    it(`${k}: builds from an empty dataset without sample names`, () => {
      const v = JSON.stringify(VIEWS[k](emptyDataset(), own));
      expect(v).not.toContain('Rohan');
      for (const m of sampleMarks) expect(v, m).not.toContain(m);
    });
  }
});

// The screens themselves carry text written for the sample family (its loan, its policies): on your data none of it may show,
// in any sheet (compliance review, 15 Nov).
describe('Invest on your own data shows none of the sample family’s own text', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { buildInvest } = await import('@/lib/views/invest');
  const Invest = (await import('@/screens/Invest')).default;
  const demo = await loadDemo();
  const SAMPLE_ONLY = ['Orbit', 'Tarang', 'Suraksha', 'Bharosa', 'father', 'पिताजी', 'already invest', 'पहले से हर महीने'];
  const mine = { ...buildInvest(demo, { adviceMode: 'guided' }), CAS_SRC: 'yours', TERM_COVER: 0, ENDOW: null };
  for (const open of ['none', 'plan', 'path', 'cover', 'cas', 'holdings']) for (const variant of ['en', 'bharat']) {
    it(`sheet ${open}, ${variant}`, () => {
      const html = renderToStaticMarkup(createElement(Invest as never, { theme: 'light', data: mine, state: 'ready', open, variant }));
      for (const w of SAMPLE_ONLY) expect(html, w).not.toContain(w);
    });
  }
});
describe('the same check catches the sample text on the sample family (so it would catch a leak)', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { buildInvest } = await import('@/lib/views/invest');
  const Invest = (await import('@/screens/Invest')).default;
  it('sample: the cover sheet names its policy, the plan sheet its loan', async () => {
    const data = buildInvest(await loadDemo());
    expect(renderToStaticMarkup(createElement(Invest as never, { theme: 'light', data, state: 'ready', open: 'cover' }))).toContain('Tarang');
    expect(renderToStaticMarkup(createElement(Invest as never, { theme: 'light', data, state: 'ready', open: 'plan' }))).toContain('Orbit');
  });
});
