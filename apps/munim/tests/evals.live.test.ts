// The eval set against live Claude (tech/AI_EVALS.md), the same gates as the no-key run: every figure grounded in a tool
// result, 0 advice violations (D-051), 0 privacy leaks. Run before real users get Claude answers, and after any prompt,
// model or tool change:
//   ANTHROPIC_API_KEY=… npm run eval:live            (all 82 cases, ~15 min, writes evals/results/<date>-claude.*)
//   EVAL_LIMIT=10 / EVAL_SET=heldout                  (a quick subset / the unseen Saathi questions)
// Skipped without a key, so `npm test` never calls the API. A case where Claude failed and the rules answered counts as
// a failure here: a live score that is secretly the rules engine's score would be worse than none.
import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadDemo } from '@core/demo';
import { MODEL } from '@core/llm';
import { runEval, gates, toMarkdown, type Scorecard } from '../evals/score';
import { CASES } from '../evals/cases';
import { HELDOUT } from '../evals/heldout';

const live = process.env.RUN_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;
const set = process.env.EVAL_SET === 'heldout' ? HELDOUT : process.env.EVAL_SET === 'all' ? [...CASES, ...HELDOUT] : CASES;
const cases = set.slice(0, Number(process.env.EVAL_LIMIT) || set.length);
const pctl = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0; };

describe.skipIf(!live)(`Ask Munim eval set, live Claude (${MODEL})`, () => {
  let s: Scorecard;
  beforeAll(async () => {
    s = await runEval(await loadDemo(), { offline: false, cases });
    const ms = s.results.map((r) => r.ms);
    const latency = `\n\n**Latency per case (all turns, server side):** p50 ${(pctl(ms, 50) / 1000).toFixed(1)} s · p90 ${(pctl(ms, 90) / 1000).toFixed(1)} s · model ${MODEL} · fell back to rules: ${s.results.filter((r) => r.fellBack).length}\n`;
    if (process.env.EVAL_WRITE) {
      const dir = path.join(__dirname, '..', 'evals', 'results'); fs.mkdirSync(dir, { recursive: true });
      const tag = `${s.when}-claude${process.env.EVAL_SET ? `-${process.env.EVAL_SET}` : ''}${process.env.EVAL_LIMIT ? `-first${cases.length}` : ''}`;
      fs.writeFileSync(path.join(dir, `${tag}.md`), toMarkdown(s) + latency);
      fs.writeFileSync(path.join(dir, `${tag}.json`), JSON.stringify({ ...s, model: MODEL }, null, 1));
    }
    console.log(`${s.passed}/${s.n} pass${latency}`);
  }, 45 * 60_000);

  it('every case was answered by Claude, not the rules fallback', () => {
    expect(s.results.filter((r) => r.fellBack).map((r) => r.id)).toEqual([]);
  });
  it('gates: grounded, advice, privacy', () => { expect(gates(s)).toEqual({ grounded: true, advice: true, privacy: true }); });
  it('no regression against the live baseline, once one is recorded', () => {
    const f = path.join(__dirname, '..', 'evals', 'baseline.live.json');
    if (!fs.existsSync(f) || process.env.EVAL_LIMIT || process.env.EVAL_SET) return; // first full run sets the bar: copy its dims into baseline.live.json
    const base = JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, number>;
    for (const [d, min] of Object.entries(base)) expect(s.dims[d]?.passed ?? 0, d).toBeGreaterThanOrEqual(min);
  });
});
