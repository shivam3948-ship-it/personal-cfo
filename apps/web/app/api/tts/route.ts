import { sarvamConfigured, sarvamTts } from '@/lib/voice/sarvam';
import { json } from '@/lib/http';
import { allow, clientKey, LIMITS } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sarvamConfigured()) return json({ error: 'SARVAM_API_KEY not set', fallback: 'browser' }, 501);
  const { text, lang } = (await req.json().catch(() => ({}))) as { text?: string; lang?: 'hi' | 'en' };
  if (!text?.trim()) return json({ error: 'No text' }, 400);
  if (text.length > 800) return json({ error: 'Text too long to speak (800 characters max)', fallback: 'browser' }, 413);
  if (!allow(clientKey(req, 'tts'), LIMITS.tts)) return json({ error: 'Too many requests. Wait a minute and try again.', fallback: 'browser' }, 429);
  try {
    return json(await sarvamTts(text, lang === 'en' ? 'en' : 'hi'));
  } catch (e) {
    console.error('[tts]', (e as Error).message);
    return json({ error: (e as Error).message.slice(0, 300), fallback: 'browser' }, 502);
  }
}
