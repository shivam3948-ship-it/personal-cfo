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
describe('end of turn: statements in English and Hindi (D-106 review)', () => {
  it('a statement with "is" or a Hindi word containing a question stem still waits', () => {
    expect(turnComplete('My small cap fund is falling.')).toBe(false);
    expect(turnComplete('It is down twenty percent this month.')).toBe(false);
    expect(turnComplete('Is it safe to keep money in a liquid fund')).toBe(true);
    expect(turnComplete('Can you check my card bill')).toBe(true);
    expect(turnComplete('मैं कबाड़ी की दुकान चलाता हूँ।')).toBe(false); // "कब" inside a word
  });
});

import { splitSpoken, spokenMax, SAYS_YES, SAYS_NO, MORE_ASK } from '@/ui/streamVoice';
describe('short spoken answers (D-108)', () => {
  it('says two sentences, then offers the rest; investment answers are said whole', () => {
    const rest = ['a.', 'b.', 'c.', 'd.'];
    expect(splitSpoken(rest, 0, spokenMax('a. b. c. d.'))).toEqual({ now: ['a.', 'b.'], later: ['c.', 'd.'] });
    expect(splitSpoken(rest, 0, spokenMax('your fund is up'))).toEqual({ now: ['a.', 'b.', 'c.', 'd.'], later: [] });
    expect(splitSpoken(['c.', 'd.'], 2, 2)).toEqual({ now: [], later: ['c.', 'd.'] }); // two already voiced while it was written
    expect(splitSpoken(['a.'], 0, 2)).toEqual({ now: ['a.'], later: [] }); // short answers are said whole, no offer
    expect(MORE_ASK.hi).toBe('और बताऊँ?');
  });
  it('a short yes says the rest; a short no ends the offer; anything longer is a new question', () => {
    for (const y of ['हाँ', 'हाँ जी', 'जी', 'और बताओ', 'haan', 'Yes.', 'ok', 'tell me more', 'हाँ, प्लीज़']) expect(SAYS_YES.test(y), y).toBe(true);
    for (const n of ['नहीं', 'बस', 'no thanks', "That's all", 'nahi']) expect(SAYS_NO.test(n), n).toBe(true);
    for (const q of ['हाँ, और मेरा कार्ड बिल कब है?', 'yes what about my loans', 'नहीं, मेरा मतलब SIP से था']) { expect(SAYS_YES.test(q), q).toBe(false); expect(SAYS_NO.test(q), q).toBe(false); }
  });
});

import { voiceLang } from '@/ui/streamVoice';
describe('the voice for each sentence (D-108)', () => {
  it('Roman-script Hindi gets the Hindi voice; English stays English', () => {
    expect(voiceLang('Aapka is mahine ka kharcha ₹18,400 hai.', 'en')).toBe('hi');
    expect(voiceLang('Emergency fund abhi 3.4 mahine ka hai.', 'en')).toBe('hi');
    expect(voiceLang('सितंबर में सबसे ज़्यादा किराया गया।', 'en')).toBe('hi');
    expect(voiceLang('Your card bill is due on 5 November.', 'hi')).toBe('en');
    expect(voiceLang('I see a ka-ching at the cafe.', 'hi')).toBe('en'); // one stray match is not Hinglish
    expect(voiceLang('₹18,400', 'hi')).toBe('hi');
  });
});

import { sayWhole } from '@/ui/streamVoice';
describe('short spoken answers never cut an investment answer (D-108 review)', () => {
  it('a sell or keep answer, with its balancing line and guard line, is said whole', () => {
    const answer = ['Your small cap fund is worth ₹92,440 against ₹1,10,373 in a plain index fund on the same dates.', 'It is 31 percent of your money.', 'Your portfolio has returned 14.2 percent a year.', 'If you need this money soon, a further fall matters more; if not for years, short falls matter less.', 'Munim doesn’t have an investment adviser licence yet, so it can’t tell you to sell, switch or stop a fund or policy; a SEBI-registered adviser can.'];
    expect(splitSpoken(answer, 0, spokenMax(answer.join(' '))).later).toEqual([]);
    const hi = ['आपका स्मॉल कैप फंड 92,440 रुपये का है।', 'अगर पैसा जल्दी चाहिए तो गिरावट ज़्यादा मायने रखती है।', 'मुनीम के पास अभी निवेश सलाहकार का लाइसेंस नहीं है।'];
    expect(splitSpoken(hi, 0, spokenMax(hi.join(' '))).later).toEqual([]);
  });
  it('a spending answer is still cut after two sentences', () => {
    const spend = ['सितंबर में सबसे ज़्यादा पैसा किराए में गया, 26,000।', 'उसके बाद लोन EMI 22,782 और ट्रैवल 21,000 रहा।', 'फ़ूड डिलीवरी भी 10,441 रही।'];
    expect(sayWhole(spend.join(' '))).toBe(false);
    expect(splitSpoken(spend, 0, spokenMax(spend.join(' '))).later).toHaveLength(1);
  });
});
