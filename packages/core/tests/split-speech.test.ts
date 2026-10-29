import { describe, expect, it } from 'vitest';
import { splitForSpeech } from '../src/agent/lang';

const join = (a: string[]) => a.join(' ');

describe('splitForSpeech (D-058)', () => {
  it('gives the first sentence on its own, then larger pieces', () => {
    const t = 'You spent ₹42,300 this month. Food delivery was the biggest at ₹8,450. That is ₹1,200 more than last month. Your rent of ₹15,000 went out on the 1st. Nothing unusual otherwise.';
    const p = splitForSpeech(t, { max: 90 });
    expect(p[0]).toBe('You spent ₹42,300 this month.');
    expect(p.length).toBeGreaterThan(2);
    expect(p.slice(1).every((x) => x.length <= 90)).toBe(true);
    expect(join(p)).toBe(t);
  });
  it('keeps decimals, amounts and abbreviations inside a sentence', () => {
    const p = splitForSpeech('Your XIRR is 11.4% a year vs. 7.1% for an FD. Rs. 1,25,000.50 is unused. Done.');
    expect(p[0]).toBe('Your XIRR is 11.4% a year vs. 7.1% for an FD.');
    expect(join(p)).toContain('Rs. 1,25,000.50 is unused.');
  });
  it('splits Hindi on the danda', () => {
    const p = splitForSpeech('इस महीने आपने ₹42,300 खर्च किए। सबसे ज़्यादा खाने की डिलीवरी पर गया। बाकी सब सामान्य है।', { max: 40 });
    expect(p[0]).toBe('इस महीने आपने ₹42,300 खर्च किए।');
    expect(p.length).toBe(3);
  });
  it('merges a very short first sentence with the next one', () => {
    expect(splitForSpeech('Yes. You can cover rent before salary. The EMI is due on the 5th.')[0]).toBe('Yes. You can cover rent before salary.');
  });
  it('handles one sentence, no punctuation and empty text', () => {
    expect(splitForSpeech('Just one line without a full stop')).toEqual(['Just one line without a full stop']);
    expect(splitForSpeech('   ')).toEqual([]);
  });
});

describe('a short first piece for voice (latency sprint)', () => {
  it('cuts a long first sentence at its last clause break, keeping rupee numbers whole', () => {
    const a = 'In September, ₹1,40,292 went out in total, rent was the biggest item at ₹26,000, then loan EMIs at ₹22,782. Food came next.';
    const p = splitForSpeech(a, { firstMax: 60 });
    expect(p[0]).toBe('In September, ₹1,40,292 went out in total,');
    expect(p.join(' ')).toBe(a);
    expect(splitForSpeech(a)[0]).toBe('In September, ₹1,40,292 went out in total, rent was the biggest item at ₹26,000, then loan EMIs at ₹22,782.'); // unchanged without firstMax
  });
  it('leaves a sentence with no clause break alone', () => {
    const b = 'Your card bill of ₹36,343 is due on 24 October and your balance covers it easily today.';
    expect(splitForSpeech(b, { firstMax: 40 })[0]).toBe(b);
  });
});

describe('the voice cut never leaves a bare instruction (review, 29 Oct)', () => {
  it('keeps a refusal whole when the negation comes later, in Hindi and English', () => {
    const hi = 'अपना HDFC फंड अभी बेच दीजिए, ऐसा मैं नहीं कह सकता क्योंकि मेरे पास सलाहकार का लाइसेंस नहीं है।';
    expect(splitForSpeech(hi, { firstMax: 40 })[0]).toBe(hi);
    const en = 'Selling your Axis fund right now, with the market down, is not something I can tell you to do.';
    expect(splitForSpeech(en, { firstMax: 40 })[0]).toBe(en);
    const en2 = 'Your bill is large this month, and it is not covered by your balance until salary arrives.';
    expect(splitForSpeech(en2, { firstMax: 40 })[0]).toBe(en2); // a negation in the rest: no cut
  });
});
