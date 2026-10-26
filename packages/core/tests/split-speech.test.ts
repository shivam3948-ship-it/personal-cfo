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
