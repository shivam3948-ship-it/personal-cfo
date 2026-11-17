// Unlock advice for this browser (D-066). POST {key}: if advice is on and the key matches, sets an httpOnly cookie the page's
// scripts can't read. DELETE: locks it again. GET: whether this browser has advice on (the phone's Ask uses it).
import { NextResponse } from 'next/server';
import { ADVICE_COOKIE, adviceKeyValid, adviceToken, adviceUnlocked } from '@/lib/adviceUnlock';
import { limiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// guessing the key: 10 tries per 10 minutes per address. No daily total: one would let anyone lock the owner out for the
// day, and a 16+ character key can't be guessed at this rate anyway (review nit).
const tries = limiter(10, 10 * 60_000, Number.POSITIVE_INFINITY);
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
const sameOrigin = (req: Request) => { const o = req.headers.get('origin'), h = req.headers.get('host'); try { return !o || !h || new URL(o).host === h; } catch { return false; } };

export async function GET(req: Request) { return json({ advice: adviceUnlocked(req) }); }

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!tries(ip)) return json({ error: 'slow down' }, 429);
  const body = (await req.json().catch(() => ({}))) as { key?: unknown };
  if (!adviceKeyValid(body.key)) return json({ advice: false }, 403); // wrong key, or advice is off: same answer either way
  const res = json({ advice: true });
  res.cookies.set(ADVICE_COOKIE, adviceToken()!, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  const res = json({ advice: false });
  res.cookies.set(ADVICE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
