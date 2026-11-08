// The eval set through the deployed site (D-095): same cases, same scoring and gates as evals.live.test.ts, but every answer
// comes from /api/ask on the live site, where the API keys live. For changes that can be switched per request, like prefetch:
//   RUN_SITE=1 npm run eval:site                         (live site, as it is)
//   RUN_SITE=1 EVAL_PREFETCH=1 npm run eval:site         (the same, asking for prefetch; needs MUNIM_PREFETCH=test on the site)
// Cases in private (advice) mode are left out: the site's mode is the server's. Skipped unless RUN_SITE=1.
import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadDemo } from '@core/demo';
import { runEval, gates, toMarkdown, type Scorecard, type Responder } from '../evals/score';
import { CASES } from '../evals/cases';

const on = process.env.RUN_SITE === '1';
const URL_ = (process.env.EVAL_SITE_URL || 'https://personal-cfo-ruddy.vercel.app').replace(/\/$/, '');
const prefetch = process.env.EVAL_PREFETCH === '1';
const ids = (process.env.EVAL_IDS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const cases = (ids.length ? CASES.filter((c) => ids.includes(c.id)) : CASES).filter((c) => !c.mode || c.mode === 'demo' || c.mode === 'guided').slice(0, Number(process.env.EVAL_LIMIT) || Infinity);

const viaSite: Responder = async (history) => {
  let j: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let i = 0; i < 3; i++) { // the site rate-limits bursts: wait and retry
    const r = await fetch(`${URL_}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history, ...(prefetch ? { prefetch: true } : {}) }) });
    j = await r.json().catch(() => ({}));
    if (r.status !== 429) break;
    await new Promise((res) => setTimeout(res, 20_000));
  }
  return { answer: j.answer ?? '', lang: j.lang ?? 'en', engine: j.engine ?? 'rules', check: j.check ?? { ok: false, checked: 0, unverified: ['no answer'] }, actions: [],
    trace: (j.tools ?? []).map((tool: string) => ({ tool, input: {}, result: {}, ms: 0 })), ms: j.ms ?? 0, llm: j.llm, adviceFired: !!j.adviceFired,
    ...(j.fallback ? { fallbackReason: 'site fell back to rules' } : {}) } as never;
};

describe.skipIf(!on)(`Ask Munim eval set, through ${URL_}${prefetch ? ' (prefetch)' : ''}`, () => {
  let s: Scorecard;
  beforeAll(async () => {
    s = await runEval(await loadDemo(), { offline: false, cases, respond: viaSite });
    const llm = s.results.map((r) => r.ms);
    const p50 = [...llm].sort((a, b) => a - b)[Math.floor(llm.length / 2)] ?? 0;
    const note = `\n\n**Site:** ${URL_} · prefetch ${prefetch ? 'asked' : 'not asked'} · ${cases.length} cases (private-mode cases left out) · p50 per case ${(p50 / 1000).toFixed(1)} s`;
    if (process.env.EVAL_WRITE) {
      const dir = path.join(__dirname, '..', 'evals', 'results'); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${s.when}-site${prefetch ? '-prefetch' : ''}.md`), toMarkdown(s) + note);
      fs.writeFileSync(path.join(dir, `${s.when}-site${prefetch ? '-prefetch' : ''}.json`), JSON.stringify(s, null, 1));
    }
    console.log(`${s.passed}/${s.n} pass${note}`);
  }, 60 * 60_000);
  it('every case was answered by Claude, not the rules fallback', () => { expect(s.results.filter((r) => r.fellBack || r.engine !== 'claude').map((r) => r.id)).toEqual([]); });
  it('gates: grounded, advice, privacy', () => { expect(gates(s)).toEqual({ grounded: true, advice: true, privacy: true, ...(s.dims.safe ? { safe: true } : {}), ...(s.dims.quiet ? { quiet: true } : {}) }); });
});
