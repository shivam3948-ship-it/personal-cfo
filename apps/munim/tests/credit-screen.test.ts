import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadDemo } from '@core/demo';
import { emptyDataset } from '@core/types';
import { creditPicture } from '@core/finance/credit';
import { inr } from '@core/money';
import { buildCredit } from '@/lib/views/credit';
import Credit from '@/screens/Credit';

const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const render = (data: unknown, variant: 'standard' | 'bharat' = 'standard') => text(renderToStaticMarkup(createElement(Credit as never, { theme: 'light', variant, data } as never)));
const R0 = (p: number) => inr(Math.round(p / 100) * 100);

// D-094: every figure the Credit tab shows equals the engine's (testing rule D-076)
describe('Credit tab', () => {
  it('sample family: what you owe, EMIs, due list, cards, loans and score come from the engine', async () => {
    const ds = await loadDemo(); const c = creditPicture(ds);
    for (const v of ['standard', 'bharat'] as const) {
      const t = render(buildCredit(ds), v);
      expect(t).not.toMatch(/NaN|undefined|null/);
      expect(t).toContain(R0(c.owe.total));
      expect(t).toContain(R0(c.monthlyEmi));
      for (const l of c.loans) { expect(t).toContain(l.lender); expect(t).toContain(R0(l.outstanding)); }
      for (const d of c.due) expect(t).toContain(inr(d.amount, 'auto'));
      expect(t).toContain(String(c.score!.score));
    }
    const en = render(buildCredit(ds));
    expect(en).toContain(`EMIs: ${R0(c.monthlyEmi)} a month · ${c.emiShareOfSalary}% of your salary`);
    expect(en).toContain('Due next'); expect(en).toContain('Your cards'); expect(en).toContain('down 23 since the last report');
    expect(en).toContain('Munim never moves money or suggests a lender or card');
  });
  it('no statements yet: an empty state, and the report fake door stays', () => {
    const t = render(buildCredit({ ...emptyDataset() }));
    expect(t).toContain('Nothing to show yet'); expect(t).toContain('Your credit report'); expect(t).not.toMatch(/NaN|undefined/);
  });
});
