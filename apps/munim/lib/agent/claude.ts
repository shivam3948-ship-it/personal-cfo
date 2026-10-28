import type Anthropic from '@anthropic-ai/sdk';
import { MODEL, getClient, type LlmClient } from '@core/llm';
import { systemPrompt } from './prompt';
import { DISCLAIMER, NO_PICK, NO_PRODUCT, namesFunds, type AdviceMode } from '@/lib/advice';
import { TOOLS, runTool, type ToolCtx } from './tools';
import { checkNumbers, type NumberCheck } from '@core/agent/guard';
import type { Action } from '@/lib/actionsCore';
import { asOfDate } from '@core/finance/picture';
import { holderNames, redact } from '@core/privacy/redact';
import { enforceNoTrade, fundLabels, heldNames, namedFunds, scrubFunds } from './funds';
import { sentences, tellsToExit } from './tradeWords';
import { knownProducts, strangerProducts, type Known } from './brands';
import { NO_PICKS, pickNames } from '@/lib/advicePicks';
export { enforceNoTrade, fundLabels, namedFunds, scrubFunds };

export interface Turn { role: 'user' | 'assistant'; content: string }
export interface TraceStep { tool: string; input: Record<string, unknown>; result: Record<string, unknown>; ms: number }
export interface AgentReply { answer: string; lang: 'hi' | 'en'; trace: TraceStep[]; actions: Action[]; check: NumberCheck; engine: 'claude' | 'offline'; model?: string; ms: number; repaired?: boolean }

export async function runClaude(history: Turn[], ctx: ToolCtx, client: LlmClient | null = getClient()): Promise<AgentReply> {
  if (!client) throw new Error('No ANTHROPIC_API_KEY');
  const t0 = Date.now();
  const system = systemPrompt({ asOf: asOfDate(ctx.ds), lang: ctx.lang, dataLabel: ctx.ds.label, sources: ctx.ds.log.filter((l) => l.file !== '(all documents)').map((l) => `${l.file} (${l.kind})`), testMode: ctx.adviceMode === 'demo' || ctx.adviceMode === 'internal', disclaimer: DISCLAIMER[ctx.adviceMode][ctx.lang], adviceMode: ctx.adviceMode });
  // The user's own words can carry PII too ("my PAN is…"): scrub them like document text before they reach the model.
  const names = [...holderNames(ctx.ds.docs.map((d) => d.text)), ...(ctx.names ?? [])];
  const messages: Anthropic.MessageParam[] = history.slice(-12).map((t) => ({ role: t.role, content: t.role === 'user' ? redact(t.content, { names }) : t.content }));
  const trace: TraceStep[] = []; const actions: Action[] = []; const results: unknown[] = [];
  let repaired = false, fundsRepaired = false; let known: Known | undefined;
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
      // One more repair round (D-051, D-066 review B3 and #4), then the hard guard, so none of these is ever shown or spoken:
      //   · outside advice mode, a held fund named in a trade sentence, or any sell/switch/exit/stop instruction;
      //   · in any mode, a fund or insurance product the user doesn't hold and (advice mode) the owner hasn't picked.
      if (!known) known = knownProducts(ctx.ds.portfolio?.holdings ?? [], ctx.ds.policies ?? [], namesFunds(ctx.adviceMode) && ctx.picks ? pickNames(await ctx.picks().catch(() => NO_PICKS)) : [], history.filter((t) => t.role === 'user').map((t) => t.content));
      const v = violations(answer, ctx.adviceMode, funds, known);
      if ((v.named.length || v.exits || v.strangers.length) && !fundsRepaired) {
        fundsRepaired = true;
        messages.push({ role: 'assistant', content: res.content });
        const why = [
          v.named.length ? `It tells the user to trade ${v.named.join(', ')}: state the facts only, or name the category instead (for example "${funds[0]?.label ?? 'your small cap fund'}").` : '',
          v.exits ? 'It tells the user to sell, switch, exit, redeem or stop a fund, SIP or policy: Munim has no investment adviser licence, so give the facts and trade-offs only.' : '',
          v.strangers.length ? `It names ${v.strangers.join(', ')}, which the user doesn't hold${namesFunds(ctx.adviceMode) ? ' and which is not in advice_picks: name only products from advice_picks, or give the category and say no pick is set up yet' : ': name the category instead'}.` : '',
        ].filter(Boolean).join(' ');
        messages.push({ role: 'user', content: `[system check] ${why} Reply with the corrected spoken answer only.` });
        continue;
      }
      const final = guardAnswer(answer, ctx.adviceMode, funds, known, ctx.lang);
      return { answer: final, lang: ctx.lang, trace, actions, check: final === answer ? check : checkNumbers(final, results), engine: 'claude', model: MODEL, ms: Date.now() - t0, repaired: repaired || fundsRepaired };
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
  return { answer, lang: ctx.lang, trace, actions, check: checkNumbers(answer, results), engine: 'claude', model: MODEL, ms: Date.now() - t0 };
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
