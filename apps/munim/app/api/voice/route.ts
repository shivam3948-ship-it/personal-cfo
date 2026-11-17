// A ticket for the voice relay (D-100): valid for 60 s, good for opening one streaming voice session from this site. The
// relay checks it with a key derived from the Sarvam key both sides hold. No user data in it; nothing is stored.
import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { signTicket, ticketKey } from '@/lib/voiceTicket';
import { aiConfig } from '@/lib/aiConfig';
import { limiter } from '@/lib/rateLimit';

// a ticket opens a session that spends the Sarvam account: 6 per 10 minutes per address, 600 a day (best effort per instance)
const allow = limiter(6, 10 * 60_000, Number(process.env.MUNIM_VOICE_DAILY ?? 600));

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The relay is checked before a ticket is handed out (and woken, if it was asleep), so a phone never waits on a relay that
// isn't there: it falls back to the record-and-upload loop at once. A healthy answer is trusted for a minute.
let healthyUntil = 0;
async function relayUp(wsUrl: string): Promise<boolean> {
  if (Date.now() < healthyUntil) return true;
  try {
    const r = await fetch(wsUrl.replace(/^wss:/, 'https:').replace(/\/v1$/, '/health'), { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (r.ok) { healthyUntil = Date.now() + 60_000; return true; }
  } catch { /* down or asleep too long */ }
  return false;
}

export async function GET(req: Request) {
  const key = process.env.SARVAM_API_KEY;
  const url = process.env.VOICE_RELAY_URL || 'wss://munim-voice.fly.dev/v1';
  const ai = aiConfig(req); // the no-model and browser-voice switches (MUNIM_AI=off, ?ai=off, MUNIM_STT/TTS=browser) win
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!key || ai.stt !== 'sarvam' || ai.tts !== 'sarvam' || process.env.MUNIM_STREAM_VOICE === 'off' || !allow(ip) || !(await relayUp(url)))
    return NextResponse.json({ stream: false }, { headers: { 'Cache-Control': 'no-store' } });
  const ticket = signTicket(ticketKey(key), Math.floor(Date.now() / 1000) + 60, randomBytes(9).toString('base64url'));
  return NextResponse.json({ stream: true, url, ticket }, { headers: { 'Cache-Control': 'no-store' } });
}
