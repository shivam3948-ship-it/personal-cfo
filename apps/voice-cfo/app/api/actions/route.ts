import { clearActions, gcalLink, listActions, removeAction } from '@/lib/actions';
import { json, sidOf } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sid = sidOf(req);
  return json({ actions: listActions(sid).map((a) => ({ ...a, gcal: gcalLink(a) })) });
}

export async function DELETE(req: Request) {
  const sid = sidOf(req); const id = new URL(req.url).searchParams.get('id');
  if (id === 'all') { clearActions(sid); return json({ ok: true }); }
  return json({ ok: id ? removeAction(sid, id) : false });
}
