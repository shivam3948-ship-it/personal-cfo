import { clearActions, gcalLink, listActions, removeAction } from '@/lib/actions';
import { ACTION_TOOLS, runTool } from '@/lib/agent/tools';
import { datasetFor } from '@/lib/store';
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

/** Run one action tool directly from a button (same tool and idempotency as the voice agent). Body: { tool, input }. */
export async function POST(req: Request) {
  const ctx = await resolve(req);
  const body = (await req.json().catch(() => ({}))) as { tool?: string; input?: Record<string, unknown> };
  if (!body.tool || !ACTION_TOOLS.has(body.tool)) return json({ error: 'Unknown action' }, 400);
  const input = Object.fromEntries(Object.entries(body.input ?? {}).filter(([, v]) => ['string', 'number'].includes(typeof v)).map(([k, v]) => [k.slice(0, 40), typeof v === 'string' ? v.slice(0, 300) : v]));
  const out = await runTool(body.tool, input, { ds: await datasetFor(ctx.sid), sid: ctx.sid, lang: 'en' });
  await ctx.flush();
  return json({ result: out.result, action: out.action ?? null });
}
