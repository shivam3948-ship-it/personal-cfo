// Usage events and answer metadata from phones (D-057). Cleaned again here (cleanBatch): known event names, safe values
// only. With no store configured the reply says so (x-munim-store: none) and the phone stops sending this visit.
// DELETE removes everything one phone sent, when its owner turns usage counts off.
import { NextResponse } from 'next/server';
import { cleanBatch, isInstallId } from '@/lib/telemetryCore';
import { deleteInstall, storeConfigured, storeEvents } from '@/lib/eventStore';
import { limiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const allowEvents = limiter(60, 10 * 60_000, Number(process.env.MUNIM_EVENTS_DAILY ?? 20000));
const allowDeletes = limiter(10, 10 * 60_000, 5000); // separate, so a busy events limit never blocks someone deleting theirs
const NONE = { status: 204, headers: { 'x-munim-store': 'none' } };

/** Only this site's own pages may write (a browser always sends Origin on a cross-site POST or DELETE). */
function refuse(req: Request, allow = allowEvents): NextResponse | null {
  const origin = req.headers.get('origin'), host = req.headers.get('host');
  if (origin && host) { try { if (new URL(origin).host !== host) return NextResponse.json({ error: 'forbidden' }, { status: 403 }); } catch { return NextResponse.json({ error: 'forbidden' }, { status: 403 }); } }
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  return allow(ip) ? null : NextResponse.json({ error: 'slow down' }, { status: 429 });
}

export async function POST(req: Request) {
  if (!storeConfigured()) return new NextResponse(null, NONE);
  const no = refuse(req); if (no) return no;
  const batch = cleanBatch(await req.json().catch(() => null));
  if (!batch) return NextResponse.json({ error: 'bad batch' }, { status: 400 });
  const ok = await storeEvents(batch.install, batch.events);
  return NextResponse.json({ stored: ok ? batch.events.length : 0 }, { status: ok ? 200 : 503 });
}

export async function DELETE(req: Request) {
  if (!storeConfigured()) return new NextResponse(null, NONE);
  const no = refuse(req, allowDeletes); if (no) return no;
  const b = (await req.json().catch(() => null)) as { install?: unknown } | null;
  if (!isInstallId(b?.install)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const ok = await deleteInstall(b.install);
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 503 });
}
