// What Munim may record about how it's used (traces, feedback, funnel), and the guard that keeps personal data out.
// Pure: the phone and the server both run it. Rule (D-057): for your own data, only metadata leaves the phone
// (which tools ran, how long, whether the numbers checked out, thumbs up or down). Never the question, the answer,
// amounts, names, merchants or identifiers. Full text is kept only for the sample family, and redacted even then.
import { EVENTS, PROPS } from './eventNames';

export const TRACE_EVENTS = {
  answer: 'answer',     // answerProps(): { id, engine, model, prompt, tools, steps, ms, grounded, checked, unverified, lang, data, where, fallback, repaired }
  voice_turn: 'voice_turn', // { id, stt, stt_ms?, agent_ms, speak_ms, total_ms, voice: sarvam|browser|none, pieces, lang, data, cost_uinr?, cut_in?, cut_need?, cut_peak? } (D-058, D-089, D-090)
  feedback: 'feedback', // { id, vote: up|down, reason?: wrong_number|not_answered|hard_to_follow, data }
} as const;
export type TelemetryName = keyof typeof EVENTS | keyof typeof TRACE_EVENTS;
export type Props = Record<string, string | number | boolean>;
export interface TelemetryEvent { name: TelemetryName; props: Props; at: number }

const NAMES = new Set<string>([...Object.keys(EVENTS), ...Object.keys(TRACE_EVENTS)]);
export const isTelemetryName = (n: unknown): n is TelemetryName => typeof n === 'string' && NAMES.has(n);

/** Values allowed out: numbers, booleans, and short plain tokens (ids, enums, tool and model names). Anything that could
 *  carry a person's data is dropped: long text, 5+ digits in a row (accounts, phones), @ (emails, UPI ids), ₹ amounts,
 *  and any non-ASCII text (a Hindi question). */
export function safeValue(v: unknown): string | number | boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : undefined;
  if (typeof v !== 'string') return undefined;
  if (v.length > 80 || /\d{5,}|@|₹|rs\.?\s*\d/i.test(v) || !/^[\x20-\x7E]*$/.test(v)) return undefined;
  return v;
}

export function safeProps(p: unknown): Props {
  const out: Props = {};
  if (!p || typeof p !== 'object') return out;
  for (const [k, v] of Object.entries(p as Record<string, unknown>).slice(0, 20)) {
    if (!/^[a-z][a-zA-Z0-9_]{0,30}$/.test(k)) continue;
    const s = safeValue(v); if (s !== undefined) out[k] = s;
  }
  return out;
}

const TOKEN = /^[a-z0-9][a-z0-9_,.:+-]{0,79}$/;
/** safeProps, then only the props this event is allowed (lib/eventNames.ts PROPS), each of the allowed kind. */
export function propsFor(name: TelemetryName, p: unknown): Props {
  const spec = PROPS[name], out: Props = {};
  for (const [k, v] of Object.entries(safeProps(p))) {
    const kind = spec?.[k];
    if (!kind) continue;
    if (kind === 'num' ? typeof v === 'number' : kind === 'bool' ? typeof v === 'boolean' : kind === 'token' ? typeof v === 'string' && TOKEN.test(v) : typeof v === 'string' && kind.includes(v)) out[k] = v;
  }
  return out;
}

/** A batch from a phone, cleaned: known names only, safe props only, at most 50, timestamps within a day. */
/** A random id for one answer, so a thumbs up or down can point at it. Letters only, so the digit-run guard keeps it. */
export function traceId(): string {
  const hex = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)).replace(/-/g, '');
  return hex.slice(0, 16).replace(/[0-9]/g, (d) => 'ghijklmnop'[+d]);
}

/** Install ids are random v4 UUIDs, made on the phone. Nothing else is accepted (not a phone number, not a name). */
export const isInstallId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);

/** The metadata of one answer, the same shape from the phone and the server. Never the question or the answer. */
export function answerProps(a: { id: string; engine: string; model?: string; prompt: string; tools: string[]; ms: number; check: { ok: boolean; checked: number; unverified: string[] }; lang: string; data: 'sample' | 'mine'; where: string; fallback?: boolean; repaired?: boolean; guard?: string; guardMs?: number }): Props {
  return safeProps({ id: a.id, engine: a.engine, model: (a.model ?? 'none').replace(/-\d{8}$/, ''), prompt: a.prompt, tools: [...new Set(a.tools)].join(',').slice(0, 80), steps: a.tools.length,
    ms: a.ms, grounded: a.check.ok, checked: a.check.checked, unverified: a.check.unverified.length, lang: a.lang, data: a.data, where: a.where, fallback: !!a.fallback, repaired: !!a.repaired, guard: a.guard ?? 'none', guard_ms: a.guardMs ?? 0 });
}

export function cleanBatch(body: unknown, now = Date.now()): { install: string; events: TelemetryEvent[] } | null {
  const b = (body ?? {}) as { install?: unknown; events?: unknown };
  if (!isInstallId(b?.install) || !Array.isArray(b.events)) return null;
  const events = b.events.slice(0, 50).flatMap((e: { name?: unknown; props?: unknown; at?: unknown }) => {
    if (!isTelemetryName(e?.name)) return [];
    const at = typeof e.at === 'number' && Math.abs(now - e.at) < 864e5 ? e.at : now;
    return [{ name: e.name, props: propsFor(e.name, e.props), at }];
  });
  return { install: b.install, events };
}
