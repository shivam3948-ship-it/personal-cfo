// Live eval against Claude: `npm run eval:live` with ANTHROPIC_API_KEY set. Skipped otherwise (and in CI).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runClaude } from '@/lib/agent/claude';
import { demo } from './helpers';

const live = process.env.RUN_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;
const cases = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'evals/questions.json'), 'utf8')).cases as { id: string; q: string; lang: 'hi' | 'en'; tools_any: string[]; must_not_include?: string[] }[];

describe.skipIf(!live)('live Claude eval', () => {
  const rows: string[] = [];
  for (const c of cases) {
    it(`${c.id}`, async () => {
      const ds = await demo();
      const r = await runClaude([{ role: 'user', content: c.q }], { ds, sid: `live-${c.id}`, lang: c.lang });
      rows.push(`${c.id}\t${r.ms}ms\tverified=${r.check.ok}\ttools=${r.trace.map((t) => t.tool).join(',')}\t${r.answer.replace(/\s+/g, ' ')}`);
      if (c.tools_any.length) expect(r.trace.some((t) => c.tools_any.includes(t.tool))).toBe(true);
      for (const s of c.must_not_include ?? []) expect(r.answer.toLowerCase()).not.toContain(s.toLowerCase());
      expect(r.check.unverified).toEqual([]);
      expect(r.answer.split(/\s+/).length).toBeLessThan(110);
    }, 60000);
  }
  it('scorecard', () => { fs.mkdirSync('.data', { recursive: true }); fs.writeFileSync('.data/eval-live.tsv', rows.join('\n') + '\n'); console.log(rows.join('\n')); });
});
