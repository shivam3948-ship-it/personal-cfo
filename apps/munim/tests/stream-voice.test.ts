import { describe, it, expect } from 'vitest';
import { isEcho, toPcm16, pcm16ToFloat } from '@/ui/streamVoice';

// D-100: streaming voice helpers.
describe('streaming voice', () => {
  it('Munim heard back through the mic is echo; a new question is not', () => {
    const saying = 'अगस्त में आपने ₹5,874 ख़र्च किए, सबसे ज़्यादा खाने पर।';
    expect(isEcho('अगस्त में आपने ख़र्च किए', saying)).toBe(true);
    expect(isEcho('रुको, मेरा लोन कितना बाकी है', saying)).toBe(false);
    expect(isEcho('stop, how much is left on my loan', 'You spent 5,874 in August, most of it on food.')).toBe(false);
    expect(isEcho('', saying)).toBe(false);
  });
  it('PCM in and out round-trips, and a WAV header is skipped', () => {
    const f = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const back = pcm16ToFloat(new Uint8Array(toPcm16(f)));
    back.forEach((v, i) => expect(v).toBeCloseTo(f[i], 3));
    const wav = new Uint8Array(44 + 4); wav.set([0x52, 0x49, 0x46, 0x46]); new DataView(wav.buffer).setInt16(44, 16384, true);
    expect(pcm16ToFloat(wav)[0]).toBeCloseTo(0.5, 3);
  });
});

describe('interrupting is never mistaken for echo (15 Nov)', () => {
  it('a short interruption that repeats Munim’s words still counts as you', () => {
    expect(isEcho('सितंबर का बताओ', 'सितंबर में आपने ₹5,874 ख़र्च किए')).toBe(false);
    expect(isEcho('stop', 'Stop paying for the gym if you never go.')).toBe(false);
    expect(isEcho('रुको रुको सितंबर नहीं अगस्त का बताओ', 'सितंबर में आपने ख़र्च किए')).toBe(false);
  });
});

import { turnComplete } from '@/ui/streamVoice';
describe('end of turn (D-106)', () => {
  it('a statement that pauses waits for the rest; a question or request goes at once', () => {
    expect(turnComplete('मेरा स्मॉल कैप फंड गिर रहा है।')).toBe(false);
    expect(turnComplete('मेरा स्मॉल कैप फंड गिर रहा है। क्या मुझे उसे बेच देना चाहिए?')).toBe(true);
    expect(turnComplete('I got a bonus of twenty thousand rupees.')).toBe(false);
    expect(turnComplete('I got a bonus of twenty thousand rupees. Where should I put it?')).toBe(true);
    expect(turnComplete('पिछले महीने मेरा सबसे ज़्यादा पैसा कहाँ गया')).toBe(true);
    expect(turnComplete('सितंबर का ख़र्च बताओ')).toBe(true);
    expect(turnComplete('mera kharcha batao')).toBe(true);
    expect(turnComplete('हाँ')).toBe(true);
    expect(turnComplete('ok thanks')).toBe(true);
  });
});
