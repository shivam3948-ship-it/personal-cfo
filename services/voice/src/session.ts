// One voice session: the phone's microphone streams in, Sarvam's speech detection and transcripts stream back, and answers
// are voiced as they arrive (D-100). Nothing is stored or logged: audio and text pass through and are gone.
import WebSocket from 'ws';

export type Lang = 'hi' | 'en' | 'auto';
export interface Upstream { sttUrl: string; ttsUrl: string; key: string; ttsModel: string; speaker?: string; pace?: number }
type Out = (msg: object | Buffer) => void;

const langCode = (l: Lang) => (l === 'hi' ? 'hi-IN' : l === 'en' ? 'en-IN' : 'unknown');

export class Session {
  private stt: WebSocket | null = null;
  private tts: WebSocket | null = null;
  private ttsId: string | null = null;
  private ttsQueue: string[] = [];
  private ttsReady = false;
  private closed = false;

  constructor(private up: Upstream, private send: Out) {}

  /** Opens speech-to-text for this conversation: 16 kHz 16-bit mono PCM from the phone, speech start/end events back. */
  listen(lang: Lang) {
    this.unlisten();
    const q = new URLSearchParams({ 'language-code': langCode(lang), model: 'saaras:v4', input_audio_codec: 'pcm_s16le', sample_rate: '16000', vad_signals: 'true', flush_signal: 'true', high_vad_sensitivity: 'true' });
    const ws = new WebSocket(`${this.up.sttUrl}?${q}`, [`api-subscription-key.${this.up.key}`]);
    this.stt = ws;
    ws.on('open', () => this.send({ t: 'listening' }));
    ws.on('message', (raw) => {
      let m: { type?: string; data?: Record<string, unknown> };
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (m.type === 'events') {
        const s = m.data?.signal_type;
        if (s === 'START_SPEECH') this.send({ t: 'vad', e: 'start' });
        if (s === 'END_SPEECH') { this.send({ t: 'vad', e: 'end' }); if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'flush' })); }
      } else if (m.type === 'data') {
        const text = String(m.data?.transcript ?? '').trim();
        if (text) this.send({ t: 'text', text, lang: m.data?.language_code ?? null });
      } else if (m.type === 'error') this.send({ t: 'error', where: 'stt', message: String(m.data?.message ?? m.data?.error ?? 'speech-to-text error').slice(0, 200) });
    });
    ws.on('error', () => this.send({ t: 'error', where: 'stt', message: 'speech-to-text connection failed' }));
    ws.on('close', () => { if (this.stt === ws) { this.stt = null; if (!this.closed) this.send({ t: 'unlistened' }); } });
  }

  /** One frame of microphone audio (PCM s16le, 16 kHz, mono). Dropped until speech-to-text is open. */
  audio(pcm: Buffer) {
    if (this.stt?.readyState === WebSocket.OPEN) this.stt.send(JSON.stringify({ audio: { data: pcm.toString('base64'), sample_rate: 16000, encoding: 'audio/wav' } }));
  }

  unlisten() { const s = this.stt; this.stt = null; if (s && s.readyState <= WebSocket.OPEN) s.close(); }

  /** Voices one piece of an answer. Pieces with the same id share a connection and play in order; a new id stops the old one. */
  say(id: string, text: string, lang: 'hi' | 'en') {
    if (this.ttsId !== id) this.stop();
    if (!this.tts) this.openTts(id, lang);
    if (this.ttsReady) this.ttsText(text); else this.ttsQueue.push(text);
  }

  private openTts(id: string, lang: 'hi' | 'en') {
    const q = new URLSearchParams({ model: this.up.ttsModel, send_completion_event: 'true' });
    const ws = new WebSocket(`${this.up.ttsUrl}?${q}`, [`api-subscription-key.${this.up.key}`]);
    this.tts = ws; this.ttsId = id; this.ttsReady = false; this.ttsQueue = [];
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'config', data: { language_code: lang === 'hi' ? 'hi-IN' : 'en-IN', speaker: this.up.speaker ?? 'shubh', output_audio_codec: 'linear16', speech_sample_rate: 24000, min_buffer_size: 30, max_chunk_length: 150, ...(this.up.pace ? { pace: this.up.pace } : {}) } }));
      this.ttsReady = true;
      for (const t of this.ttsQueue.splice(0)) this.ttsText(t);
    });
    ws.on('message', (raw) => {
      if (this.tts !== ws) return;
      let m: { type?: string; data?: Record<string, unknown> };
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (m.type === 'audio' && typeof m.data?.audio === 'string') this.send({ t: 'audio', id, b64: m.data.audio, ct: m.data.content_type ?? 'audio/l16' });
      else if (m.type === 'event' && m.data?.event_type === 'final') this.send({ t: 'said', id });
      else if (m.type === 'error') this.send({ t: 'error', where: 'tts', id, message: String(m.data?.message ?? 'voice error').slice(0, 200) });
    });
    ws.on('error', () => this.send({ t: 'error', where: 'tts', id, message: 'voice connection failed' }));
    ws.on('close', () => { if (this.tts === ws) { this.tts = null; this.ttsReady = false; } });
  }

  private ttsText(text: string) {
    const t = text.trim().slice(0, 2400);
    if (!t || this.tts?.readyState !== WebSocket.OPEN) return;
    this.tts.send(JSON.stringify({ type: 'text', data: { text: t } }));
    this.tts.send(JSON.stringify({ type: 'flush' }));
  }

  /** The user cut in, or the answer changed: drop the voice mid-sentence (Sarvam has no cancel, so the connection closes). */
  stop() { const s = this.tts; this.tts = null; this.ttsId = null; this.ttsReady = false; this.ttsQueue = []; if (s && s.readyState <= WebSocket.OPEN) s.close(); }

  close() { this.closed = true; this.unlisten(); this.stop(); }
}
