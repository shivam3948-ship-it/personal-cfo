// What one Ask turn cost to run (D-089): the model's tokens, the AI advice check, speech to text and the spoken answer.
// Pure, so the phone and the owner's log page compute it the same way. An estimate of our running cost, not anyone's
// money: list prices, no GST, no volume discounts. Integers throughout (rule 6): model prices in nano-dollars per token,
// everything else in micro-rupees (µ₹, a millionth of a rupee), because one turn costs fractions of a paisa per part.
//
// Prices checked on 7 Nov 2026 (update this block, with the date, when a price changes):
//   · Claude: platform.claude.com/docs/en/about-claude/pricing — USD per million tokens (base input, 5-minute cache
//     write, cache read, output). $2/MTok = 2,000 nano-dollars per token.
//   · Sarvam: docs.sarvam.ai/api/getting-started/pricing — speech to text ₹0.49 a minute, billed per second; Bulbul v3
//     ₹3 per 1,000 characters (pay-as-you-go, before GST).
//   · Dollar to rupee: about ₹94.7 (closing rates reported in early Nov 2026). An assumption: change it here.

export const PRICES_AS_OF = '2026-11-07';
/** Rupees per dollar × 1,000. */
export const USD_INR_MILLI = 94_700;

type ModelPrice = { input: number; cacheWrite: number; cacheRead: number; output: number }; // nano-dollars per token
// longest prefix first, so 'claude-sonnet-5-5' never falls into 'claude-sonnet-5'
const MODELS: [string, ModelPrice][] = [
  ['claude-sonnet-5-5', { input: 2_000, cacheWrite: 2_500, cacheRead: 100, output: 10_000 }],
  ['claude-sonnet-5', { input: 2_000, cacheWrite: 2_500, cacheRead: 200, output: 10_000 }],
  ['claude-haiku-5-5', { input: 100, cacheWrite: 125, cacheRead: 10, output: 500 }], // prompts up to 100k tokens; ours are far smaller
  ['claude-haiku-4-5', { input: 1_000, cacheWrite: 1_250, cacheRead: 100, output: 5_000 }],
  ['claude-opus-5-5', { input: 4_000, cacheWrite: 5_000, cacheRead: 200, output: 20_000 }],
];
export const STT_UINR_PER_MIN = 490_000; // ₹0.49
export const TTS_UINR_PER_CHAR: Record<string, number> = { 'bulbul:v3': 3_000 }; // ₹3 per 1,000 characters
export const DEFAULT_TTS_MODEL = 'bulbul:v3';

export function priceOf(model?: string | null): ModelPrice | null {
  if (!model) return null;
  const hit = MODELS.find(([p]) => model === p || model.startsWith(`${p}-`) || model.startsWith(`${p}@`));
  return hit ? hit[1] : null;
}

export interface Tokens { input: number; cacheRead: number; cacheWrite: number; output: number }
const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.round(x) : 0);

/** Nano-dollars for these tokens on this model, or null when the model isn't in the table. */
export function tokensNanoUsd(model: string | undefined | null, t: Partial<Tokens> | undefined): number | null {
  const p = priceOf(model); if (!p) return null;
  return n(t?.input) * p.input + n(t?.cacheWrite) * p.cacheWrite + n(t?.cacheRead) * p.cacheRead + n(t?.output) * p.output;
}
export const nanoUsdToUinr = (nano: number) => Math.round((nano * USD_INR_MILLI) / 1_000_000);
/** Billed per second, so a part second counts as a whole one. */
export const sttUinr = (ms: number) => Math.round((Math.ceil(n(ms) / 1000) * STT_UINR_PER_MIN) / 60);
export const ttsUinr = (chars: number, model = DEFAULT_TTS_MODEL) => n(chars) * (TTS_UINR_PER_CHAR[model] ?? TTS_UINR_PER_CHAR[DEFAULT_TTS_MODEL]);

export interface TurnCostInput {
  model?: string | null; llm?: Partial<Tokens>;          // the answer's model calls (all rounds: tools, repairs)
  judgeModel?: string | null; judge?: Partial<Tokens>;   // the AI advice check, when it ran
  sttMs?: number;                                        // audio sent to Sarvam (0 or absent: typed, or the browser heard it)
  ttsChars?: number; ttsModel?: string;                  // characters sent to Sarvam's voice (the browser's own voice is free)
}
export interface TurnCost { llm: number; judge: number; stt: number; tts: number; total: number; unpriced: string[] } // µ₹

export function turnCost(c: TurnCostInput): TurnCost {
  const unpriced: string[] = [];
  const llmNano = c.llm && (n(c.llm.input) + n(c.llm.output) + n(c.llm.cacheRead) + n(c.llm.cacheWrite)) ? tokensNanoUsd(c.model, c.llm) : 0;
  if (llmNano === null) unpriced.push(c.model ?? 'model');
  const judgeNano = c.judge && (n(c.judge.input) + n(c.judge.output)) ? tokensNanoUsd(c.judgeModel, c.judge) : 0;
  if (judgeNano === null) unpriced.push(c.judgeModel ?? 'judge');
  const llm = nanoUsdToUinr(llmNano ?? 0), judge = nanoUsdToUinr(judgeNano ?? 0), stt = sttUinr(c.sttMs ?? 0), tts = ttsUinr(c.ttsChars ?? 0, c.ttsModel);
  return { llm, judge, stt, tts, total: llm + judge + stt + tts, unpriced };
}

/** ₹ for display: four decimals under a rupee (a turn is usually paise), two above. */
export function rupees(uinr: number): string {
  const r = uinr / 1_000_000;
  return `₹${r < 1 ? r.toFixed(4) : r.toFixed(2)}`;
}
