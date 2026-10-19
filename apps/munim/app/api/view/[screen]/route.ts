// One read endpoint per screen ("backend for frontend"): the client asks for a screen, the server returns its view model.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { VIEWS, isScreen } from '@/lib/views/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  if (!isScreen(screen)) return NextResponse.json({ error: `Unknown screen "${screen}"` }, { status: 404 });
  try {
    const session = await getSession(req);
    const view = VIEWS[screen](await session.dataset(), session);
    return NextResponse.json({ screen, view }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(`[view:${screen}]`, (e as Error).message);
    return NextResponse.json({ error: 'Could not load this screen. Try again.' }, { status: 500 });
  }
}
