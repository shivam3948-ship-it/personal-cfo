// The relay's message filter (D-050), moved out of the route so it can be tested. Only text, the model's thinking blocks,
// tool calls and tool results pass; user and assistant text redacted again, tool results filtered again (defence in depth).
import type Anthropic from '@anthropic-ai/sdk';
import { redact } from '@core/privacy/redact';
import { forLlm } from '@core/privacy/forLlm';
import { defang } from '@core/privacy/injection';
import { TOOLS } from '@/lib/agent/tools';

export const MAX_BYTES = 48_000, MAX_MESSAGES = 24;
const TOOL_NAMES = new Set(TOOLS.map((t) => t.name));
const redactJson = (v: unknown) => { try { return JSON.parse(redact(JSON.stringify(v ?? {}))); } catch { return {}; } };

type Block = { type: string; [k: string]: unknown };
/** Only text, the assistant's own thinking blocks, tool calls and tool results; user and assistant text redacted again and tool
 *  results filtered again (defence in depth). */
export function clean(messages: unknown): Anthropic.MessageParam[] | null {
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) return null;
  const out: Anthropic.MessageParam[] = [];
  const issued = new Set<string>(); // tool_use ids the conversation actually made
  for (const m of messages as { role?: unknown; content?: unknown }[]) {
    if (m.role !== 'user' && m.role !== 'assistant') return null;
    if (typeof m.content === 'string') { out.push({ role: m.role, content: redact(m.content.slice(0, m.role === 'user' ? 2000 : 4000)) }); continue; }
    if (!Array.isArray(m.content)) return null;
    const blocks: Block[] = [];
    for (const b of m.content as Block[]) {
      if (b?.type === 'text' && typeof b.text === 'string') blocks.push({ type: 'text', text: redact(b.text.slice(0, m.role === 'user' ? 2000 : 4000)) });
      // the model's own thinking (Sonnet returns it with a signature): it must go back unchanged with its tool call, or the API
      // refuses the next turn; the signature is checked by the API, so a forged block fails there (phone fallback bug, 16 Nov)
      else if (b?.type === 'thinking' && m.role === 'assistant' && typeof b.thinking === 'string' && typeof b.signature === 'string') blocks.push({ type: 'thinking', thinking: b.thinking, signature: b.signature });
      else if (b?.type === 'redacted_thinking' && m.role === 'assistant' && typeof b.data === 'string') blocks.push({ type: 'redacted_thinking', data: b.data });
      else if (b?.type === 'tool_use' && m.role === 'assistant' && typeof b.id === 'string' && typeof b.name === 'string' && TOOL_NAMES.has(b.name)) { issued.add(b.id); blocks.push({ type: 'tool_use', id: b.id, name: b.name, input: redactJson(b.input) }); }
      else if (b?.type === 'tool_result' && m.role === 'user' && typeof b.tool_use_id === 'string' && issued.has(b.tool_use_id)) {
        let content: unknown = b.content; try { content = JSON.stringify(forLlm(JSON.parse(String(b.content)))); } catch { content = defang(redact(String(b.content ?? '').slice(0, 8000))); } // not JSON: still filtered for injection
        blocks.push({ type: 'tool_result', tool_use_id: b.tool_use_id, content: String(content), is_error: !!b.is_error });
      } else return null;
    }
    out.push({ role: m.role, content: blocks as unknown as Anthropic.MessageParam['content'] });
  }
  return out.at(-1)?.role === 'user' ? out : null;
}

