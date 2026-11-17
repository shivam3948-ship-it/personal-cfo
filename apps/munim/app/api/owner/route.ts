// Mark this browser as the owner's (D-089). POST {key}: if the key matches MUNIM_OWNER_KEY, sets an httpOnly cookie the
// page's scripts can't read. DELETE: unmarks it. GET: whether this browser is the owner's (Ask uses it to decide whether
// to send its turns to the log).
import { NextResponse } from 'next/server';
import { OWNER_COOKIE, isOwner, ownerKeyValid, ownerToken } from '@/lib/ownerUnlock';
import { limiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const tries = limiter(10, 10 * 60_000, Number.POSITIVE_INFINITY); // guessing: 10 tries per 10 minutes per address
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
const sameOrigin = (req: Request) => { const o = req.headers.get('origin'), h = req.headers.get('host'); try { return !o || !h || new URL(o).host === h; } catch { return false; } };

export async function GET(req: Request) { return json({ owner: isOwner(req) }); }

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!tries(ip)) return json({ error: 'slow down' }, 429);
  const body = (await req.json().catch(() => ({}))) as { key?: unknown };
  if (!ownerKeyValid(body.key)) return json({ owner: false }, 403);
  const res = json({ owner: true });
  res.cookies.set(OWNER_COOKIE, ownerToken()!, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 90 });
  return res;
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  const res = json({ owner: false });
  res.cookies.set(OWNER_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
