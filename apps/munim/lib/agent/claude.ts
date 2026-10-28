import type Anthropic from '@anthropic-ai/sdk';
import { MODEL, getClient, type LlmClient } from '@core/llm';
import { systemPrompt } from './prompt';
import { DISCLAIMER, namesFunds } from '@/lib/advice';
import { TOOLS, runTool, type ToolCtx } from './tools';
import { checkNumbers, type NumberCheck } from '@core/agent/guard';
import type { Action } from '@/lib/actionsCore';
import { asOfDate } from '@core/finance/picture';
import { holderNames, redact } from '@core/privacy/redact';
import { shortName } from '@core/portfolio/engine';
import type { Dataset } from '@core/types';

/** The user's own funds, as an answer might name them, and the words to use instead (D-051: no fund names in Ask before
 *  the licence; found by the first live eval, 28 Oct: Claude named a holding from the tool results in a Hinglish answer). */
export function fundNames(ds: Dataset, lang: 'hi' | 'en') {
  return (ds.portfolio?.holdings ?? []).map((h) => {
    const full = shortName(h.scheme).replace(/ Fund$/i, ''), two = full.split(' ').slice(0, 2).join(' ');
    const cat = h.category && h.category !== 'Other' ? h.category.toLowerCase() : '';
    return { full, two, label: lang === 'hi' ? (cat ? `आपका ${cat} फ़ंड` : 'आपका एक फ़ंड') : (cat ? `your ${cat} fund` : 'one of your funds') };
  }).filter((f) => f.two.length > 3);
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const namedFunds = (answer: string, funds: ReturnType<typeof fundNames>) => funds.filter((f) => new RegExp(esc(f.two), 'i').test(answer));
/** Last line of defence: any fund name still in the answer becomes its category ("your small cap fund"). */
export function scrubFunds(answer: string, funds: ReturnType<typeof fundNames>) {
  let a = answer;
  for (const f of funds) a = a.replace(new RegExp(`${esc(f.full)}(\\s+Fund)?|${esc(f.two)}(\\s+Fund)?`, 'gi'), f.label);
  return a;
}

export interface Turn { role: 'user' | 'assistant'; content: string }
export interface TraceStep { tool: string; input: Record<string, unknown>; result: Record<string, unknown>; ms: number }
export interface AgentReply { answer: string; lang: 'hi' | 'en'; trace: TraceStep[]; actions: Action[]; check: NumberCheck; engine: 'claude' | 'offline'; model?: string; ms: number; repaired?: boolean }

export async function runClaude(history: Turn[], ctx: ToolCtx, client: LlmClient | null = getClient()): Promise<AgentReply> {
  if (!client) throw new Error('No ANTHROPIC_API_KEY');
  const t0 = Date.now();
  const system = systemPrompt({ asOf: asOfDate(ctx.ds), lang: ctx.lang, dataLabel: ctx.ds.label, sources: ctx.ds.log.filter((l) => l.file !== '(all documents)').map((l) => `${l.file} (${l.kind})`), testMode: ctx.adviceMode === 'demo' || ctx.adviceMode === 'internal', disclaimer: DISCLAIMER[ctx.adviceMode][ctx.lang] });
  // The user's own words can carry PII too ("my PAN is…"): scrub them like document text before they reach the model.
  const names = [...holderNames(ctx.ds.docs.map((d) => d.text)), ...(ctx.names ?? [])];
  const messages: Anthropic.MessageParam[] = history.slice(-12).map((t) => ({ role: t.role, content: t.role === 'user' ? redact(t.content, { names }) : t.content }));
  const trace: TraceStep[] = []; const actions: Action[] = []; const results: unknown[] = [];
  let repaired = false, fundsRepaired = false;
  const funds = namesFunds(ctx.adviceMode) ? [] : fundNames(ctx.ds, ctx.lang);
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
      // One more repair round for fund names (D-051), then a hard scrub, so no fund is ever named on screen or aloud.
      const named = namedFunds(answer, funds);
      if (named.length && !fundsRepaired) {
        fundsRepaired = true;
        messages.push({ role: 'assistant', content: res.content });
        messages.push({ role: 'user', content: `[system check] Munim has no investment adviser licence, so answers never name a fund. Rewrite without these names: ${named.map((f) => f.two).join(', ')}. Say ${named.map((f) => `"${f.label}"`).join(', ')} instead. Reply with the corrected spoken answer only.` });
        continue;
      }
      return { answer: named.length ? scrubFunds(answer, funds) : answer, lang: ctx.lang, trace, actions, check, engine: 'claude', model: MODEL, ms: Date.now() - t0, repaired: repaired || fundsRepaired };
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
