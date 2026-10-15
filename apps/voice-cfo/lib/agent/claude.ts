import type Anthropic from '@anthropic-ai/sdk';
import { MODEL, getClient, type LlmClient } from '../llm';
import { systemPrompt } from './prompt';
import { TOOLS, runTool, type ToolCtx } from './tools';
import { checkNumbers, type NumberCheck } from './guard';
import type { Action } from '../actions';
import { asOfDate } from '../finance/picture';

export interface Turn { role: 'user' | 'assistant'; content: string }
export interface TraceStep { tool: string; input: Record<string, unknown>; result: Record<string, unknown>; ms: number }
export interface AgentReply { answer: string; lang: 'hi' | 'en'; trace: TraceStep[]; actions: Action[]; check: NumberCheck; engine: 'claude' | 'offline'; model?: string; ms: number }

export async function runClaude(history: Turn[], ctx: ToolCtx, client: LlmClient | null = getClient()): Promise<AgentReply> {
  if (!client) throw new Error('No ANTHROPIC_API_KEY');
  const t0 = Date.now();
  const system = systemPrompt({ asOf: asOfDate(ctx.ds), lang: ctx.lang, dataLabel: ctx.ds.label, sources: ctx.ds.log.filter((l) => l.file !== '(all documents)').map((l) => `${l.file} (${l.kind})`) });
  const messages: Anthropic.MessageParam[] = history.slice(-12).map((t) => ({ role: t.role, content: t.content }));
  const trace: TraceStep[] = []; const actions: Action[] = []; const results: unknown[] = [];
  for (let step = 0; step < 6; step++) {
    const res = await client.messages.create({ model: MODEL, max_tokens: 700, system, tools: TOOLS, messages });
    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !uses.length) {
      const answer = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join(' ').trim();
      return { answer, lang: ctx.lang, trace, actions, check: checkNumbers(answer, results), engine: 'claude', model: MODEL, ms: Date.now() - t0 };
    }
    messages.push({ role: 'assistant', content: res.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const s = Date.now();
      let out: Awaited<ReturnType<typeof runTool>>;
      try { out = await runTool(u.name, (u.input ?? {}) as Record<string, unknown>, ctx); }
      catch (e) { out = { result: { error: (e as Error).message } }; }
      trace.push({ tool: u.name, input: (u.input ?? {}) as Record<string, unknown>, result: out.result, ms: Date.now() - s });
      results.push(out.result); if (out.action) actions.push(out.action);
      toolResults.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out.result), is_error: 'error' in out.result });
    }
    messages.push({ role: 'user', content: toolResults });
  }
  const answer = ctx.lang === 'hi' ? 'माफ़ कीजिए, मैं इसका जवाब पूरा नहीं कर पाया। क्या आप सवाल थोड़ा छोटा करके पूछेंगे?' : "Sorry, I couldn't finish that one. Could you ask it a bit more simply?";
  return { answer, lang: ctx.lang, trace, actions, check: checkNumbers(answer, results), engine: 'claude', model: MODEL, ms: Date.now() - t0 };
}
