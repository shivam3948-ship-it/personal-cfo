import type Anthropic from '@anthropic-ai/sdk';
import { MODEL, getClient, type LlmClient } from '../llm';
import { systemPrompt } from './prompt';
import { TOOLS, runTool, type ToolCtx } from './tools';
import { checkNumbers, type NumberCheck } from './guard';
import type { Action } from '../actions';
import { asOfDate } from '../finance/picture';
import { holderNames, redact } from '../privacy/redact';

export interface Turn { role: 'user' | 'assistant'; content: string }
export interface TraceStep { tool: string; input: Record<string, unknown>; result: Record<string, unknown>; ms: number }
export interface AgentReply { answer: string; lang: 'hi' | 'en'; trace: TraceStep[]; actions: Action[]; check: NumberCheck; engine: 'claude' | 'offline'; model?: string; ms: number; repaired?: boolean }

export async function runClaude(history: Turn[], ctx: ToolCtx, client: LlmClient | null = getClient()): Promise<AgentReply> {
  if (!client) throw new Error('No ANTHROPIC_API_KEY');
  const t0 = Date.now();
  const system = systemPrompt({ asOf: asOfDate(ctx.ds), lang: ctx.lang, dataLabel: ctx.ds.label, sources: ctx.ds.log.filter((l) => l.file !== '(all documents)').map((l) => `${l.file} (${l.kind})`) });
  // The user's own words can carry PII too ("my PAN is…"): scrub them like document text before they reach the model.
  const names = holderNames(ctx.ds.docs.map((d) => d.text));
  const messages: Anthropic.MessageParam[] = history.slice(-12).map((t) => ({ role: t.role, content: t.role === 'user' ? redact(t.content, { names }) : t.content }));
  const trace: TraceStep[] = []; const actions: Action[] = []; const results: unknown[] = [];
  let repaired = false;
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
      return { answer, lang: ctx.lang, trace, actions, check, engine: 'claude', model: MODEL, ms: Date.now() - t0, repaired };
    }
    messages.push({ role: 'assistant', content: res.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const s = Date.now();
      let out: Awaited<ReturnType<typeof runTool>>;
      try { out = await runTool(u.name, (u.input ?? {}) as Record<string, unknown>, ctx); }
      catch (e) { out = { result: { error: (e as Error).message } }; }
      trace.push({ tool: u.name, input: (u.input ?? {}) as Record<string, unknown>, result: out.result, ms: Date.now() - s });
      results.push(out.result); if (out.action && !(out.action as { duplicate?: boolean }).duplicate) actions.push(out.action);
      toolResults.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out.result), is_error: 'error' in out.result });
    }
    messages.push({ role: 'user', content: toolResults });
  }
  const answer = ctx.lang === 'hi' ? 'माफ़ कीजिए, मैं इसका जवाब पूरा नहीं कर पाया। क्या आप सवाल थोड़ा छोटा करके पूछेंगे?' : "Sorry, I couldn't finish that one. Could you ask it a bit more simply?";
  return { answer, lang: ctx.lang, trace, actions, check: checkNumbers(answer, results), engine: 'claude', model: MODEL, ms: Date.now() - t0 };
}
