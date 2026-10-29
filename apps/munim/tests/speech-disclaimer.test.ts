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

describe('review fixes (29 Oct)', async () => {
  const { disclaimerLast } = await import('@core/agent/lang');
  const { DISCLAIMER } = await import('@/lib/advice');
  it('only the exact disclaimer lines move; the private-mode line stays whole', () => {
    const general = 'This is general info, not investment advice, but index funds are cheap. You hold three funds.';
    expect(disclaimerLast(general)).toBe(general);
    const priv = DISCLAIMER.private.en + ' Sell the small cap fund by 30 Nov.';
    expect(disclaimerLast(priv)).toBe(priv);
    for (const m of ['guided', 'demo', 'internal'] as const) for (const l of ['en', 'hi'] as const) {
      const said = disclaimerLast(DISCLAIMER[m][l] + ' ₹1,00,000.50 at 14.2% a year.');
      expect(said.startsWith('₹1,00,000.50 at 14.2% a year.'), `${m}/${l}`).toBe(true);
      expect(said.endsWith(DISCLAIMER[m][l]), `${m}/${l}`).toBe(true);
    }
  });
  it('a line break without a full stop is its own piece', () => {
    expect(disclaimerLast('Spent ₹5,874\nFor education only, not investment advice.\nMost went on travel.')).toBe('Spent ₹5,874 Most went on travel. For education only, not investment advice.');
  });
});

it('the line as the model words it also moves', async () => {
  const { disclaimerLast } = await import('@core/agent/lang');
  expect(disclaimerLast('(This is for education only, not investment advice.) Keep 6 months aside.')).toBe('Keep 6 months aside. (This is for education only, not investment advice.)');
  expect(disclaimerLast('यह सिर्फ़ जानकारी के लिए है, निवेश सलाह नहीं है। 6 महीने का खर्च अलग रखें।')).toBe('6 महीने का खर्च अलग रखें। यह सिर्फ़ जानकारी के लिए है, निवेश सलाह नहीं है।');
});
