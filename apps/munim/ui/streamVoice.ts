'use client';
// Streaming voice through Munim's relay (D-100): the microphone streams to speech-to-text the whole conversation, Sarvam's
// own speech detection says when you start and stop, and answers are voiced as audio streams back. Replaces the
// record → upload → transcribe → voice-each-sentence loop when the relay is reachable; AskLive falls back to that loop
// when it isn't. Audio is never stored: it passes through the relay to Sarvam and is gone.

export interface StreamHandlers {
  onVadStart?: () => void; onVadEnd?: () => void; onText?: (text: string, lang: string | null) => void;
  onLevel?: (v: number) => void; onClose?: (why: string) => void; onFirstAudio?: (id: string) => void; onSaid?: (id: string) => void;
}

const MIC_RATE = 16000, OUT_RATE = 24000;

/** Words Munim was saying, heard back through the microphone, are not a question (echo the phone didn't cancel). */
export function isEcho(heard: string, saying: string): boolean {
  const w = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((x) => x.length > 1);
  const h = w(heard), say = new Set(w(saying));
  if (!h.length || !say.size) return false;
  return h.filter((x) => say.has(x)).length / h.length >= 0.6;
}

/** Float samples (−1..1) to 16-bit little-endian PCM. */
export function toPcm16(f: Float32Array): ArrayBuffer {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); out[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
  return out.buffer;
}

/** Sarvam's linear16 chunk to float samples; a chunk may carry a WAV header, which is skipped. */
export function pcm16ToFloat(b: Uint8Array): Float32Array {
  const off = b.length > 44 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 ? 44 : 0; // "RIFF"
  const n = Math.floor((b.length - off) / 2), dv = new DataView(b.buffer, b.byteOffset + off, n * 2), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = dv.getInt16(i * 2, true) / 0x8000;
  return out;
}

export class StreamVoice {
  private static failed = false;
  private ws: WebSocket;
  private h: StreamHandlers;
  private mic: { ctx: AudioContext; stream: MediaStream; proc: ScriptProcessorNode } | null = null;
  private out: AudioContext; private gain: GainNode;
  private sources = new Set<AudioBufferSourceNode>(); private nextAt = 0;
  private current: string | null = null; private firstSent = new Set<string>(); private saidIds = new Set<string>();
  private drainWaiters: (() => void)[] = [];
  private lastAudioAt = 0;
  private firstHook: { id: string; f: () => void } | null = null;
  closed = false;

  private constructor(ws: WebSocket, h: StreamHandlers) {
    this.ws = ws; this.h = h;
    this.out = new AudioContext({ sampleRate: OUT_RATE }); this.gain = this.out.createGain(); this.gain.connect(this.out.destination);
    void this.out.resume().catch(() => {});
    ws.onmessage = (e) => this.onMessage(e.data);
    ws.onclose = () => { if (!this.closed) { this.closed = true; this.teardown(); this.h.onClose?.('closed'); } };
  }

  /** Opens a session, or null when streaming isn't available (no relay set up, refused, or unreachable within 4 s). */
  static async open(h: StreamHandlers): Promise<StreamVoice | null> {
    if (StreamVoice.failed) return null; // tried on this page and it didn't work: don't make every tap wait again
    try {
      const j = await fetch('/api/voice', { cache: 'no-store' }).then((r) => r.json());
      if (!j.stream) return null;
      const ws = new WebSocket(`${j.url}?t=${encodeURIComponent(j.ticket)}`);
      const ok = await new Promise<boolean>((res) => {
        const timer = setTimeout(() => res(false), 4000);
        ws.onmessage = (e) => { try { if (JSON.parse(String(e.data)).t === 'ready') { clearTimeout(timer); res(true); } } catch { /* not json */ } };
        ws.onerror = () => { clearTimeout(timer); res(false); }; ws.onclose = () => { clearTimeout(timer); res(false); };
      });
      if (!ok) { StreamVoice.failed = true; try { ws.close(); } catch { /* ignore */ } return null; }
      return new StreamVoice(ws, h);
    } catch { return null; }
  }

  private send(m: object | ArrayBuffer) { if (this.ws.readyState === WebSocket.OPEN) this.ws.send(m instanceof ArrayBuffer ? m : JSON.stringify(m)); }

  private onMessage(data: unknown) {
    let m: { t?: string; e?: string; text?: string; lang?: string | null; id?: string; b64?: string };
    try { m = JSON.parse(String(data)); } catch { return; }
    if (m.t === 'vad') { if (m.e === 'start') this.h.onVadStart?.(); else this.h.onVadEnd?.(); }
    else if (m.t === 'text' && m.text) this.h.onText?.(m.text, m.lang ?? null);
    else if (m.t === 'audio' && m.id && m.b64 && m.id === this.current) this.play(m.id, m.b64);
    else if (m.t === 'said' && m.id) { this.saidIds.add(m.id); this.h.onSaid?.(m.id); this.checkDrain(); }
  }

  /** Starts streaming the microphone (echo cancellation on). Call inside the tap that starts the conversation. */
  async startMic(lang: 'hi' | 'en' | 'auto' = 'auto') {
    this.send({ t: 'listen', lang });
    if (this.mic) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    const ctx = new AudioContext({ sampleRate: MIC_RATE }); await ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(1024, 1, 1); const mute = ctx.createGain(); mute.gain.value = 0;
    proc.onaudioprocess = (e) => {
      const f = e.inputBuffer.getChannelData(0);
      let s = 0; for (let i = 0; i < f.length; i++) s += f[i] * f[i];
      this.h.onLevel?.(Math.min(1, Math.sqrt(s / f.length) * 6));
      this.send(toPcm16(f));
    };
    src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    this.mic = { ctx, stream, proc };
  }

  stopMic() {
    const m = this.mic; this.mic = null; this.send({ t: 'unlisten' });
    if (m) { m.proc.disconnect(); m.stream.getTracks().forEach((t) => t.stop()); void m.ctx.close().catch(() => {}); }
  }

  /** Voices an answer, piece by piece in order; resolves when all of it has played (or it was stopped). */
  speak(id: string, pieces: string[], lang: 'hi' | 'en', onFirst?: () => void): Promise<void> {
    this.stopVoice(); this.current = id; this.firstHook = onFirst ? { id, f: onFirst } : null; this.saidIds.delete(id); this.gain.gain.value = 1;
    for (const p of pieces) this.send({ t: 'say', id, text: p, lang });
    const want = pieces.length;
    let said = 0;
    return new Promise((resolve) => {
      const prev = this.h.onSaid;
      this.h.onSaid = (sid) => { prev?.(sid); if (sid === id) said++; };
      const t0 = performance.now();
      // done when every piece was voiced and has played, or (if the voice service doesn't confirm each piece) when audio
      // stopped arriving 1.5 s ago and has all played; never later than a minute
      const check = () => {
        const drained = this.out.currentTime >= this.nextAt - 0.02, now = performance.now();
        const quiet = this.firstSent.has(id) && now - this.lastAudioAt > 1500;
        if (this.current !== id || (drained && (said >= want || quiet)) || now - t0 > 60_000) { this.h.onSaid = prev; resolve(); return true; }
        return false;
      };
      const tick = () => { if (!check()) setTimeout(tick, 60); };
      tick();
    });
  }

  private play(id: string, b64: string) {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const f = pcm16ToFloat(bin); if (!f.length) return;
    const buf = this.out.createBuffer(1, f.length, OUT_RATE); buf.copyToChannel(f, 0);
    const s = this.out.createBufferSource(); s.buffer = buf; s.connect(this.gain);
    const at = Math.max(this.out.currentTime + 0.03, this.nextAt);
    s.start(at); this.nextAt = at + buf.duration; this.sources.add(s);
    s.onended = () => { this.sources.delete(s); this.checkDrain(); };
    this.lastAudioAt = performance.now();
    if (!this.firstSent.has(id)) { this.firstSent.add(id); this.h.onFirstAudio?.(id); if (this.firstHook?.id === id) this.firstHook.f(); }
  }

  private checkDrain() { if (!this.sources.size) { const w = this.drainWaiters.splice(0); w.forEach((f) => f()); } }

  get playing() { return this.sources.size > 0; }
  /** You may be cutting in: Munim's voice drops to a fifth until it's clear (Saathi-style ducking). */
  duck(on: boolean) { this.gain.gain.setTargetAtTime(on ? 0.2 : 1, this.out.currentTime, 0.03); }

  /** Stops Munim mid-word (you cut in, or a new answer started). */
  stopVoice() {
    if (this.current) this.send({ t: 'stop' });
    this.current = null;
    for (const s of this.sources) { try { s.stop(); } catch { /* already ended */ } }
    this.sources.clear(); this.nextAt = 0; this.checkDrain();
  }

  private teardown() { this.stopMic(); this.stopVoice(); void this.out.close().catch(() => {}); }
  close() { if (this.closed) return; this.closed = true; this.teardown(); try { this.ws.close(); } catch { /* ignore */ } }
}
