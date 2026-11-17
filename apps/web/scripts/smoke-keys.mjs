#!/usr/bin/env node
// Pre-event check: are the API keys valid, do the request shapes still work, how slow is each hop?
// Usage: npm run smoke   (reads .env.local; prints PASS/FAIL per service; writes .data/smoke-tts.*)
import fs from 'node:fs';
import path from 'node:path';

for (const f of ['.env.local', '.env']) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const out = (ok, name, msg) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(10)} ${msg}`);
fs.mkdirSync('.data', { recursive: true });

async function claude() {
  const key = process.env.ANTHROPIC_API_KEY; const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  if (!key) return out(false, 'Claude', 'ANTHROPIC_API_KEY missing (app will use offline rules)');
  const t = Date.now();
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model, max_tokens: 40, messages: [{ role: 'user', content: 'Reply with exactly: नमस्ते, ready.' }] }) });
  const j = await r.json().catch(() => ({}));
  out(r.ok, 'Claude', r.ok ? `${model} answered "${j.content?.[0]?.text}" in ${Date.now() - t} ms` : `${r.status} ${JSON.stringify(j).slice(0, 200)}`);
}

async function sarvam() {
  const key = process.env.SARVAM_API_KEY; const base = process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai';
  if (!key) return out(false, 'Sarvam', 'SARVAM_API_KEY missing (app will use browser speech)');
  const text = 'नमस्ते, आपके कार्ड का बिल 36,343 रुपये है, जो 24 अक्टूबर को देय है।';
  const model = process.env.SARVAM_TTS_MODEL || 'bulbul:v3';
  const shapes = [
    { text, target_language_code: 'hi-IN', model, output_audio_codec: 'mp3', ...(process.env.SARVAM_TTS_SPEAKER ? { speaker: process.env.SARVAM_TTS_SPEAKER } : {}) },
    { text, language_code: 'hi-IN', model, output_audio_codec: 'mp3', ...(process.env.SARVAM_TTS_SPEAKER ? { speaker: process.env.SARVAM_TTS_SPEAKER } : {}) },
    { text, target_language_code: 'hi-IN' },
  ];
  let audio = null; let ext = 'mp3';
  for (const [i, body] of shapes.entries()) {
    const t = Date.now();
    const r = await fetch(`${base}/text-to-speech`, { method: 'POST', headers: { 'api-subscription-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const raw = await r.text();
    if (r.ok) {
      const j = JSON.parse(raw); audio = j.audios?.[0] ?? (Array.isArray(j.audio) ? j.audio[0] : j.audio);
      if (audio?.startsWith('UklGR')) ext = 'wav';
      out(!!audio, 'Sarvam TTS', `request shape #${i + 1} ok in ${Date.now() - t} ms (${Object.keys(body).join(', ')})`);
      break;
    }
    out(false, 'Sarvam TTS', `shape #${i + 1}: ${r.status} ${raw.slice(0, 200)}`);
  }
  if (!audio) return;
  const file = path.join('.data', `smoke-tts.${ext}`);
  fs.writeFileSync(file, Buffer.from(audio, 'base64'));
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: ext === 'wav' ? 'audio/wav' : 'audio/mpeg' }), path.basename(file));
  form.append('model', process.env.SARVAM_STT_MODEL || 'saaras:v4');
  form.append('language_code', 'unknown');
  const t = Date.now();
  const r = await fetch(`${base}/speech-to-text`, { method: 'POST', headers: { 'api-subscription-key': key }, body: form });
  const j = await r.json().catch(() => ({}));
  out(r.ok, 'Sarvam STT', r.ok ? `"${j.transcript}" (${j.language_code}) in ${Date.now() - t} ms` : `${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  console.log(`      Listen to ${file} to judge the voice.`);
}

await claude().catch((e) => out(false, 'Claude', e.message));
await sarvam().catch((e) => out(false, 'Sarvam', e.message));
