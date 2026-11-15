import { describe, it, expect } from 'vitest';
import { sentenceSpeaker } from '@/lib/agent/claude';
import { knownProducts, strangerProducts } from '@/lib/agent/brands';
import { fundLabels, heldNames } from '@/lib/agent/funds';
import { exitIndices } from '@/lib/agent/tradeWords';
import { checkNumbers } from '@core/agent/guard';
import { STREAM_ATTACKS } from '../evals/redteam/streaming';


// D-100 red team: nothing the voice says while the answer is written may break a rule the finished answer is checked for.
const holding = { isin: 'INF000000001', scheme: 'Example Small Cap Fund - Direct Plan - Growth', amc: 'Example', plan: 'Direct', category: 'Small cap', asset: 'equity', flows: [], units: 1, nav: 1, navDate: '2026-11-01', cost: 0, value: 100000 } as never;
const funds = fundLabels([holding], 'en'), held = heldNames(funds), known = knownProducts([holding], [], [], []);
const results = [{ spent: 5874 }];

describe('red team: voicing while writing (D-100)', () => {
  for (const c of STREAM_ATTACKS) it(`${c.id}: ${c.why}`, () => {
    const said: string[] = [];
    const sp = sentenceSpeaker({ adviceMode: 'guided' }, results, funds, known, (x) => said.push(x));
    for (let i = 0; i < c.text.length; i += 7) sp.push(c.text.slice(i, i + 7)); sp.end(); // small pieces, as a stream arrives
    expect(c.never.test(c.text)).toBe(true); // the case is real: the text carries the thing that must not be said
    const all = said.join(' ');
    expect(all, all).not.toMatch(c.never);
    expect(exitIndices(all, held), all).toEqual([]);
    expect(strangerProducts(all, known), all).toEqual([]);
    expect(checkNumbers(all, results).ok, all).toBe(true);
  });
});
