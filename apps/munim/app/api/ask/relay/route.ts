// Ask Munim on your own data (D-050, option A). Your statements stay on the phone: the phone runs every tool itself and sends
// only the conversation and the filtered tool results. This route adds what the phone must not choose (the system prompt,
// the tool list and the advice mode, all from the server session), makes one model call and returns the reply.
// It stores nothing and logs no content. Without an API key it answers 503 and the phone uses its own rules engine.
import { NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { MODEL, getClient } from '@core/llm';
import { redact } from '@core/privacy/redact';
import { forLlm } from '@core/privacy/forLlm';
import { getSession, DISCLAIMER, namesFunds } from '@/lib/session';
import { systemPrompt } from '@/lib/agent/prompt';
import { TOOLS } from '@/lib/agent/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
const MAX_BYTES = 64_000, MAX_MESSAGES = 30;

type Block = { type: string; [k: string]: unknown };
/** Only text, tool calls and tool results; user text redacted again and tool results filtered again (defence in depth). */
function clean(messages: unknown): Anthropic.MessageParam[] | null {
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) return null;
  const out: Anthropic.MessageParam[] = [];
  for (const m of messages as { role?: unknown; content?: unknown }[]) {
    if (m.role !== 'user' && m.role !== 'assistant') return null;
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.role === 'user' ? redact(m.content.slice(0, 2000)) : m.content.slice(0, 4000) }); continue; }
    if (!Array.isArray(m.content)) return null;
    const blocks: Block[] = [];
    for (const b of m.content as Block[]) {
      if (b?.type === 'text' && typeof b.text === 'string') blocks.push({ type: 'text', text: m.role === 'user' ? redact(b.text.slice(0, 2000)) : b.text.slice(0, 4000) });
      else if (b?.type === 'tool_use' && m.role === 'assistant' && typeof b.id === 'string' && typeof b.name === 'string') blocks.push({ type: 'tool_use', id: b.id, name: b.name, input: (b.input ?? {}) as object });
      else if (b?.type === 'tool_result' && m.role === 'user' && typeof b.tool_use_id === 'string') {
        let content: unknown = b.content; try { content = JSON.stringify(forLlm(JSON.parse(String(b.content)))); } catch { content = redact(String(b.content ?? '').slice(0, 8000)); }
        blocks.push({ type: 'tool_result', tool_use_id: b.tool_use_id, content: String(content), is_error: !!b.is_error });
      } else return null;
    }
    out.push({ role: m.role, content: blocks as unknown as Anthropic.MessageParam['content'] });
  }
  return out.at(-1)?.role === 'user' ? out : null;
}

export async function POST(req: Request) {
  const client = getClient();
  if (!client) return json({ error: 'no_key' }, 503);
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: 'Too long.' }, 413);
  let body: { messages?: unknown; lang?: unknown; asOf?: unknown };
  try { body = JSON.parse(raw); } catch { return json({ error: 'Bad request.' }, 400); }
  const messages = clean(body.messages);
  if (!messages) return json({ error: 'Bad request.' }, 400);
  const lang = body.lang === 'hi' ? 'hi' : 'en';
  const asOf = typeof body.asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.asOf) ? body.asOf : new Date().toISOString().slice(0, 10);
  const session = await getSession(req);
  // 'demo' never reads real data (AGENTS.md): on your own statements the test build runs as 'internal' (same advice, honest disclaimer)
  const mode = session.adviceMode === 'demo' ? 'internal' : session.adviceMode;
  const system = systemPrompt({ asOf, lang, dataLabel: 'Your own statements, read on your phone', sources: ['bank and card statements, and a mutual fund CAS if added (only computed results reach you)'],
    testMode: namesFunds(mode), disclaimer: DISCLAIMER[mode][lang] });
  try {
    const res = await client.messages.create({ model: MODEL, max_tokens: 700, system, tools: TOOLS, messages });
    return json({ content: res.content, stop_reason: res.stop_reason, model: MODEL });
  } catch (e) {
    console.error('[ask/relay] model call failed', (e as Error).name); // no content in logs
    return json({ error: 'Munim could not answer just now.' }, 502);
  }
}
