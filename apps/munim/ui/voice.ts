'use client';
// Browser voice I/O: MediaRecorder with simple silence detection (for Sarvam STT), Web Speech fallbacks for STT and TTS.

export interface Recording { blob: Blob; mime: string; ms: number }

export interface RecorderHandle { stop: () => void; cancel: () => void }

/** Records until `silenceMs` of quiet after speech, `maxMs`, or stop(). Reports input level 0..1. */
export async function record(opts: { onLevel?: (v: number) => void; silenceMs?: number; maxMs?: number; onDone: (r: Recording | null) => void }): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = []; const t0 = Date.now(); let cancelled = false;
  const ctx = new AudioContext(); const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
  const buf = new Uint8Array(an.fftSize); let spoke = false; let quietSince = 0; let raf = 0;
  const silenceMs = opts.silenceMs ?? 1400; const maxMs = opts.maxMs ?? 20000;
  const tick = () => {
    an.getByteTimeDomainData(buf);
    let sum = 0; for (const v of buf) sum += (v - 128) * (v - 128);
    const rms = Math.sqrt(sum / buf.length) / 128; const level = Math.min(1, rms * 6);
    opts.onLevel?.(level);
    const now = Date.now();
    if (level > 0.12) { spoke = true; quietSince = 0; } else if (spoke && !quietSince) quietSince = now;
    if ((spoke && quietSince && now - quietSince > silenceMs) || now - t0 > maxMs) { stop(); return; }
    raf = requestAnimationFrame(tick);
  };
  const cleanup = () => { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); ctx.close().catch(() => {}); opts.onLevel?.(0); };
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => { cleanup(); opts.onDone(cancelled || !chunks.length ? null : { blob: new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }), mime: rec.mimeType || mime, ms: Date.now() - t0 }); };
  const stop = () => { if (rec.state !== 'inactive') rec.stop(); };
  rec.start(250); raf = requestAnimationFrame(tick);
  return { stop, cancel: () => { cancelled = true; stop(); } };
}

type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; abort: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

export const browserSttAvailable = () => typeof window !== 'undefined' && !!((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

/** Web Speech recognition (Chrome/Edge). Returns a stop handle; calls onFinal once. */
export function browserListen(lang: 'hi' | 'en', onInterim: (t: string) => void, onFinal: (t: string) => void, onError: (e: string) => void): { stop: () => void } {
  const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Ctor) { onError('Speech recognition is not available in this browser'); return { stop: () => {} }; }
  const r = new Ctor(); r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; r.interimResults = true; r.continuous = false;
  let finalText = ''; let done = false;
  r.onresult = (e) => {
    let interim = '';
    for (let i = 0; i < e.results.length; i++) { const res = e.results[i]; if (res.isFinal) finalText += res[0].transcript; else interim += res[0].transcript; }
    onInterim(finalText + interim);
  };
  r.onerror = (e) => { if (!done) { done = true; onError(e.error); } };
  r.onend = () => { if (!done) { done = true; onFinal(finalText.trim()); } };
  r.start();
  return { stop: () => r.stop() };
}

let current: HTMLAudioElement | null = null;

/** Phones only let a page play sound after a tap. Call this inside the mic tap so the spoken answer that arrives
 *  seconds later is allowed to play (a silent clip for <audio>, an empty utterance for the browser voice). */
export function unlockAudio() {
  try { const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='); a.volume = 0; a.play().catch(() => {}); } catch { /* ignore */ }
  try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch { /* ignore */ }
}
export function stopSpeaking() {
  if (current) { current.pause(); current = null; }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

export function playBase64(b64: string, mime: string): Promise<void> {
  stopSpeaking();
  return new Promise((resolve) => {
    const a = new Audio(`data:${mime};base64,${b64}`); current = a;
    a.onended = () => { current = null; resolve(); }; a.onerror = () => { current = null; resolve(); };
    a.play().catch(() => resolve());
  });
}

export function browserSpeak(text: string, lang: 'hi' | 'en'): Promise<void> {
  stopSpeaking();
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') return resolve();
    const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; u.rate = 1;
    const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(lang === 'hi' ? 'hi' : 'en-in')) ?? speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(lang));
    if (v) u.voice = v;
    u.onend = () => resolve(); u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}
