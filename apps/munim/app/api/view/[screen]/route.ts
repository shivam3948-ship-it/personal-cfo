// One read endpoint per screen ("backend for frontend"): the client asks for a screen, the server returns its view model.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { VIEWS, isScreen } from '@/lib/views/registry';
import { benchSeries } from '@/lib/server/benchmarks';
import { vsBenchmarks } from '@core/portfolio/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  if (!isScreen(screen)) return NextResponse.json({ error: `Unknown screen "${screen}"` }, { status: 404 });
  try {
    const session = await getSession(req);
    const ds = await session.dataset();
    const view = VIEWS[screen](ds, session) as Record<string, unknown>;
    // the X-ray's "against its index" needs public index NAVs, fetched here (cached a day); without them the card hides
    if (screen === 'xray' && view.XR && ds.portfolio) {
      const { series } = await benchSeries().catch(() => ({ series: {} }));
      view.XR = { ...(view.XR as object), bench: vsBenchmarks(ds.portfolio.holdings, series, ds.portfolio.asOf) };
    }
    return NextResponse.json({ screen, view }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(`[view:${screen}]`, (e as Error).message);
    return NextResponse.json({ error: 'Could not load this screen. Try again.' }, { status: 500 });
  }
}
