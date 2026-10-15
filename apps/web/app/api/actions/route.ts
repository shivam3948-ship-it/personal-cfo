import { clearActions, gcalLink, listActions, removeAction } from '@/lib/actions';
import { json } from '@/lib/http';
import { resolve } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { sid } = await resolve(req);
  return json({ actions: listActions(sid).map((a) => ({ ...a, gcal: gcalLink(a) })) });
}

export async function DELETE(req: Request) {
  const ctx = await resolve(req); const sid = ctx.sid; const id = new URL(req.url).searchParams.get('id');
  if (id === 'all') { clearActions(sid); await ctx.flush(); return json({ ok: true }); }
  const ok = id ? removeAction(sid, id) : false; await ctx.flush();
  return json({ ok });
}
