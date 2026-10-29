// Voice latency, stage by stage (latency sprint, D-073). Plays the same synthetic questions (public/evals/voice: two Hindi,
// two English, made with an open TTS voice, no real person) through the live site's own endpoints, the way the phone does:
// hearing (/api/stt), answering (/api/ask), first sentence spoken (/api/tts). The phone's wait for silence (1.4 s) comes on
// top and is fixed. Run before and after every latency change:
//   npm run voice:latency                         (live site; LATENCY_URL=http://localhost:3000 for a local build)
//   LATENCY_REPS=5 npm run voice:latency          (more repeats; default 3)
// Writes evals/results/<date>-latency.md. Skipped unless RUN_LIVE=1, so `npm test` never calls the services.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { splitForSpeech } from '@core/agent/lang';

const live = process.env.RUN_LIVE === '1';
const URL_ = (process.env.LATENCY_URL || 'https://personal-cfo-ruddy.vercel.app').replace(/\/$/, '');
const REPS = Math.max(1, Number(process.env.LATENCY_REPS) || 3);
const CLIPS = ['hi-where', 'hi-sell', 'en-bonus', 'en-bills'];
const SILENCE_MS = 1400; // ui/voice.ts record(): silence after speech before the clip is sent
const p50 = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)] ?? 0; };
const sec = (ms: number) => (ms / 1000).toFixed(1);

interface Row { clip: string; transcript: string; stt: number; ask: number; server: number; calls: number; llmMs: number; cacheRead: number; input: number; tts: number; total: number; engine: string; guard?: string }

async function timed<T>(f: () => Promise<T>): Promise<[T, number]> { const t = performance.now(); const r = await f(); return [r, Math.round(performance.now() - t)]; }

async function turn(clip: string): Promise<Row> {
  const audio = fs.readFileSync(path.join(__dirname, '..', 'public', 'evals', 'voice', `${clip}.webm`));
  const form = new FormData(); form.append('file', new Blob([audio], { type: 'audio/webm' }), 'speech.webm'); form.append('lang', 'auto');
  const [stt, sttMs] = await timed(async () => (await fetch(`${URL_}/api/stt`, { method: 'POST', body: form })).json() as Promise<{ transcript?: string; lang?: string }>);
  const q = stt.transcript ?? '';
  const [ask, askMs] = await timed(async () => (await fetch(`${URL_}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: q }], lang: 'auto' }) })).json() as Promise<{ answer?: string; spoken?: string; lang?: string; ms?: number; engine?: string; guard?: string; llm?: { calls: number; ms: number; cacheRead: number; input: number } }>);
  const lang = /[ऀ-ॿ]/.test(ask.spoken ?? ask.answer ?? '') ? 'hi' : 'en';
  const first = splitForSpeech(ask.spoken ?? ask.answer ?? '')[0] ?? '';
  const [, ttsMs] = await timed(async () => (await fetch(`${URL_}/api/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: first, lang }) })).json());
  return { clip, transcript: q, stt: sttMs, ask: askMs, server: ask.ms ?? 0, calls: ask.llm?.calls ?? 0, llmMs: ask.llm?.ms ?? 0, cacheRead: ask.llm?.cacheRead ?? 0, input: ask.llm?.input ?? 0,
    tts: ttsMs, total: SILENCE_MS + sttMs + askMs + ttsMs, engine: ask.engine ?? '?', guard: ask.guard };
}

describe.skipIf(!live)(`voice latency, ${URL_}`, () => {
  it('times every stage', async () => {
    const rows: Row[] = [];
    for (let r = 0; r < REPS; r++) for (const c of CLIPS) rows.push(await turn(c));
    const by = (c: string) => rows.filter((x) => x.clip === c);
    const line = (label: string, rs: Row[]) => `| ${label} | ${sec(SILENCE_MS)} | ${sec(p50(rs.map((x) => x.stt)))} | ${sec(p50(rs.map((x) => x.ask)))} | ${p50(rs.map((x) => x.calls))} | ${sec(p50(rs.map((x) => x.llmMs)))} | ${p50(rs.map((x) => x.cacheRead))} | ${sec(p50(rs.map((x) => x.tts)))} | **${sec(p50(rs.map((x) => x.total)))}** |`;
    const md = `# Voice latency · ${new Date().toISOString().slice(0, 10)} · ${URL_}\n\nMedian of ${REPS} runs per question, seconds, end of speech → first sound (the phone's play start adds ~0.3 s).\n\n`
      + `| Question | Silence wait | Hearing | Answering | Model calls | of which model | Cached tokens read | First sentence voiced | **Total** |\n|---|---|---|---|---|---|---|---|---|\n`
      + CLIPS.map((c) => line(c, by(c))).join('\n') + '\n' + line('**all**', rows) + '\n\n'
      + `Engines: ${[...new Set(rows.map((x) => x.engine))].join(', ')} · AI check: ${[...new Set(rows.map((x) => x.guard ?? 'none'))].join(', ')}\n\n`
      + `Heard as: ${CLIPS.map((c) => `${c} → "${by(c)[0]?.transcript ?? ''}"`).join(' · ')}\n`;
    if (process.env.EVAL_WRITE) { const dir = path.join(__dirname, '..', 'evals', 'results'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${new Date().toISOString().slice(0, 10)}-latency.md`), md); }
    console.log(md);
    expect(rows.every((x) => x.transcript.length > 0)).toBe(true);
  }, 15 * 60_000);
});
