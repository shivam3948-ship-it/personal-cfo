'use client';
// Voice check for one phone (15 Nov: on the owner's Galaxy S24 Munim wasn't heard aloud, and talking over it didn't stop it).
// Plays the same sentence three ways and shows how loud the microphone hears the phone's own voice and yours, so we can see
// whether opening the microphone (needed to hear you cut in) turns the phone's speaker down or over to the earpiece. Sends
// nothing anywhere except the one sentence to the voice service; shows only loudness numbers.
import { useRef, useState } from 'react';
import { playBase64, unlockAudio, stopSpeaking } from '@/ui/voice';

type Mode = 'nomic' | 'aec' | 'raw';
const SENTENCE = 'नमस्ते, मैं मुनीम हूँ। क्या आप मुझे साफ़ सुन पा रहे हैं? बोलते समय बीच में कुछ कहिए।';

export default function VoiceTest() {
  const [log, setLog] = useState<string[]>([]);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const audio = useRef<{ b64: string; mime: string } | null>(null);
  const add = (s: string) => setLog((l) => [...l, s]);

  async function run(mode: Mode) {
    if (busy) return; setBusy(true); unlockAudio();
    try {
      if (!audio.current) {
        const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: SENTENCE, lang: 'hi' }) });
        const j = await r.json(); if (!j.audioBase64) { add(`voice service: ${r.status} ${j.error ?? ''}`); return; }
        audio.current = { b64: j.audioBase64, mime: j.mime };
      }
      let stream: MediaStream | null = null, ctx: AudioContext | null = null, timer = 0;
      const lv: number[] = [];
      if (mode !== 'nomic') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: mode === 'aec' ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Float32Array(an.fftSize);
        timer = window.setInterval(() => { an.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x; const db = Math.max(-90, Math.round(10 * Math.log10(s / buf.length + 1e-12))); lv.push(db); setLevel(db); }, 50);
        const st = stream.getAudioTracks()[0].getSettings() as MediaTrackSettings & { echoCancellation?: boolean };
        add(`${mode}: mic open · echo cancel ${st.echoCancellation ? 'on' : 'off'}`);
      }
      const t0 = performance.now(); let first = 0;
      const ok = await playBase64(audio.current.b64, audio.current.mime, () => { first = Math.round(performance.now() - t0); });
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop()); await ctx?.close();
      const sorted = [...lv].sort((a, b) => a - b), q = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : NaN);
      // how long the mic heard something clearly above silence, and the longest unbroken stretch: tells your voice (long) from echo leaking through (short bursts)
      let above = 0, run = 0, longest = 0; for (const d of lv) { if (d > -45) { above++; run++; longest = Math.max(longest, run); } else run = 0; }
      add(`${mode}: played ${ok ? 'yes' : 'NO'} · first sound ${first} ms${lv.length ? ` · mic heard: quiet ${q(0.1)} dB, typical ${q(0.5)} dB, loudest ${q(0.98)} dB · above −45 dB for ${above * 50} ms, longest ${longest * 50} ms` : ''}`);
    } catch (e) { add(`${mode}: error ${(e as Error).message}`); }
    finally { setBusy(false); setLevel(0); }
  }

  const btn = { minHeight: 52, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 16, fontWeight: 600 } as const;
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px', display: 'grid', gap: 12, background: 'var(--bg)', minHeight: '100dvh', color: 'var(--ink)' }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Voice check</h1>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14.5 }}>Phone volume up. Tap each button and say whether you heard Munim loud from the speaker, quietly, or from the earpiece. During 2 and 3, say something halfway through.</p>
      <button style={btn} disabled={busy} onClick={() => run('nomic')}>1 · Speak, microphone off</button>
      <button style={btn} disabled={busy} onClick={() => run('aec')}>2 · Speak, microphone on (echo cancel)</button>
      <button style={btn} disabled={busy} onClick={() => run('raw')}>3 · Speak, microphone on (no echo cancel)</button>
      <button style={{ ...btn, fontWeight: 400 }} onClick={() => stopSpeaking()}>Stop</button>
      <div aria-live="polite" style={{ fontSize: 13, color: 'var(--muted)' }}>Microphone level: {level ? `${level} dB` : '–'}</div>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: 'var(--card)', padding: 12, borderRadius: 12, margin: 0 }}>{log.join('\n') || 'Results appear here. Screenshot them for Claude.'}</pre>
    </main>
  );
}
