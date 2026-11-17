import { listActions, toIcs } from '@/lib/actions';
import { sidOf } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = listActions(sidOf(req)).find((x) => x.id === id);
  if (!a || !(a.reminder || a.plan)) return new Response('Not found', { status: 404 });
  return new Response(toIcs(a), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="munim-${a.id}.ics"` } });
}
