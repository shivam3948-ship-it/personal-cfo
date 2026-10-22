// Ask Munim: one POST per question. The server picks whose money (session), the agent answers from engine figures only,
// and every number in the answer is checked against the tool results (checkNumbers) before it is shown.
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSession, DISCLAIMER } from '@/lib/session';
import { respond, type Turn } from '@/lib/agent';
import { clearPending } from '@/lib/agent/offline';

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
  const body = (await req.json().catch(() => ({}))) as { messages?: Turn[]; lang?: 'hi' | 'en' | 'auto'; offline?: boolean; reset?: boolean };
  if (body.reset) { clearPending(sid); return json({ ok: true }); }
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length || messages.at(-1)!.role !== 'user') return json({ error: 'Ask a question first.' }, 400);
  try {
    const r = await respond(messages, sid, await session.dataset(), body.lang ?? 'auto', !!body.offline, session.adviceMode);
    // the client gets the answer, which engine answered, the number check and any drafted actions; tool names only, no raw results
    const res = json({ answer: r.answer, lang: r.lang, engine: r.engine, ms: r.ms, check: r.check, actions: r.actions, tools: r.trace.map((t) => t.tool), fallback: !!r.fallbackReason, disclaimer: DISCLAIMER[session.adviceMode][r.lang] });
    if (!cookie) res.cookies.set('munim_chat', chat, { httpOnly: true, sameSite: 'lax', path: '/api/ask', maxAge: 60 * 60 * 6 });
    return res;
  } catch (e) {
    console.error('[ask]', (e as Error).message);
    return json({ error: 'Munim could not answer just now. Try again.' }, 500);
  }
}
