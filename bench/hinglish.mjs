// Hinglish bench: which voice setting reads Roman-script Hinglish as Hindi? Made-up lines only.
import WebSocket from 'ws';
import { writeFileSync, mkdirSync } from 'node:fs';
const KEY = process.env.SARVAM_API_KEY;
const LINES = [
  { id: 'spend', text: 'Aapka is mahine ka kharcha ₹18,400 hai, pichhle mahine se thoda kam.', keys: [/ख़?र्च/, /महीन/, /18/] },
  { id: 'card', text: 'Aapke card ka bill ₹7,744 hai aur due date 5 November hai.', keys: [/कार्ड|card/i, /बिल|bill/i, /7/] },
  { id: 'safety', text: 'Emergency fund abhi 3.4 mahine ka hai, 6 mahine tak le jaana accha rahega.', keys: [/इमरजेंसी|emergency/i, /महीन/, /3/] },
];
const CANDIDATES = [
  { id: 'today: en-IN shubh_hi_customer', lang: 'en-IN', speaker: 'shubh_hi_customer' },
  { id: 'hi-IN shubh_hi_customer', lang: 'hi-IN', speaker: 'shubh_hi_customer' },
  { id: 'hi-IN shubh_enhi_companion', lang: 'hi-IN', speaker: 'shubh_enhi_companion' },
  { id: 'en-IN shubh_enhi_companion', lang: 'en-IN', speaker: 'shubh_enhi_companion' },
  { id: 'translit + hi-IN shubh_hi_customer', lang: 'hi-IN', speaker: 'shubh_hi_customer', translit: true },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function translit(text) {
  const r = await fetch('https://api.sarvam.ai/transliterate', { method: 'POST', headers: { 'api-subscription-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ input: text, source_language_code: 'en-IN', target_language_code: 'hi-IN', numerals_format: 'international' }) });
  const j = await r.json().catch(() => ({})); return r.ok ? j.transliterated_text : `ERR ${r.status} ${JSON.stringify(j).slice(0, 120)}`;
}
function synth(model, speaker, lang, text) {
  return new Promise((resolve) => {
    const chunks = []; const timer = setTimeout(() => done('timeout'), 20000);
    const ws = new WebSocket(`wss://api.sarvam.ai/text-to-speech/ws?model=${encodeURIComponent(model)}&send_completion_event=true`, [`api-subscription-key.${KEY}`]);
    const done = (err) => { clearTimeout(timer); try { ws.close(); } catch {} resolve({ err, pcm: Buffer.concat(chunks.map((c) => (c.subarray(0, 4).toString() === 'RIFF' ? c.subarray(44) : c))) }); };
    ws.on('open', () => { ws.send(JSON.stringify({ type: 'config', data: { language_code: lang, speaker, output_audio_codec: 'linear16', speech_sample_rate: 24000, enable_preprocessing: true, min_buffer_size: 30, max_chunk_length: 150 } })); ws.send(JSON.stringify({ type: 'text', data: { text } })); ws.send(JSON.stringify({ type: 'flush' })); });
    ws.on('message', (raw) => { const m = JSON.parse(String(raw)); if (m.type === 'audio') chunks.push(Buffer.from(m.data.audio, 'base64')); else if (m.type === 'event' && m.data?.event_type === 'final') done(null); else if (m.type === 'error') done(JSON.stringify(m.data).slice(0, 160)); });
    ws.on('error', (e) => done(String(e.message).slice(0, 120)));
  });
}
const wav = (pcm, rate = 24000) => { const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
async function hear(buf, lang) {
  const form = new FormData(); form.append('file', new Blob([buf], { type: 'audio/wav' }), 'a.wav'); form.append('model', 'saaras:v4'); form.append('language_code', lang);
  const r = await fetch('https://api.sarvam.ai/speech-to-text', { method: 'POST', headers: { 'api-subscription-key': KEY }, body: form });
  return r.ok ? (await r.json()).transcript ?? '' : `ERR ${r.status}`;
}
for (const c of CANDIDATES) for (const line of LINES) {
  const text = c.translit ? await translit(line.text) : line.text;
  const r = await synth('bulbul:v4-flash', c.speaker, c.lang, text);
  if (r.err || !r.pcm.length) { console.log(JSON.stringify({ cand: c.id, line: line.id, err: r.err ?? 'no audio', text: text.slice(0, 80) })); continue; }
  const heard = await hear(wav(r.pcm), 'hi-IN');
  const score = line.keys.filter((k) => k.test(heard)).length;
  console.log(JSON.stringify({ cand: c.id, line: line.id, score: `${score}/${line.keys.length}`, seconds: +(r.pcm.length / 48000).toFixed(2), text: c.translit ? text : undefined, heard }));
  await sleep(300);
}
