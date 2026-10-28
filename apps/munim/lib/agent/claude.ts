import type Anthropic from '@anthropic-ai/sdk';
import { MODEL, getClient, type LlmClient } from '@core/llm';
import { systemPrompt } from './prompt';
import { DISCLAIMER, NO_PICK, NO_PRODUCT, NO_TRADE, namesFunds, type AdviceMode } from '@/lib/advice';
import { TOOLS, runTool, type ToolCtx } from './tools';
import { checkNumbers, type NumberCheck } from '@core/agent/guard';
import type { Action } from '@/lib/actionsCore';
import { asOfDate } from '@core/finance/picture';
import { holderNames, redact } from '@core/privacy/redact';
import { enforceNoTrade, fundLabels, heldNames, namedFunds, scrubFunds } from './funds';
import { exitSentences, sentences, tellsToExit } from './tradeWords';
import { knownProducts, strangerProducts, type Known } from './brands';
import { NO_PICKS, pickNames } from '@/lib/advicePicks';
import { TOUCHES_INVESTMENTS, judgeSentences, type JudgeInput, type Verdict } from './judge';
export { enforceNoTrade, fundLabels, namedFunds, scrubFunds };

export interface Turn { role: 'user' | 'assistant'; content: string }
export interface TraceStep { tool: string; input: Record<string, unknown>; result: Record<string, unknown>; ms: number }
export interface AgentReply { answer: string; lang: 'hi' | 'en'; trace: TraceStep[]; actions: Action[]; check: NumberCheck; engine: 'claude' | 'offline'; model?: string; ms: number; repaired?: boolean;
  /** Which advice check ran on the answer (D-069): the AI check, the word patterns (its fallback), or none (no investment talk). */
  guard?: 'ai' | 'rules' | 'none'; guardMs?: number }

export async function runClaude(history: Turn[], ctx: ToolCtx, client: LlmClient | null = getClient()): Promise<AgentReply> {
  if (!client) throw new Error('No ANTHROPIC_API_KEY');
  const t0 = Date.now();
  const system = systemPrompt({ asOf: asOfDate(ctx.ds), lang: ctx.lang, dataLabel: ctx.ds.label, sources: ctx.ds.log.filter((l) => l.file !== '(all documents)').map((l) => `${l.file} (${l.kind})`), testMode: ctx.adviceMode === 'demo' || ctx.adviceMode === 'internal', disclaimer: DISCLAIMER[ctx.adviceMode][ctx.lang], adviceMode: ctx.adviceMode });
  // The user's own words can carry PII too ("my PAN is…"): scrub them like document text before they reach the model.
  const names = [...holderNames(ctx.ds.docs.map((d) => d.text)), ...(ctx.names ?? [])];
  const messages: Anthropic.MessageParam[] = history.slice(-12).map((t) => ({ role: t.role, content: t.role === 'user' ? redact(t.content, { names }) : t.content }));
  const trace: TraceStep[] = []; const actions: Action[] = []; const results: unknown[] = [];
  let repaired = false, fundsRepaired = false; let known: Known | undefined; let guard: AgentReply['guard'] = 'none', guardMs = 0;
  const funds = namesFunds(ctx.adviceMode) ? [] : fundLabels(ctx.ds.portfolio?.holdings ?? [], ctx.lang);
  for (let step = 0; step < 7; step++) {
    const res = await client.messages.create({ model: MODEL, max_tokens: 700, system, tools: TOOLS, messages });
    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !uses.length) {
      const answer = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join(' ').trim();
      const check = checkNumbers(answer, results);
      // One repair round: if a spoken figure is not in any tool result, ask the model to fix it before anyone hears it.
      if (!check.ok && !repaired) {
        repaired = true;
        messages.push({ role: 'assistant', content: res.content });
        messages.push({ role: 'user', content: `[system check] These figures are not in any tool result: ${check.unverified.join(', ')}. Call a tool if you need the number, or rewrite the answer without it. Reply with the corrected spoken answer only.` });
        continue;
      }
      // The advice check (D-051, D-066, D-069), then one repair round, then the hard guard, so none of these is ever shown or
      // spoken: outside advice mode, a call to sell, switch, exit, stop or top up a holding; in any mode, a fund or insurer the
      // user doesn't hold (advice mode: that the owner hasn't picked). The AI check decides when it can run; the word patterns
      // decide when it can't (no key, AI off, a timeout).
      if (!known) known = knownProducts(ctx.ds.portfolio?.holdings ?? [], ctx.ds.policies ?? [], namesFunds(ctx.adviceMode) && ctx.picks ? pickNames(await ctx.picks().catch(() => NO_PICKS)) : [], history.filter((t) => t.role === 'user').map((t) => t.content));
      const said = history.filter((t) => t.role === 'user').map((t) => redact(t.content, { names }));
      const g = await checkAdvice(answer, ctx, funds, known, said);
      guard = g.by; guardMs += g.ms;
      if (g.flagged.length && !fundsRepaired) {
        fundsRepaired = true;
        messages.push({ role: 'assistant', content: res.content });
        const why = g.flagged.map((f) => `"${f.s}" (${f.why === 'trade' ? `tells the user to act on something they hold: Munim has no investment adviser licence, so give the facts and trade-offs only${f.name ? `, or call it "${funds[0]?.label ?? 'your small cap fund'}"` : ''}` : namesFunds(ctx.adviceMode) ? 'names a product that is not in advice_picks: name only products from advice_picks, or give the category and say no pick is set up yet' : 'names a product the user does not hold as a choice: name the category instead'})`).join('; ');
        messages.push({ role: 'user', content: `[system check] These sentences break Munim's advice rules: ${why}. Rewrite them. Reply with the corrected spoken answer only.` });
        continue;
      }
      const final = g.flagged.length ? removeFlagged(answer, g.flagged, ctx.adviceMode, ctx.lang, funds) : answer;
      return { answer: final, lang: ctx.lang, trace, actions, check: final === answer ? check : checkNumbers(final, results), engine: 'claude', model: MODEL, ms: Date.now() - t0, repaired: repaired || fundsRepaired, guard, guardMs };
    }
    messages.push({ role: 'assistant', content: res.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const s = Date.now();
      let out: Awaited<ReturnType<typeof runTool>>;
      try { out = await runTool(u.name, (u.input ?? {}) as Record<string, unknown>, ctx); }
      catch (e) { out = { result: { error: (e as Error).message } }; }
      trace.push({ tool: u.name, input: (u.input ?? {}) as Record<string, unknown>, result: out.result, ms: Date.now() - s });
      const shown = ctx.sanitize ? ctx.sanitize(out.result) : out.result; // what the AI sees is what the number check trusts
      results.push(shown); if (out.action && !(out.action as { duplicate?: boolean }).duplicate) actions.push(out.action);
      toolResults.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(shown), is_error: 'error' in shown });
    }
    messages.push({ role: 'user', content: toolResults });
  }
  const answer = ctx.lang === 'hi' ? 'माफ़ कीजिए, मैं इसका जवाब पूरा नहीं कर पाया। क्या आप सवाल थोड़ा छोटा करके पूछेंगे?' : "Sorry, I couldn't finish that one. Could you ask it a bit more simply?";
  return { answer, lang: ctx.lang, trace, actions, check: checkNumbers(answer, results), engine: 'claude', model: MODEL, ms: Date.now() - t0, guard, guardMs };
}

/** What the guard objects to in an answer (D-051, D-066). */
export function violations(answer: string, mode: AdviceMode, funds: ReturnType<typeof fundLabels>, known: Known) {
  const guarded = !namesFunds(mode);
  return { named: guarded ? namedFunds(answer, funds) : [], exits: guarded && tellsToExit(answer, heldNames(funds)), strangers: strangerProducts(answer, known) };
}
/** The hard guard, after the repair round: also used on the phone when the relay answered in a stricter mode than the
 *  phone asked for (D-066 review, #5). Outside advice mode, trade sentences lose their fund names and exit instructions are
 *  removed; in every mode, a sentence naming a product the user doesn't hold (and, in advice mode, that isn't a pick) goes. */
export function guardAnswer(answer: string, mode: AdviceMode, funds: ReturnType<typeof fundLabels>, known: Known, lang: 'hi' | 'en') {
  const v = violations(answer, mode, funds, known);
  let a = answer;
  if (v.strangers.length) {
    for (const st of sentences(a).filter((x) => strangerProducts(x, known).length)) a = a.replace(st, '');
    a = a.replace(/[ \t]{2,}/g, ' ').trim();
    const line = namesFunds(mode) ? NO_PICK[lang] : NO_PRODUCT[lang];
    a = a ? `${a} ${line}` : line;
  }
  if (!namesFunds(mode) && (v.named.length || v.exits)) a = enforceNoTrade(a, funds, lang);
  return a;
}

type Flag = { s: string; why: 'trade' | 'product'; name?: boolean };
/** Which sentences break the advice rules, and who decided: the AI check when it runs, else the word patterns. */
export async function checkAdvice(answer: string, ctx: Pick<ToolCtx, 'adviceMode' | 'lang' | 'judge'>, funds: ReturnType<typeof fundLabels>, known: Known, said: string[]): Promise<{ flagged: Flag[]; by: 'ai' | 'rules' | 'none'; ms: number }> {
  if (!TOUCHES_INVESTMENTS.test(answer)) return { flagged: [], by: 'none', ms: 0 };
  const list = judgeSentences(answer);
  const input: JudgeInput = { sentences: list, held: [...new Set([...known.names, ...funds.flatMap((f) => f.names)])].slice(0, 40), picks: [], said: said.slice(-5), lang: ctx.lang, advice: namesFunds(ctx.adviceMode) };
  const t0 = Date.now();
  const v: Verdict | null = ctx.judge ? await ctx.judge(input).catch(() => null) : null;
  if (v) return { flagged: v.remove.map((r) => ({ s: list[r.i], why: r.why })), by: 'ai', ms: Date.now() - t0 };
  // fallback: the word patterns, sentence by sentence
  const flagged: Flag[] = [];
  const held = heldNames(funds), guarded = !namesFunds(ctx.adviceMode);
  for (const s of exitSentences(answer, held)) if (guarded) flagged.push({ s, why: 'trade', name: namedFunds(s, funds).length > 0 });
  for (const s of list) if (strangerProducts(s, known).length && !flagged.some((f) => f.s === s)) flagged.push({ s, why: 'product' });
  return { flagged, by: 'rules', ms: Date.now() - t0 };
}
/** Remove the flagged sentences and say once why something is missing (no-licence line, or no pick set up). */
export function removeFlagged(answer: string, flagged: Flag[], mode: AdviceMode, lang: 'hi' | 'en', funds: ReturnType<typeof fundLabels>) {
  let a = answer;
  for (const f of flagged) a = a.replace(f.s, '');
  a = scrubFunds(a.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim(), namesFunds(mode) ? [] : funds);
  const lines = [...new Set(flagged.map((f) => (f.why === 'trade' ? NO_TRADE[lang] : namesFunds(mode) ? NO_PICK[lang] : NO_PRODUCT[lang])))];
  return [a, ...lines].filter(Boolean).join(' ');
}
