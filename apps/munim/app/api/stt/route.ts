// Speech to text for Ask Munim: the browser records, this sends the audio to Sarvam (key stays on the server) and returns
// the transcript. Munim keeps no copy of the audio. Without a key it answers 501 and the screen falls back to the browser's
// own speech recognition, or typing.
import { NextResponse } from 'next/server';
import { sarvamStt } from '@/lib/voice/sarvam';
import { aiConfig } from '@/lib/aiConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });

/** Whether server speech-to-text is set up, so the screen can pick the browser's recognition up front instead. */
export async function GET(req: Request) { return json({ configured: aiConfig(req).stt === 'sarvam' }); }

export async function POST(req: Request) {
  if (aiConfig(req).stt !== 'sarvam') return json({ error: 'Voice service not set up', fallback: 'browser' }, 501);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const lang = (form?.get('lang') as 'hi' | 'en' | 'auto' | null) ?? 'auto';
  if (!(file instanceof Blob) || file.size === 0) return json({ error: 'No audio' }, 400);
  if (file.size > 5_000_000) return json({ error: 'Keep it under 30 seconds' }, 413);
  try {
    const r = await sarvamStt(file, (file as File).name || 'speech.webm', lang);
    return json({ transcript: r.transcript, lang: r.languageCode?.startsWith('hi') ? 'hi' : r.languageCode?.startsWith('en') ? 'en' : null, ms: r.ms });
  } catch (e) {
    console.error('[stt]', (e as Error).message.slice(0, 200)); // status + provider message only; never the audio or transcript
    return json({ error: 'Could not hear that. Try again or type.', fallback: 'browser' }, 502);
  }
}
