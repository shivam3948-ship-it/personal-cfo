'use client';
// Ask Munim on your own data (D-050, option A). Everything that reads your statements runs here, on the phone:
//   · the tools (spending, leaks, loans, safety net…) compute on your statements and CAS in this browser
//   · with an API key on the server: the same Claude loop as the sample family, but each model call goes through
//     /api/ask/relay, which only ever sees your question and the tool results after forLlm() (no files, rows, payee names
//     or identifiers). The server adds the system prompt and the advice mode itself.
//   · without a key (503): the rules engine answers right here, and nothing leaves the phone at all.
// Actions (reminders, drafts, goals) are kept in this browser.
import type Anthropic from '@anthropic-ai/sdk';
import type { LlmClient } from '@core/llm';
import { detectLang } from '@core/agent/lang';
import { asOfDate } from '@core/finance/picture';
import { forLlm } from '@core/privacy/forLlm';
import { counterpartyNames } from '@core/privacy/counterparties';
import { redact } from '@core/privacy/redact';
import { emptyDataset, type Dataset } from '@core/types';
import { fundLabels, guardAnswer, runClaude, type AgentReply, type Turn } from '@/lib/agent/claude';
import { knownProducts } from '@/lib/agent/brands';
import type { JudgeInput, Verdict } from '@/lib/agent/judge';
import type { Picks } from '@/lib/advicePicks';
import { runOffline } from '@/lib/agent/offline';
import type { ToolCtx } from '@/lib/agent/tools';
import { actionKey, toIcs, type Action } from '@/lib/actionsCore';
import type { AdviceMode } from '@/lib/advice';
import { myDataset } from './statements';
import { loadCas } from './cas';
import { getProfile } from './profile';
import { idbGet, idbPut } from './idb';
import { PROMPT_VERSION } from '@/lib/agent/prompt';
import { traceId } from '@/lib/telemetryCore';

/** Your statements and CAS as one dataset, or null when nothing has been added on this phone. */
export async function myData(): Promise<Dataset | null> {
  const [ds, cas] = await Promise.all([myDataset(), loadCas()]);
  if (!ds && !cas) return null;
  const d = ds ?? emptyDataset('Your statements');
  if (cas) d.portfolio = { asOf: cas.asOf, holdings: cas.holdings, checks: [], source: 'Your CAS' };
  return d;
}

// ---- actions, kept in this browser ----
const KEY = 'actions';
let actions: Action[] | null = null;
async function loadActions() { if (!actions) actions = (await idbGet<Action[]>(KEY)) ?? []; return actions; }
function addLocal(_sid: string, a: Omit<Action, 'id' | 'createdAt'>): Action & { duplicate?: boolean } {
  const list = actions ?? (actions = []);
  const k = actionKey(a); const same = list.find((x) => actionKey(x) === k);
  if (same) return { ...same, duplicate: true };
  const act: Action = { ...a, id: Math.random().toString(36).slice(2, 10), createdAt: new Date().toISOString() };
  list.unshift(act); void idbPut(KEY, list); return act;
}
const icsUrl = (a: Action) => { try { return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(toIcs(a)); } catch { return ''; } };

/** A stand-in LLM client: forwards only the messages (question + filtered tool results) to the relay. */
function relayClient(lang: 'hi' | 'en', asOf: string, seen: { mode?: AdviceMode }): LlmClient {
  return { messages: { create: async (body) => {
    const r = await fetch('/api/ask/relay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: body.messages, lang, asOf }) });
    if (r.status === 503) { noKey = true; throw new NoKey(); }
    const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'relay failed');
    if (j.mode === 'guided' || seen.mode === 'guided') seen.mode = 'guided'; else if (j.mode) seen.mode = j.mode; // the strictest mode the server used
    return { content: j.content, stop_reason: j.stop_reason, model: j.model } as Anthropic.Message;
  } } };
}
class NoKey extends Error { constructor() { super('no_key'); } }
let noKey = false; // after one 503, this visit stays on the phone's engine (no pointless calls)

export interface LocalReply { spoken: string; answer: string; lang: 'hi' | 'en'; engine: AgentReply['engine']; check: AgentReply['check']; tools: string[]; actions: Action[]; where: 'phone' | 'phone+relay';
  trace: string; model?: string; prompt: string; ms: number; repaired: boolean; fallback: boolean;
  /** The advice mode this answer was given in (the server's, when the relay answered): the footer follows it (review 2, N9). */
  mode: AdviceMode; guard?: AgentReply['guard']; guardMs?: number }

/** On your own data the advice mode is 'guided' (no fund picks, the SEBI line), whatever the public test switch says:
 *  'demo' never reads real data, and 'internal' needs a server-side allow-list we don't have yet (compliance review, D-050). */
export async function askLocal(history: Turn[]): Promise<LocalReply> {
  const ds = await myData(); if (!ds) throw new Error('Add a statement first.');
  await loadActions();
  const p = getProfile();
  const last = history.filter((t) => t.role === 'user').at(-1)?.content ?? '';
  const lang = detectLang(last, 'auto');
  // guided on your own data, unless the owner switched advice on for this browser (D-066; the server checks the key)
  const adviceMode: AdviceMode = (await fetch('/api/advice', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}))).advice === true ? 'private' : 'guided';
  const names = [...(p?.name ? [p.name] : []), ...counterpartyNames(ds.txns)]; // your name and every payee/sender your statements name
  const picks = adviceMode === 'private' ? async () => { const r = await fetch('/api/advice/picks', { cache: 'no-store' }); if (!r.ok) throw new Error('no picks'); return r.json() as Promise<Picks>; } : undefined;
  // the AI check (D-069) runs on the server: the phone sends only the answer's sentences and names, already redacted
  const judge = async (input: JudgeInput): Promise<Verdict | null> => {
    if (noKey) return null;
    const r = await fetch('/api/ask/judge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sentences: input.sentences, held: input.held, said: input.said, lang: input.lang }) }).catch(() => null);
    return r && r.ok ? (r.json() as Promise<Verdict>) : null; // any failure: the word patterns decide
  };
  const ctx: ToolCtx = { ds, sid: 'phone', lang, adviceMode, addAction: addLocal, icsUrl, sanitize: (r) => forLlm(r, names), names, judge, ...(picks ? { picks } : {}) };
  let r: AgentReply; let where: LocalReply['where'] = 'phone+relay'; let fallback = false;
  const t0 = Date.now();
  if (/(?:^|;\s*)munim_ai=off(?:;|$)/.test(document.cookie)) noKey = true; // ?ai=off (D-062): don't even ask the relay
  const seen: { mode?: AdviceMode } = {};
  try {
    if (noKey) throw new NoKey(); r = await runClaude(history, ctx, relayClient(lang, asOfDate(ds), seen));
    // the server decides the mode (D-066 review, #5): if the relay answered in guided mode (the advice cookie expired, or advice
    // was switched off) while this phone thought advice was on, apply the guided guard to what the model said
    if (seen.mode === 'guided' && adviceMode !== 'guided') r = { ...r, answer: guardAnswer(r.answer, 'guided', fundLabels(ds.portfolio?.holdings ?? [], lang), knownProducts(ds.portfolio?.holdings ?? [], ds.policies ?? [], [], history.filter((t) => t.role === 'user').map((t) => t.content)), lang) };
  }
  catch (e) { fallback = !(e instanceof NoKey); r = await runOffline(history, ctx); where = 'phone'; } // no key, offline or a failed call: the rules engine, on the phone
  const spoken = redact(r.answer, { names }).replace(/\b(UPI|NEFT|IMPS)[-/][^\s,.।]+/gi, 'a payment'); // what may go to the voice service
  return { spoken, answer: r.answer, lang: r.lang, engine: r.engine, check: r.check, tools: r.trace.map((t) => t.tool), actions: r.actions, where,
    trace: traceId(), model: r.model, prompt: PROMPT_VERSION, ms: Date.now() - t0, repaired: !!r.repaired, fallback, mode: seen.mode === 'guided' ? 'guided' : adviceMode, guard: r.guard, guardMs: r.guardMs };
}
