// Live check of the deployed relay against real Sarvam (run on GitHub, D-100). Voices a Hindi sentence through the relay,
// then streams that voice back in as if spoken into a phone, and reports what came back and how fast. Prints timings and
// pass/fail only.
import WebSocket from 'ws';
import { createHmac } from 'node:crypto';

const KEY = process.env.SARVAM_API_KEY, URL = process.env.RELAY_URL ?? 'wss://munim-voice.fly.dev/v1';
const ORIGIN = 'https://personal-cfo-ruddy.vercel.app';
const tk = createHmac('sha256', KEY).update('munim-voice-ticket-v1').digest();
const exp = Math.floor(Date.now() / 1000) + 60, body = `${exp}.livecheck01`;
const ticket = `${body}.${createHmac('sha256', tk).update(body).digest('base64url')}`;
const SENTENCE = 'मेरा पैसा पिछले महीने कहाँ गया?';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ws = new WebSocket(`${URL}?t=${ticket}`, { origin: ORIGIN });
const msgs = []; ws.on('message', (raw) => msgs.push({ at: performance.now(), m: JSON.parse(String(raw)) }));
const wait = async (f, ms = 15000) => { const t = performance.now(); while (performance.now() - t < ms) { const k = msgs.findIndex((x) => f(x.m)); if (k >= 0) return msgs.splice(k, 1)[0]; await sleep(10); } return null; };
const t0 = performance.now();
await new Promise((res, rej) => { ws.on('open', res); ws.on('unexpected-response', (_q, r) => rej(new Error(`relay refused: ${r.statusCode}`))); ws.on('error', rej); });
console.log(`connected in ${Math.round(performance.now() - t0)} ms (includes any cold start)`);
if (!(await wait((m) => m.t === 'ready'))) throw new Error('no ready');

// 1 · voice out
const tSay = performance.now();
ws.send(JSON.stringify({ t: 'say', id: 'v1', text: SENTENCE, lang: 'hi' }));
const chunks = []; let first = null;
for (;;) { const x = await wait((m) => (m.t === 'audio' && m.id === 'v1') || m.t === 'said' || m.t === 'error'); if (!x) break; if (x.m.t !== 'audio') { if (x.m.t === 'error') console.log('voice error:', x.m.message); break; } first ??= x.at - tSay; chunks.push(Buffer.from(x.m.b64, 'base64')); }
let pcm = Buffer.concat(chunks.map((c) => (c.subarray(0, 4).toString() === 'RIFF' ? c.subarray(44) : c)));
console.log(`voice out: first audio ${Math.round(first ?? -1)} ms, ${chunks.length} chunks, ${(pcm.length / 2 / 24000).toFixed(2)} s of audio, wav headers: ${chunks.filter((c) => c.subarray(0, 4).toString() === 'RIFF').length}`);
if (!pcm.length) { console.log('FAIL: no audio'); process.exit(1); }

// 2 · voice in: that audio, resampled 24 kHz → 16 kHz, streamed in real time in 100 ms frames, then 1.5 s of silence
const s24 = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2)), n16 = Math.floor(s24.length * 2 / 3), s16 = new Int16Array(n16);
for (let i = 0; i < n16; i++) { const x = i * 1.5, j = Math.floor(x), f = x - j; s16[i] = Math.round((s24[j] ?? 0) * (1 - f) + (s24[j + 1] ?? 0) * f); }
const frames = []; for (let i = 0; i < s16.length; i += 1600) frames.push(Buffer.from(s16.slice(i, i + 1600).buffer));
for (let i = 0; i < 15; i++) frames.push(Buffer.alloc(3200));
ws.send(JSON.stringify({ t: 'listen', lang: 'hi' }));
if (!(await wait((m) => m.t === 'listening'))) throw new Error('speech-to-text did not open');
const tIn = performance.now(); const speechEnd = tIn + (s16.length / 16000) * 1000;
for (const f of frames) { ws.send(f); await sleep(100); }
const vs = await wait((m) => m.t === 'vad' && m.e === 'start', 2000), ve = await wait((m) => m.t === 'vad' && m.e === 'end', 4000), tx = await wait((m) => m.t === 'text', 6000);
const rel = (x) => (x ? `${Math.round(x.at - speechEnd)} ms after speech ended` : 'never');
console.log(`voice in: speech start ${vs ? Math.round(vs.at - tIn) + ' ms after audio began' : 'never'} · speech end ${rel(ve)} · transcript ${rel(tx)}`);
console.log(`transcript matches: ${tx ? /पैसा/.test(tx.m.text) && /महीने/.test(tx.m.text) : false}`);
ws.close();
process.exit(tx && first !== null ? 0 : 1);
