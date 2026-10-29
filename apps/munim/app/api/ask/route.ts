// Ask Munim: one POST per question. The server picks whose money (session), the agent answers from engine figures only,
// and every number in the answer is checked against the tool results (checkNumbers) before it is shown.
import { NextResponse, after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSession, DISCLAIMER } from '@/lib/session';
import { respond, type Turn } from '@/lib/agent';
import { clearPending } from '@/lib/agent/offline';
import { PROMPT_VERSION } from '@/lib/agent/prompt';
import { storeConfigured, storeSampleTrace } from '@/lib/eventStore';
import { isInstallId, traceId } from '@/lib/telemetryCore';
import { aiConfig } from '@/lib/aiConfig';
import { redact } from '@core/privacy/redact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });

/** The disclaimer for this session's advice mode, so the screen shows the right one before the first answer. */
export async function GET(req: Request) {
  const session = await getSession(req);
  return json({ disclaimer: DISCLAIMER[session.adviceMode], testMode: session.adviceMode === 'demo' || session.adviceMode === 'internal' });
}

export async function POST(req: Request) {
  const session = await getSession(req);
  // Conversation id for follow-ups ("yes, set it"): issued by the server in an httpOnly cookie, never taken from the client,
  // and scoped under the session, so pending actions can't cross between visitors.
  const cookie = /(?:^|;\s*)munim_chat=([a-f0-9-]{36})/.exec(req.headers.get('cookie') ?? '')?.[1];
  const chat = cookie ?? randomUUID();
  const sid = `${session.id}:${chat}`;
  const body = (await req.json().catch(() => ({}))) as { messages?: Turn[]; lang?: 'hi' | 'en' | 'auto'; offline?: boolean; reset?: boolean; install?: unknown };
  if (body.reset) { clearPending(sid); return json({ ok: true }); }
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length || messages.at(-1)!.role !== 'user') return json({ error: 'Ask a question first.' }, 400);
  try {
    const ai = aiConfig(req); // ?ai=off or MUNIM_AI=off: the rules engine answers, no model is called (D-062)
    const r = await respond(messages, sid, await session.dataset(), body.lang ?? 'auto', !!body.offline || ai.chat === 'rules', session.adviceMode);
    // the client gets the answer, which engine answered, the number check and any drafted actions; tool names only, no raw results
    const trace = traceId(); // lets a thumbs up or down point at this answer
    const res = json({ answer: r.answer, lang: r.lang, engine: r.engine, model: r.model, prompt: PROMPT_VERSION, ms: r.ms, llm: r.llm, check: r.check, actions: r.actions, tools: r.trace.map((t) => t.tool), fallback: !!r.fallbackReason, repaired: !!r.repaired, guard: r.guard ?? 'none', guardMs: r.guardMs ?? 0, trace, disclaimer: DISCLAIMER[session.adviceMode][r.lang] });
    // Sample family only (synthetic data): keep the redacted question, answer and tool calls to debug the agent (D-057).
    // Only when the phone sent its install id (usage counts on, notice shown) and the browser sends no privacy signal,
    // so turning usage off deletes these too. Saved after the reply is sent. Real statement data never reaches this route.
    const privacy = req.headers.get('sec-gpc') === '1' || req.headers.get('dnt') === '1';
    if (session.kind === 'sample' && storeConfigured() && isInstallId(body.install) && !privacy) {
      const install = body.install;
      const q = messages.at(-1)!.content;
      after(() => storeSampleTrace({ id: trace, install, question: redact(q).slice(0, 2000), answer: redact(r.answer).slice(0, 4000), engine: r.engine, model: r.model ?? 'none', prompt: PROMPT_VERSION, lang: r.lang, ms: r.ms,
        grounded: r.check.ok, unverified: r.check.unverified.length, calls: r.trace.map((t) => ({ tool: t.tool, input: redact(JSON.stringify(t.input)).slice(0, 500), ms: t.ms })) }).then(() => undefined));
    }
    if (!cookie) res.cookies.set('munim_chat', chat, { httpOnly: true, sameSite: 'lax', path: '/api/ask', maxAge: 60 * 60 * 6 });
    return res;
  } catch (e) {
    console.error('[ask]', (e as Error).message);
    return json({ error: 'Munim could not answer just now. Try again.' }, 500);
  }
}
