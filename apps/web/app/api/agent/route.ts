import { respond, type Turn } from '@/lib/agent';
import { forSpeech } from '@/lib/agent/lang';
import { json } from '@/lib/http';
import { resolve } from '@/lib/session';
import { clearPending } from '@/lib/agent/offline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ctx = await resolve(req); const sid = ctx.sid;
  const body = (await req.json().catch(() => ({}))) as { messages?: Turn[]; lang?: 'hi' | 'en' | 'auto'; offline?: boolean; reset?: boolean };
  if (body.reset) { clearPending(sid); return json({ ok: true }); }
  const messages = (body.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()).slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length || messages.at(-1)!.role !== 'user') return json({ error: 'Last message must be from the user' }, 400);
  try {
    const r = await respond(messages, sid, body.lang ?? 'auto', !!body.offline);
    await ctx.flush();
    return json({ ...r, speech: forSpeech(r.answer, r.lang) });
  } catch (e) {
    console.error('[agent]', (e as Error).message);
    return json({ error: 'Agent failed', detail: (e as Error).message.slice(0, 200) }, 500);
  }
}
