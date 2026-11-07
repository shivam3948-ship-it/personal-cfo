// The owner's turn log (D-089). Only a browser holding the owner cookie (lib/ownerUnlock.ts) can write, read or clear it;
// anyone else gets 204 with x-munim-log: off and nothing is kept. The question and answer are redacted again here
// (names, PAN, account and phone numbers, emails, UPI ids) before they are stored, as a last net: on your own data the
// phone has already scrubbed the answer (askLocal). Kept 90 days (supabase/migrations/20261107_owner_turns.sql).
import { NextResponse } from 'next/server';
import { redact } from '@core/privacy/redact';
import { isOwner } from '@/lib/ownerUnlock';
import { cleanTurn, flagsOf, summarize, type TurnRecord } from '@/lib/turnLog';
import { deleteTurns, listTurns, storeConfigured, upsertTurn } from '@/lib/eventStore';
import { limiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const allow = limiter(120, 10 * 60_000, 5000);
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
const OFF = () => new NextResponse(null, { status: 204, headers: { 'x-munim-log': 'off', 'Cache-Control': 'no-store' } });
const sameOrigin = (req: Request) => { const o = req.headers.get('origin'), h = req.headers.get('host'); try { return !o || !h || new URL(o).host === h; } catch { return false; } };

export async function POST(req: Request) {
  if (!isOwner(req) || !storeConfigured()) return OFF();
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  if (!allow((req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown')) return json({ error: 'slow down' }, 429);
  const raw = await req.text(); if (raw.length > 40_000) return json({ error: 'too long' }, 413);
  let body: unknown; try { body = JSON.parse(raw); } catch { return json({ error: 'bad turn' }, 400); }
  const t = cleanTurn(body); if (!t) return json({ error: 'bad turn' }, 400);
  const rec: TurnRecord = { ...t, question: redact(t.question), answer: redact(t.answer) };
  const ok = await upsertTurn(rec, flagsOf(rec));
  return json({ stored: ok }, ok ? 200 : 503);
}

export async function GET(req: Request) {
  if (!isOwner(req)) return json({ error: 'This page is for the owner’s browser.' }, 403);
  if (!storeConfigured()) return json({ error: 'No store is set up (SUPABASE_URL).' }, 503);
  const rows = await listTurns(Number(new URL(req.url).searchParams.get('limit') ?? 300));
  if (!rows) return json({ error: 'Could not read the log. Has supabase/migrations/20261107_owner_turns.sql been run?' }, 503);
  const turns = rows.map((r) => cleanTurn(r.rec)).filter((t): t is TurnRecord => !!t);
  return json({ turns, summary: summarize(turns) });
}

export async function DELETE(req: Request) {
  if (!isOwner(req)) return json({ error: 'forbidden' }, 403);
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  return json({ deleted: await deleteTurns() });
}
