// The AI check for Ask on your own data (D-069). The phone runs Ask itself (D-050) and sends only the answer's sentences, the
// names of the user's own funds and policies, and the products the user named, already redacted. This route adds what the
// phone must not choose: the check's own prompt, the model, whether advice is on (the server-checked cookie, D-066) and the
// owner's picks. It answers one structured question, so it can't be used as a general model endpoint. It stores nothing and
// logs no content. 503 when models are off or there is no key: the phone then uses the word patterns.
import { NextResponse } from 'next/server';
import { getClient } from '@core/llm';
import { redact } from '@core/privacy/redact';
import { modelsAllowed } from '@/lib/aiConfig';
import { adviceUnlocked } from '@/lib/adviceUnlock';
import { limiter } from '@/lib/rateLimit';
import { runJudge } from '@/lib/agent/judge';
import { pickNames } from '@/lib/advicePicks';
import { PICKS } from '@/lib/server/advicePicks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
const sameOrigin = (req: Request) => { const o = req.headers.get('origin'), host = req.headers.get('host'); try { return !!o && !!host && new URL(o).host === host; } catch { return false; } };
const allow = limiter(30, 10 * 60_000, Number(process.env.MUNIM_RELAY_DAILY ?? 2000)); // one check per answer at most twice; same order as the relay
const strings = (v: unknown, max: number, len: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max).map((x) => redact(x.slice(0, len))) : []);

export async function POST(req: Request) {
  const client = process.env.MUNIM_JUDGE === 'off' || !modelsAllowed(req) ? null : getClient();
  if (!client) return json({ error: 'no_key' }, 503);
  if (!sameOrigin(req)) return json({ error: 'Forbidden.' }, 403);
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  if (!allow(ip)) return json({ error: 'Too many checks just now.' }, 429);
  const raw = await req.text(); if (raw.length > 40_000) return json({ error: 'Too long.' }, 413);
  let body: { sentences?: unknown; held?: unknown; said?: unknown; lang?: unknown };
  try { body = JSON.parse(raw); } catch { return json({ error: 'Bad request.' }, 400); }
  const sentences = strings(body.sentences, 40, 600);
  if (!sentences.length) return json({ error: 'Bad request.' }, 400);
  const advice = adviceUnlocked(req);
  const v = await runJudge({ sentences, held: strings(body.held, 40, 120), said: strings(body.said, 5, 2000), lang: body.lang === 'hi' ? 'hi' : 'en', advice, picks: advice ? pickNames(PICKS) : [] }, client);
  if (!v) { console.error('[ask/judge] check failed or timed out'); return json({ error: 'check_failed' }, 502); } // no content in logs
  return json(v);
}
