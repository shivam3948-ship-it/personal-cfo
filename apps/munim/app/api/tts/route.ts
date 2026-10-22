// Text to speech for an answer ("Listen"): Sarvam voice when a key is set, else the screen uses the browser's voice.
import { NextResponse } from 'next/server';
import { sarvamConfigured, sarvamTts } from '@/lib/voice/sarvam';
import { forSpeech } from '@core/agent/lang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  if (!sarvamConfigured()) return json({ error: 'Voice service not set up', fallback: 'browser' }, 501);
  const { text, lang } = (await req.json().catch(() => ({}))) as { text?: string; lang?: 'hi' | 'en' };
  if (!text?.trim()) return json({ error: 'No text' }, 400);
  const l = lang === 'en' ? 'en' : 'hi';
  try {
    const r = await sarvamTts(forSpeech(text.slice(0, 1500), l), l);
    return json({ audioBase64: r.audioBase64, mime: r.mime });
  } catch (e) {
    console.error('[tts]', (e as Error).message.slice(0, 200));
    return json({ error: 'Voice unavailable', fallback: 'browser' }, 502);
  }
}
