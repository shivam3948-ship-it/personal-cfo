// One Ask turn as the owner's log keeps it (D-089): what was asked, what Munim said, how long each stage took, what it
// cost, and how the cut-in listener behaved. Pure: the phone builds it, the server cleans it, the /owner page reads it.
// Only owner browsers send these (lib/ownerUnlock.ts); everyone else's turns stay metadata-only (D-057).
// "Self-improving" (D-089): flagsOf() marks the bad turns, draftCase() turns each into a draft eval case for the owner to
// rewrite on the sample family. Nothing changes the prompt by itself: every fix still goes through the evals (rule 8).
import type { CutInDiag } from '@/ui/cutIn';
import type { TurnCost } from './cost';

export type CutIn = CutInDiag & { ctx?: string; how: 'voice' | 'tap' | 'none' };
export interface TurnRecord {
  id: string; at: string; data: 'mine' | 'sample'; via: 'voice' | 'typed'; lang: 'hi' | 'en';
  question: string; answer: string;
  engine: string; model?: string; prompt?: string; tools: string[];
  check: { ok: boolean; checked: number; unverified: number };
  repaired?: boolean; fallback?: boolean; guard?: string; adviceFired?: boolean;
  /** ms: speech to text, the answer (model + tools + checks), Munim's first word after the answer, and the three together */
  ms: { stt?: number; agent: number; firstWord?: number; total?: number; audio?: number };
  stt?: 'server' | 'browser'; voice?: 'sarvam' | 'browser' | 'none';
  tokens?: { calls: number; input: number; cacheRead: number; cacheWrite: number; output: number };
  judge?: { model: string; input: number; output: number };
  ttsChars?: number; cost?: TurnCost; cutIn?: CutIn;
  vote?: 'up' | 'down'; reason?: string;
}

export const SLOW_VOICE_MS = 10_000; // from the end of your question to Munim's first word
export const SLOW_TYPED_MS = 8_000;

export type Flag = 'thumbs_down' | 'unverified_numbers' | 'number_repair' | 'advice_check' | 'fell_back' | 'slow' | 'tapped_to_cut_in' | 'cut_in_missed';
/** Why a turn deserves a look. 'cut_in_missed': you tapped to interrupt while the listener's loudest moment was close to its
 *  bar (two thirds or more), i.e. it nearly heard you: the bar, not the microphone, is the likely problem. */
export function flagsOf(t: TurnRecord): Flag[] {
  const f: Flag[] = [];
  if (t.vote === 'down') f.push('thumbs_down');
  if (!t.check.ok) f.push('unverified_numbers');
  if (t.repaired) f.push('number_repair');
  if (t.adviceFired) f.push('advice_check');
  if (t.fallback) f.push('fell_back');
  const slow = t.via === 'voice' ? (t.ms.total ?? 0) > SLOW_VOICE_MS : t.ms.agent > SLOW_TYPED_MS;
  if (slow) f.push('slow');
  if (t.cutIn?.how === 'tap') { f.push('tapped_to_cut_in'); if (t.cutIn.need > 0 && t.cutIn.peak >= t.cutIn.need * 0.66) f.push('cut_in_missed'); }
  return f;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\s+/g, ' ').trim();
/** A draft for evals/cases.ts. On your own data the question can't run as it is (the evals use the sample family), so it
 *  is a starting point: rewrite the question for the sample family and add the must/mustNot lines that would have caught it. */
export function draftCase(t: TurnRecord, n: number): string {
  const cat = t.lang === 'hi' ? 'routing_hi' : 'routing_en';
  const tools = t.tools.length ? `[${[...new Set(t.tools)].map((x) => `'${esc(x)}'`).join(', ')}]` : 'undefined';
  const why = [...flagsOf(t), ...(t.reason ? [t.reason] : [])].join(', ');
  // your own data never goes into the repo (rule 4): the draft keeps only what went wrong and which tools ran
  const mine = t.data === 'mine';
  const said = mine ? '' : ` Munim said: "${esc(t.answer).slice(0, 140)}"`;
  const q = mine ? 'TODO: the question, reworded for the sample family' : esc(t.question).slice(0, 300);
  return `  // real turn ${t.at.slice(0, 10)} (${t.data} data, ${t.via}): ${why}.${said}\n` +
    `  c('real-${t.at.slice(0, 10)}-${n}', '${cat}', '${q}', ${tools}, { /* TODO: sample-family wording; must / mustNot */ }),`;
}

const pct = (xs: number[], p: number) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p + 0.5))]; };
export interface LogSummary {
  turns: number; voice: number; typed: number; flagged: number; down: number; up: number;
  totalMs: { p50: number | null; p90: number | null }; sttMs: { p50: number | null }; agentMs: { p50: number | null; p90: number | null }; firstWordMs: { p50: number | null };
  cost: { total: number; perTurn: number | null; llm: number; judge: number; stt: number; tts: number }; // µ₹
  cutIn: { heard: number; tapped: number; missed: number };
}
export function summarize(turns: TurnRecord[]): LogSummary {
  const voice = turns.filter((t) => t.via === 'voice'), nums = (xs: (number | undefined)[]) => xs.filter((x): x is number => typeof x === 'number');
  const sum = (k: keyof TurnCost) => turns.reduce((a, t) => a + ((t.cost?.[k] as number | undefined) ?? 0), 0);
  const costTotal = sum('total'), priced = turns.filter((t) => t.cost).length;
  return {
    turns: turns.length, voice: voice.length, typed: turns.length - voice.length, flagged: turns.filter((t) => flagsOf(t).length).length,
    down: turns.filter((t) => t.vote === 'down').length, up: turns.filter((t) => t.vote === 'up').length,
    totalMs: { p50: pct(nums(voice.map((t) => t.ms.total)), 0.5), p90: pct(nums(voice.map((t) => t.ms.total)), 0.9) },
    sttMs: { p50: pct(nums(voice.map((t) => t.ms.stt)), 0.5) },
    agentMs: { p50: pct(nums(turns.map((t) => t.ms.agent)), 0.5), p90: pct(nums(turns.map((t) => t.ms.agent)), 0.9) },
    firstWordMs: { p50: pct(nums(voice.map((t) => t.ms.firstWord)), 0.5) },
    cost: { total: costTotal, perTurn: priced ? Math.round(costTotal / priced) : null, llm: sum('llm'), judge: sum('judge'), stt: sum('stt'), tts: sum('tts') },
    cutIn: { heard: turns.filter((t) => t.cutIn?.how === 'voice').length, tapped: turns.filter((t) => t.cutIn?.how === 'tap').length, missed: turns.filter((t) => flagsOf(t).includes('cut_in_missed')).length },
  };
}

// ---- server-side cleaning: the shape is checked and every string capped; the text is redacted by the route ----
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 1000) / 1000 : undefined);
const oneOf = <T extends string>(v: unknown, xs: readonly T[]): T | undefined => (xs.includes(v as T) ? (v as T) : undefined);
const TOKEN = /^[A-Za-z0-9_.:@-]{1,80}$/;
export const isTurnId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(v);

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const tok = (v: unknown): v is string => typeof v === 'string' && TOKEN.test(v);

export function cleanTurn(b: unknown): TurnRecord | null {
  const x = obj(b), ms = obj(x.ms), check = obj(x.check);
  if (!isTurnId(x.id)) return null;
  const via = oneOf(x.via, ['voice', 'typed'] as const), data = oneOf(x.data, ['mine', 'sample'] as const), lang = oneOf(x.lang, ['hi', 'en'] as const);
  if (!via || !data || !lang || !x.ms || typeof x.ms !== 'object') return null;
  const at = typeof x.at === 'string' && !Number.isNaN(Date.parse(x.at)) ? new Date(x.at).toISOString() : new Date().toISOString();
  const t: TurnRecord = {
    id: x.id, at, data, via, lang, question: str(x.question, 2000), answer: str(x.answer, 6000),
    engine: tok(x.engine) ? x.engine : 'unknown', ...(tok(x.model) ? { model: x.model } : {}), ...(tok(x.prompt) ? { prompt: x.prompt } : {}),
    tools: Array.isArray(x.tools) ? x.tools.filter(tok).slice(0, 20) : [],
    check: { ok: check.ok === true, checked: num(check.checked) ?? 0, unverified: num(check.unverified) ?? 0 },
    ms: { agent: num(ms.agent) ?? 0 },
  };
  for (const k of ['stt', 'firstWord', 'total', 'audio'] as const) { const v = num(ms[k]); if (v !== undefined) t.ms[k] = v; }
  for (const k of ['repaired', 'fallback', 'adviceFired'] as const) if (x[k] === true) t[k] = true;
  if (tok(x.guard)) t.guard = x.guard;
  const stt = oneOf(x.stt, ['server', 'browser'] as const); if (stt) t.stt = stt;
  const voice = oneOf(x.voice, ['sarvam', 'browser', 'none'] as const); if (voice) t.voice = voice;
  if (x.tokens && typeof x.tokens === 'object') { const k = obj(x.tokens); t.tokens = { calls: num(k.calls) ?? 0, input: num(k.input) ?? 0, cacheRead: num(k.cacheRead) ?? 0, cacheWrite: num(k.cacheWrite) ?? 0, output: num(k.output) ?? 0 }; }
  const j = obj(x.judge); if (tok(j.model)) t.judge = { model: j.model, input: num(j.input) ?? 0, output: num(j.output) ?? 0 };
  const chars = num(x.ttsChars); if (chars !== undefined) t.ttsChars = chars;
  if (x.cost && typeof x.cost === 'object') { const c = obj(x.cost); t.cost = { llm: num(c.llm) ?? 0, judge: num(c.judge) ?? 0, stt: num(c.stt) ?? 0, tts: num(c.tts) ?? 0, total: num(c.total) ?? 0,
    unpriced: Array.isArray(c.unpriced) ? c.unpriced.filter(tok).slice(0, 4) : [] }; }
  const c = obj(x.cutIn), how = oneOf(c.how, ['voice', 'tap', 'none'] as const);
  if (how) { const atMs = num(c.atMs); t.cutIn = { how, frames: num(c.frames) ?? 0, ms: num(c.ms) ?? 0, floor: num(c.floor) ?? 0, need: num(c.need) ?? 0, peak: num(c.peak) ?? 0, p90: num(c.p90) ?? 0,
    triggered: c.triggered === true, ...(atMs !== undefined ? { atMs } : {}), ...(tok(c.ctx) ? { ctx: c.ctx } : {}) }; }
  const vote = oneOf(x.vote, ['up', 'down'] as const); if (vote) t.vote = vote;
  const reason = oneOf(x.reason, ['wrong_number', 'not_answered', 'hard_to_follow'] as const); if (reason) t.reason = reason;
  return t;
}
