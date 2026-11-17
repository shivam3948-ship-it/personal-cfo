// The owner's advice picks, for a browser with advice unlocked (D-066). The phone's Ask uses them on your own data;
// everyone else gets 403 and the picks never reach their phone.
import { NextResponse } from 'next/server';
import { adviceUnlocked } from '@/lib/adviceUnlock';
import { PICKS } from '@/lib/server/advicePicks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (!adviceUnlocked(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(PICKS, { headers: { 'Cache-Control': 'private, no-store' } });
}
