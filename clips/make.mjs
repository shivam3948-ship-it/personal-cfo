// Synthetic question clips for the Saathi vs Munim teardown (made-up questions, a Sarvam voice; no real person's voice).
import { writeFileSync } from 'node:fs';
const KEY = process.env.SARVAM_API_KEY;
const CLIPS = [
  { id: 'hi-sell', lang: 'hi-IN', text: 'मेरा स्मॉल कैप फंड गिर रहा है। क्या मुझे उसे बेच देना चाहिए?' },
  { id: 'en-bonus', lang: 'en-IN', text: 'I got a bonus of twenty thousand rupees. Where should I put it?' },
  { id: 'hi-spend', lang: 'hi-IN', text: 'पिछले महीने मेरा सबसे ज़्यादा पैसा कहाँ गया?' },
];
for (const c of CLIPS) {
  const r = await fetch('https://api.sarvam.ai/text-to-speech', { method: 'POST', headers: { 'api-subscription-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: c.text, target_language_code: c.lang, model: 'bulbul:v3', speaker: 'ritu', speech_sample_rate: 16000 }) });
  if (!r.ok) { console.log(c.id, r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  const j = await r.json(); writeFileSync(`${c.id}.wav`, Buffer.from(j.audios[0], 'base64')); console.log(c.id, 'ok');
}
