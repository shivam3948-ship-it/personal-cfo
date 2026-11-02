'use client';
// Browser voice I/O: MediaRecorder with simple silence detection (for Sarvam STT), Web Speech fallbacks for STT and TTS.

export interface Recording { blob: Blob; mime: string; ms: number }

export interface RecorderHandle { stop: () => void; cancel: () => void }

/** Records until `silenceMs` of quiet after speech, `maxMs`, or stop(). Reports input level 0..1. */
export async function record(opts: { onLevel?: (v: number) => void; silenceMs?: number; maxMs?: number; noSpeechMs?: number; onNoSpeech?: () => void; onDone: (r: Recording | null) => void }): Promise<RecorderHandle> {
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
    if (!spoke && opts.noSpeechMs && now - t0 > opts.noSpeechMs) { cancelled = true; stop(); opts.onNoSpeech?.(); return; } // hands-free: nobody spoke, so the conversation ends
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
let currentDone: (() => void) | null = null; // settles the clip's promise when it is stopped (pause fires no 'ended'), so an interrupted answer never hangs
let gen = 0; // bumped by stopSpeaking(): a piece-by-piece answer checks it before each piece

/** Phones only let a page play sound after a tap. Call this inside the mic tap so the spoken answer that arrives
 *  seconds later is allowed to play (a silent clip for <audio>, an empty utterance for the browser voice). */
export function unlockAudio() {
  try { const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='); a.volume = 0; a.play().catch(() => {}); } catch { /* ignore */ }
  try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch { /* ignore */ }
}
function halt() {
  if (current) { current.pause(); current = null; }
  if (currentDone) { const d = currentDone; currentDone = null; d(); }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
export function stopSpeaking() { gen++; halt(); }

/** Plays one clip; resolves true once it has played (or was stopped mid-way), false if it never started. */
export function playBase64(b64: string, mime: string, onStart?: () => void): Promise<boolean> {
  halt();
  return new Promise((resolve) => {
    let began = false;
    const a = new Audio(`data:${mime};base64,${b64}`); current = a;
    currentDone = () => resolve(true); // stopped mid-way counts as played: the caller checks whether it was stopped
    a.onplaying = () => { began = true; onStart?.(); onStart = undefined; };
    a.onended = () => { current = null; currentDone = null; resolve(true); }; a.onerror = () => { current = null; currentDone = null; resolve(began); };
    a.play().catch(() => resolve(false));
  });
}

export function browserSpeak(text: string, lang: 'hi' | 'en', onStart?: () => void): Promise<void> {
  halt();
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') return resolve(); // nothing can play: no first-word time
    const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; u.rate = 1;
    const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(lang === 'hi' ? 'hi' : 'en-in')) ?? speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(lang));
    if (v) u.voice = v;
    u.onstart = () => onStart?.();
    u.onend = () => resolve(); u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

export type Audio64 = { audioBase64: string; mime: string };
export interface SpokenRun { pieces: number; voice: 'sarvam' | 'browser' | 'none'; firstMs: number | null; stopped: boolean }

/** Speaks an answer piece by piece (D-058): piece 1 is turned into speech and starts playing while piece 2 is being
 *  made, and so on, so the first words come out after one short request instead of one long one. If the voice service
 *  fails, the rest is read by the browser's voice. `firstMs` is from the call to the first sound. Stop cancels it all. */
export async function speakPieces(pieces: string[], lang: 'hi' | 'en', tts: (piece: string) => Promise<Audio64 | null>, browserText: (piece: string) => string, onFirstSound?: () => void): Promise<SpokenRun> {
  stopSpeaking();
  const my = gen, t0 = performance.now();
  const run: SpokenRun = { pieces: pieces.length, voice: 'none', firstMs: null, stopped: false };
  const started = (v: 'sarvam' | 'browser') => () => { if (run.firstMs === null) { run.firstMs = Math.round(performance.now() - t0); run.voice = v; onFirstSound?.(); } };
  let useBrowser = false;
  let next: Promise<Audio64 | null> | null = pieces.length ? tts(pieces[0]).catch(() => null) : null;
  for (let i = 0; i < pieces.length; i++) {
    const audio = useBrowser ? null : await next;
    if (gen !== my) { run.stopped = true; return run; }
    next = !useBrowser && audio && i + 1 < pieces.length ? tts(pieces[i + 1]).catch(() => null) : null;
    const played = audio ? await playBase64(audio.audioBase64, audio.mime, started('sarvam')) : false;
    if (gen !== my) { run.stopped = true; return run; }
    if (!played) { useBrowser = true; next = null; await browserSpeak(browserText(pieces[i]), lang, started('browser')); } // same piece, never skipped
    if (gen !== my) { run.stopped = true; return run; }
  }
  return run;
}

/** Hands-free conversation (D-082): while Munim is speaking, listen for the user starting to talk so they can interrupt
 *  ("barge in"). The phone's echo cancellation removes most of Munim's own voice; the first 0.6 s learn how loud its
 *  leftover is, and the user must be clearly louder for 0.3 s. The microphone is recorded from the start into a short
 *  rolling buffer that never leaves the phone, so when the user cuts in, their first words (spoken while it was still
 *  making sure) are kept: the recording starts 0.3 s before they began, and ends on 1 s of quiet. Before they cut in,
 *  nothing is kept beyond the last 2 s and nothing is sent. */
export async function watchForSpeech(opts: { onSpeech: () => void; onLevel?: (v: number) => void; onDone: (r: Recording | null) => void; threshold?: number; holdMs?: number; silenceMs?: number; maxMs?: number }): Promise<{ stop: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  const ctx = new AudioContext(); const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
  const proc = ctx.createScriptProcessor(4096, 1, 1); const mute = ctx.createGain(); mute.gain.value = 0; src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
  const rate = ctx.sampleRate, keep = rate * 2; // rolling 2 s before the user cuts in
  let chunks: { at: number; d: Float32Array }[] = [], kept = 0, phase: 'watch' | 'rec' | 'done' = 'watch';
  proc.onaudioprocess = (e) => {
    if (phase === 'done') return;
    const d = new Float32Array(e.inputBuffer.getChannelData(0)); chunks.push({ at: performance.now(), d }); kept += d.length;
    while (phase === 'watch' && kept - chunks[0].d.length > keep) kept -= chunks.shift()!.d.length;
  };
  const buf = new Uint8Array(an.fftSize); const th = opts.threshold ?? 0.3, hold = opts.holdMs ?? 300, silenceMs = opts.silenceMs ?? 1000, maxMs = opts.maxMs ?? 20000;
  let since = 0, raf = 0, sumL = 0, nL = 0, quietSince = 0, recFrom = 0; const t0 = performance.now();
  const close = () => { phase = 'done'; chunks = []; kept = 0; cancelAnimationFrame(raf); proc.disconnect(); stream.getTracks().forEach((t) => t.stop()); ctx.close().catch(() => {}); opts.onLevel?.(0); };
  const finish = () => {
    const from = recFrom - 300; const parts = chunks.filter((c) => c.at >= from).map((c) => c.d); close();
    opts.onDone(parts.length ? { blob: wav(parts, rate), mime: 'audio/wav', ms: Math.round(performance.now() - recFrom) } : null);
  };
  const tick = () => {
    if (phase === 'done') return;
    an.getByteTimeDomainData(buf);
    let sum = 0; for (const v of buf) sum += (v - 128) * (v - 128);
    const level = Math.min(1, (Math.sqrt(sum / buf.length) / 128) * 6), now = performance.now();
    if (phase === 'watch') {
      if (now - t0 < 600) { sumL += level; nL++; raf = requestAnimationFrame(tick); return; }
      const need = Math.max(th, Math.min(0.6, (nL ? sumL / nL : 0) * 2)); // capped, so someone already talking can still cut in
      if (level > need) { if (!since) since = now; if (now - since > hold) { phase = 'rec'; recFrom = since; opts.onSpeech(); } } else since = 0;
    } else {
      opts.onLevel?.(level);
      if (level > 0.12) quietSince = 0; else if (!quietSince) quietSince = now;
      if ((quietSince && now - quietSince > silenceMs) || now - recFrom > maxMs) { finish(); return; }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => { if (phase !== 'done') { const wasRec = phase === 'rec'; close(); if (wasRec) opts.onDone(null); } } };
}

/** 16 kHz mono 16-bit WAV from float samples (smaller upload than the device rate, plenty for speech). */
function wav(parts: Float32Array[], rate: number): Blob {
  const n = parts.reduce((a, p) => a + p.length, 0), step = rate / 16000, out = Math.floor(n / step);
  const all = new Float32Array(n); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
  const b = new DataView(new ArrayBuffer(44 + out * 2));
  const w = (off: number, str: string) => { for (let i = 0; i < str.length; i++) b.setUint8(off + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); b.setUint32(4, 36 + out * 2, true); w(8, 'WAVE'); w(12, 'fmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, 16000, true); b.setUint32(28, 32000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, out * 2, true);
  for (let i = 0; i < out; i++) { const a = Math.floor(i * step), z = Math.min(n, Math.floor((i + 1) * step)); let sum = 0; for (let k = a; k < z; k++) sum += all[k]; const v = Math.max(-1, Math.min(1, sum / Math.max(1, z - a))); b.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Blob([b], { type: 'audio/wav' });
}
