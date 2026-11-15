// Voice bench (D-103): each candidate Sarvam voice says the same Munim answers over the streaming WebSocket; we measure time
// to first audio, how fast it speaks, and whether Sarvam's own speech-to-text hears the figures back correctly. Saves wavs.
import WebSocket from 'ws';
import { writeFileSync, mkdirSync } from 'node:fs';
const KEY = process.env.SARVAM_API_KEY;
const CANDIDATES = [
  ['bulbul:v3', 'shubh'], // today
  ['bulbul:v4-flash', 'aparna_hi_customer'], ['bulbul:v4-flash', 'shubh_hi_customer'], ['bulbul:v4-flash', 'ritu_hi_customer_warm'],
  ['bulbul:v4-flash', 'kavya_hi_conversational'], ['bulbul:v4-flash', 'kabir_hi_conversational'], ['bulbul:v4-flash', 'simran_hi_assistant'],
  ['bulbul:v4-flash', 'ishita_hi_banking'], ['bulbul:v4-flash', 'sanchita_hi_banking'],
  ['bulbul:v4-flash', 'simran_enhi_customer'], ['bulbul:v4-flash', 'ishita_enhi_companion'], ['bulbul:v4-flash', 'shubh_enhi_companion'],
];
const LINES = [
  { id: 'hi', lang: 'hi-IN', text: 'सितंबर में आपने ₹92,510 ख़र्च किए। सबसे ज़्यादा किराया ₹26,000 और फ़ूड डिलीवरी ₹10,441 रहे। क्या मैं देखूँ कि कौन-से सब्सक्रिप्शन बेकार चल रहे हैं?', figures: ['92', '26', '10'] },
  { id: 'mix', lang: 'hi-IN', text: 'आपका credit card bill ₹7,744 का है और due date 5 नवंबर है। अभी pay कर देंगे तो interest नहीं लगेगा।', figures: ['7', '5'] },
  { id: 'en', lang: 'en-IN', text: 'Your emergency fund covers 3.4 months. Six months is the usual target, so about ₹1,20,000 more would get you there.', figures: ['3.4', '1'] },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function synth(model, speaker, line) {
  return new Promise((resolve) => {
    const t0 = performance.now(); let first = null; const chunks = [];
    const ws = new WebSocket(`wss://api.sarvam.ai/text-to-speech/ws?model=${encodeURIComponent(model)}&send_completion_event=true`, [`api-subscription-key.${KEY}`]);
    const done = (err) => { try { ws.close(); } catch {} resolve({ err, first, ms: Math.round(performance.now() - t0), pcm: Buffer.concat(chunks.map((c) => (c.subarray(0, 4).toString() === 'RIFF' ? c.subarray(44) : c))) }); };
    const timer = setTimeout(() => done('timeout'), 20000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'config', data: { language_code: line.lang, speaker, output_audio_codec: 'linear16', speech_sample_rate: 24000, enable_preprocessing: true, min_buffer_size: 30, max_chunk_length: 150 } }));
      ws.send(JSON.stringify({ type: 'text', data: { text: line.text } })); ws.send(JSON.stringify({ type: 'flush' }));
    });
    ws.on('message', (raw) => { const m = JSON.parse(String(raw));
      if (m.type === 'audio') { first ??= Math.round(performance.now() - t0); chunks.push(Buffer.from(m.data.audio, 'base64')); }
      else if (m.type === 'event' && m.data?.event_type === 'final') { clearTimeout(timer); done(null); }
      else if (m.type === 'error') { clearTimeout(timer); done(String(m.data?.message ?? m.data?.error ?? 'error').slice(0, 120)); } });
    ws.on('error', (e) => { clearTimeout(timer); done(String(e.message).slice(0, 120)); });
  });
}
const wav = (pcm, rate = 24000) => { const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
async function hear(buf, lang) {
  const form = new FormData(); form.append('file', new Blob([buf], { type: 'audio/wav' }), 'a.wav'); form.append('model', 'saaras:v4'); form.append('language_code', lang);
  const r = await fetch('https://api.sarvam.ai/speech-to-text', { method: 'POST', headers: { 'api-subscription-key': KEY }, body: form });
  return r.ok ? (await r.json()).transcript ?? '' : `ERR ${r.status}`;
}
mkdirSync('voices', { recursive: true });
const rows = [];
for (const [model, speaker] of CANDIDATES) for (const line of LINES) {
  let best = null;
  for (let rep = 0; rep < 2; rep++) { const r = await synth(model, speaker, line); if (!best || (r.first ?? 1e9) < (best.first ?? 1e9)) best = r; await sleep(300); }
  if (best.err || !best.pcm.length) { rows.push({ model, speaker, line: line.id, err: best.err ?? 'no audio' }); continue; }
  const w = wav(best.pcm); writeFileSync(`voices/${speaker}__${line.id}.wav`, w);
  const heard = await hear(w, line.lang);
  const digits = heard.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
  const hits = line.figures.filter((f) => digits.includes(f)).length;
  rows.push({ model, speaker, line: line.id, firstMs: best.first, totalMs: best.ms, seconds: +(best.pcm.length / 48000).toFixed(2), cps: +(line.text.length / (best.pcm.length / 48000)).toFixed(1), figures: `${hits}/${line.figures.length}`, heard: heard.slice(0, 140) });
}
writeFileSync('voices/results.json', JSON.stringify(rows, null, 1));
for (const r of rows) console.log(JSON.stringify(r));
