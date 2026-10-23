// Advice modes and their disclaimers. Pure (no Node APIs) so screens and on-device code can use it; the MODE itself is
// always resolved on the server (lib/session.ts).
// Advice mode is resolved on the server only (D-021). demo = synthetic sample family; guided = invite-only real users, category level.
export type AdviceMode = 'off' | 'guided' | 'internal' | 'demo' | 'advised';
/** Naming a fund (to buy, move or switch) needs an investment adviser licence (D-051, Shivam 23 Oct): no mode names one
 *  until 'advised'. Munim suggests categories instead: a liquid fund, a well-rated multi-asset fund, a low-cost index fund. */
export const namesFunds = (m: AdviceMode) => m === 'advised';
/** One disclaimer per mode, shown under every Ask answer and given once in the conversation (D-051 wording). */
const EDU = { en: 'For education only, not investment advice.', hi: 'सिर्फ़ जानकारी के लिए है, निवेश सलाह नहीं।' };
export const DISCLAIMER: Record<AdviceMode, { en: string; hi: string }> = {
  demo: { en: 'Test build on sample data. ' + EDU.en, hi: 'टेस्ट वर्ज़न, सैंपल डेटा पर। ' + EDU.hi },
  internal: { en: 'Test build. ' + EDU.en, hi: 'टेस्ट वर्ज़न। ' + EDU.hi },
  guided: EDU,
  advised: { en: 'Investment advice from a SEBI-registered adviser.', hi: 'SEBI-रजिस्टर्ड सलाहकार की निवेश सलाह।' },
  off: EDU,
};
/** What Munim says when someone pushes for a fund name. */
export const NO_LICENCE = { en: 'Munim doesn’t have an investment adviser licence yet, so it can’t name funds.', hi: 'मुनीम के पास अभी निवेश सलाहकार का लाइसेंस नहीं है, इसलिए वह फ़ंड का नाम नहीं बता सकता।' };
