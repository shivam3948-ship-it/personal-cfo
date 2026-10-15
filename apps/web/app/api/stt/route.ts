import { sarvamConfigured, sarvamStt } from '@/lib/voice/sarvam';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sarvamConfigured()) return json({ error: 'SARVAM_API_KEY not set', fallback: 'browser' }, 501);
  const form = await req.formData();
  const file = form.get('file');
  const lang = (form.get('lang') as 'hi' | 'en' | 'auto' | null) ?? 'auto';
  if (!(file instanceof Blob) || file.size === 0) return json({ error: 'No audio' }, 400);
  if (file.size > 5_000_000) return json({ error: 'Audio too long; keep it under 30 seconds' }, 413);
  try {
    const r = await sarvamStt(file, (file as File).name || 'speech.webm', lang);
    return json(r);
  } catch (e) {
    console.error('[stt]', (e as Error).message);
    return json({ error: (e as Error).message.slice(0, 300), fallback: 'browser' }, 502);
  }
}
