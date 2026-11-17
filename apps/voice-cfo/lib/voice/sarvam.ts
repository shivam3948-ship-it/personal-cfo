// Sarvam AI speech APIs (server-side only; the key never reaches the browser).
// Docs checked Oct 2026: STT POST /speech-to-text (multipart: file, model, language_code), TTS POST /text-to-speech (JSON).
// Field names have changed between API versions, so TTS tries several request shapes (see sarvamTts).
const BASE = process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai';

export const sarvamConfigured = () => !!process.env.SARVAM_API_KEY;

export interface SttResult { transcript: string; languageCode: string | null; ms: number }

const EXT: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/aac': 'aac' };

/** Browsers label recordings "audio/webm;codecs=opus"; Sarvam rejects MIME parameters, so send the bare type with a matching extension. */
export function normaliseAudio(audio: Blob, filename: string): { blob: Blob; filename: string; mime: string } {
  const mime = (audio.type || 'audio/webm').split(';')[0].trim().toLowerCase();
  const ext = EXT[mime] ?? (filename.split('.').pop() || 'webm');
  const base = filename.replace(/\.[^.]*$/, '') || 'speech';
  return { blob: new Blob([audio], { type: mime }), filename: `${base}.${ext}`, mime };
}

export async function sarvamStt(audio: Blob, filename: string, lang: 'hi' | 'en' | 'auto' = 'auto'): Promise<SttResult> {
  const t0 = Date.now();
  const n = normaliseAudio(audio, filename);
  // Second attempt: a generic binary type (Sarvam accepts application/octet-stream and detects the container itself).
  const tries = [n.blob, new Blob([audio], { type: 'application/octet-stream' })];
  let last = '';
  for (let i = 0; i < tries.length; i++) {
    const form = new FormData();
    form.append('file', tries[i], n.filename);
    form.append('model', process.env.SARVAM_STT_MODEL || 'saaras:v4');
    if (process.env.SARVAM_STT_MODE) form.append('mode', process.env.SARVAM_STT_MODE); // only for saaras:v3, e.g. "codemix"
    form.append('language_code', lang === 'hi' ? 'hi-IN' : lang === 'en' ? 'en-IN' : 'unknown');
    const res = await fetch(`${BASE}/speech-to-text`, { method: 'POST', headers: { 'api-subscription-key': process.env.SARVAM_API_KEY ?? '' }, body: form });
    if (res.ok) {
      const j = (await res.json()) as { transcript?: string; language_code?: string };
      return { transcript: (j.transcript ?? '').trim(), languageCode: j.language_code ?? null, ms: Date.now() - t0 };
    }
    last = `Sarvam STT ${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (!(res.status === 400 && /file type|format|codec/i.test(last))) break; // only a format complaint is worth retrying
  }
  throw new Error(last);
}

export interface TtsResult { audioBase64: string; mime: string; ms: number; attempt: number }

/** Tries the current request shape first, then older shapes; the docs pages disagree on field names across versions. */
export async function sarvamTts(text: string, lang: 'hi' | 'en'): Promise<TtsResult> {
  const t0 = Date.now();
  const language = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const model = process.env.SARVAM_TTS_MODEL || 'bulbul:v3';
  const extra: Record<string, unknown> = {};
  if (process.env.SARVAM_TTS_SPEAKER) extra.speaker = process.env.SARVAM_TTS_SPEAKER;
  if (process.env.SARVAM_TTS_PACE) extra.pace = Number(process.env.SARVAM_TTS_PACE);
  const t = text.slice(0, 1500); // older API versions cap a text at 1500 characters
  const attempts: { body: Record<string, unknown>; mime: string }[] = [
    { body: { text: t, target_language_code: language, model, output_audio_codec: 'mp3', ...extra }, mime: 'audio/mpeg' },
    { body: { text: t, language_code: language, model, output_audio_codec: 'mp3', ...extra }, mime: 'audio/mpeg' },
    { body: { text: t, target_language_code: language }, mime: 'audio/wav' }, // API defaults: oldest shape
  ];
  const errors: string[] = [];
  for (let i = 0; i < attempts.length; i++) {
    const res = await fetch(`${BASE}/text-to-speech`, { method: 'POST', headers: { 'api-subscription-key': process.env.SARVAM_API_KEY ?? '', 'content-type': 'application/json' }, body: JSON.stringify(attempts[i].body) });
    if (res.ok) {
      const j = (await res.json()) as { audios?: string[]; audio?: string[] | string };
      const audio = j.audios?.[0] ?? (Array.isArray(j.audio) ? j.audio[0] : j.audio);
      if (!audio) throw new Error('Sarvam TTS returned no audio');
      const mime = audio.startsWith('UklGR') ? 'audio/wav' : attempts[i].mime; // "RIFF" header => WAV
      return { audioBase64: audio, mime, ms: Date.now() - t0, attempt: i + 1 };
    }
    errors.push(`${res.status} ${(await res.text()).slice(0, 160)}`);
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500) break; // not a request-shape problem
  }
  throw new Error(`Sarvam TTS failed: ${errors.join(' | ')}`);
}
