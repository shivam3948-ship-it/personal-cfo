// Spoken answers say the education disclaimer last (29 Oct).
import { describe, expect, it } from 'vitest';

describe('disclaimer last when spoken (29 Oct)', async () => {
  const { disclaimerLast } = await import('@core/agent/lang');
  it('moves the education line to the end, keeps everything else in order', () => {
    expect(disclaimerLast('For education only, not investment advice. You spent ₹5,874 in August. Most went on travel.'))
      .toBe('You spent ₹5,874 in August. Most went on travel. For education only, not investment advice.');
    expect(disclaimerLast('सिर्फ़ जानकारी के लिए है, निवेश सलाह नहीं। अगस्त में ₹5,874 खर्च हुए।')).toBe('अगस्त में ₹5,874 खर्च हुए। सिर्फ़ जानकारी के लिए है, निवेश सलाह नहीं।');
    expect(disclaimerLast('Test build on sample data. For education only, not investment advice. Build an emergency fund first.'))
      .toBe('Build an emergency fund first. Test build on sample data. For education only, not investment advice.');
  });
  it('leaves the no-licence answer where it is, and text without a disclaimer untouched', () => {
    const refusal = 'Munim doesn’t have an investment adviser licence yet, so it can’t tell you to sell, switch or stop a fund or policy; a SEBI-registered adviser can. Your small cap fund is up 18%.';
    expect(disclaimerLast(refusal)).toBe(refusal);
    expect(disclaimerLast('You spent ₹5,874. Most went on travel.')).toBe('You spent ₹5,874. Most went on travel.');
    expect(disclaimerLast('For education only, not investment advice.')).toBe('For education only, not investment advice.');
  });
});
