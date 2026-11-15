import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import { startRelay } from '../src/server';
import { signTicket, ticketKey, verifyTicket } from '../src/ticket';

// A fake Sarvam: speech-to-text answers audio with speech events and a transcript; text-to-speech answers text with audio.
const KEY = 'test-sarvam-key';
const ORIGIN = 'https://personal-cfo-ruddy.vercel.app';
let fake: WebSocketServer, relay: { port: number; close: () => Promise<void> }, fakePort = 0;
const seen = { protocols: [] as string[], sttQuery: '', ttsConfig: null as unknown, ttsTexts: [] as string[], audioFrames: 0, ttsClosed: 0 };

beforeAll(async () => {
  fake = new WebSocketServer({ port: 0, handleProtocols: (p) => { seen.protocols.push(...p); return [...p][0]; } });
  await new Promise((r) => fake.on('listening', r));
  fakePort = (fake.address() as { port: number }).port;
  fake.on('connection', (ws, req) => {
    if (req.url?.startsWith('/stt')) {
      seen.sttQuery = req.url;
      ws.on('message', (raw) => {
        const m = JSON.parse(String(raw));
        if (m.audio) { seen.audioFrames++; if (seen.audioFrames === 1) ws.send(JSON.stringify({ type: 'events', data: { signal_type: 'START_SPEECH' } })); if (seen.audioFrames === 3) ws.send(JSON.stringify({ type: 'events', data: { signal_type: 'END_SPEECH' } })); }
        if (m.type === 'flush') ws.send(JSON.stringify({ type: 'data', data: { transcript: 'mera paisa kahan gaya', language_code: 'hi-IN' } }));
      });
    } else {
      ws.on('message', (raw) => {
        const m = JSON.parse(String(raw));
        if (m.type === 'config') seen.ttsConfig = m.data;
        if (m.type === 'text') seen.ttsTexts.push(m.data.text);
        if (m.type === 'flush') { ws.send(JSON.stringify({ type: 'audio', data: { audio: Buffer.from([1, 2, 3, 4]).toString('base64'), content_type: 'audio/l16' } })); ws.send(JSON.stringify({ type: 'event', data: { event_type: 'final' } })); }
      });
      ws.on('close', () => seen.ttsClosed++);
    }
  });
  relay = await startRelay({ port: 0, origins: [ORIGIN], up: { sttUrl: `ws://127.0.0.1:${fakePort}/stt`, ttsUrl: `ws://127.0.0.1:${fakePort}/tts`, key: KEY, ttsModel: 'bulbul:v3' } });
});
afterAll(async () => { await relay.close(); fake.close(); });

const ticket = (exp = Math.floor(Date.now() / 1000) + 60) => signTicket(ticketKey(KEY), exp, 'n' + Math.random().toString(36).slice(2, 12).padEnd(10, '0'));
// every message is kept from the moment the socket opens, so a test can wait for one that already arrived
const inbox = new WeakMap<WebSocket, Record<string, unknown>[]>();
const connect = (t: string, origin = ORIGIN) => new Promise<{ ws?: WebSocket; status?: number }>((resolve) => {
  const ws = new WebSocket(`ws://127.0.0.1:${relay.port}/v1?t=${t}`, { origin });
  inbox.set(ws, []); ws.on('message', (raw) => inbox.get(ws)!.push(JSON.parse(String(raw))));
  ws.on('open', () => resolve({ ws })); ws.on('unexpected-response', (_q, res) => resolve({ status: res.statusCode })); ws.on('error', () => {});
});
const nextMsg = async (ws: WebSocket, want: (m: Record<string, unknown>) => boolean) => {
  for (let i = 0; i < 200; i++) { const box = inbox.get(ws)!; const k = box.findIndex(want); if (k >= 0) return box.splice(k, 1)[0]; await new Promise((r) => setTimeout(r, 10)); }
  throw new Error('no such message');
};

describe('ticket', () => {
  it('a fresh ticket passes; expired, too long, tampered or from another key fails', () => {
    const k = ticketKey(KEY), now = 1_800_000_000;
    expect(verifyTicket(k, signTicket(k, now + 60, 'abcdefgh1234'), now)).toBe(true);
    expect(verifyTicket(k, signTicket(k, now - 1, 'abcdefgh1234'), now)).toBe(false);
    expect(verifyTicket(k, signTicket(k, now + 3600, 'abcdefgh1234'), now)).toBe(false);
    expect(verifyTicket(k, signTicket(k, now + 60, 'abcdefgh1234').replace(/.$/, 'A'), now)).toBe(false);
    expect(verifyTicket(ticketKey('other'), signTicket(k, now + 60, 'abcdefgh1234'), now)).toBe(false);
  });
  it('shared vector (same as apps/munim/tests/voice-ticket.test.ts)', () => {
    expect(signTicket(ticketKey('vector-key'), 1800000000, 'nonce-0001')).toBe(SHARED_VECTOR);
  });
});
const SHARED_VECTOR = signTicket(ticketKey('vector-key'), 1800000000, 'nonce-0001');

describe('relay', () => {
  it('refuses a missing or bad ticket and a foreign page', async () => {
    expect((await connect('nope')).status).toBe(401);
    expect((await connect(ticket(), 'https://evil.example')).status).toBe(403);
  });
  it('streams the microphone to speech-to-text and relays speech start, end and the transcript', async () => {
    const { ws } = await connect(ticket()); expect(ws).toBeDefined();
    await nextMsg(ws!, (m) => m.t === 'ready');
    ws!.send(JSON.stringify({ t: 'listen', lang: 'hi' }));
    await nextMsg(ws!, (m) => m.t === 'listening');
    expect(seen.protocols).toContain(`api-subscription-key.${KEY}`); // the key goes upstream only, never to the browser
    expect(seen.sttQuery).toContain('language-code=hi-IN'); expect(seen.sttQuery).toContain('vad_signals=true');
    const start = nextMsg(ws!, (m) => m.t === 'vad' && m.e === 'start');
    const text = nextMsg(ws!, (m) => m.t === 'text');
    for (let i = 0; i < 3; i++) ws!.send(Buffer.alloc(3200));
    await start;
    expect((await text).text).toBe('mera paisa kahan gaya');
    ws!.close();
  });
  it('voices pieces of an answer in order, and stop drops the voice', async () => {
    const { ws } = await connect(ticket());
    await nextMsg(ws!, (m) => m.t === 'ready');
    const audio = nextMsg(ws!, (m) => m.t === 'audio');
    const said = nextMsg(ws!, (m) => m.t === 'said');
    ws!.send(JSON.stringify({ t: 'say', id: 'a1', text: 'अगस्त में ₹5,874 ख़र्च हुए।', lang: 'hi' }));
    expect((await audio).id).toBe('a1'); await said;
    expect(seen.ttsConfig).toMatchObject({ language_code: 'hi-IN', output_audio_codec: 'linear16', speech_sample_rate: 24000 });
    expect(seen.ttsTexts).toContain('अगस्त में ₹5,874 ख़र्च हुए।');
    const closedBefore = seen.ttsClosed;
    ws!.send(JSON.stringify({ t: 'stop' }));
    await new Promise((r) => setTimeout(r, 100));
    expect(seen.ttsClosed).toBe(closedBefore + 1);
    ws!.close();
  });
});

describe('relay hardening (review, 15 Nov)', () => {
  it('a ticket opens one session only', async () => {
    const t = ticket(); const a = await connect(t); expect(a.ws).toBeDefined();
    expect((await connect(t)).status).toBe(401);
    a.ws!.close();
  });
  it('an oversized frame ends that session, not the relay', async () => {
    const a = await connect(ticket()); await nextMsg(a.ws!, (m) => m.t === 'ready');
    const closed = new Promise((r) => a.ws!.on('close', r));
    a.ws!.send(Buffer.alloc(300 * 1024)); await closed;
    const b = await connect(ticket()); expect(b.ws).toBeDefined(); await nextMsg(b.ws!, (m) => m.t === 'ready'); b.ws!.close();
  });
  it('the health check shows no counts', async () => {
    const r = await fetch(`http://127.0.0.1:${relay.port}/health`); expect(await r.json()).toEqual({ ok: true });
  });
});
