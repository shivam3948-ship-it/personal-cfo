import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadDemo } from '@core/demo';
import { runEval, gates, toMarkdown } from '../evals/score';

// The eval set as a merge gate (tech/AI_EVALS.md): numbers 100% grounded, 0 advice violations, 0 privacy leaks.
// Routing, language and honesty must not fall below the recorded baseline (evals/baseline.json).
// `npm run eval` also writes the scorecard to evals/results/.
describe('Ask Munim eval set (no-key engine)', async () => {
  const s = await runEval(await loadDemo(), { offline: true });
  if (process.env.EVAL_WRITE) {
    const dir = path.join(__dirname, '..', 'evals', 'results'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${s.when}-${s.engine}.md`), toMarkdown(s));
    fs.writeFileSync(path.join(dir, `${s.when}-${s.engine}.json`), JSON.stringify(s, null, 1));
  }
  it('gates: grounded, advice, privacy', () => { expect(gates(s)).toEqual({ grounded: true, advice: true, privacy: true }); });
  it('no regression against the baseline', () => {
    const base = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'evals', 'baseline.json'), 'utf8')) as Record<string, number>;
    for (const [d, min] of Object.entries(base)) expect(s.dims[d]?.passed ?? 0, d).toBeGreaterThanOrEqual(min);
  });
});
