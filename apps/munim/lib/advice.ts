// Advice modes and their disclaimers. Pure (no Node APIs) so screens and on-device code can use it; the MODE itself is
// always resolved on the server (lib/session.ts).
// Advice mode is resolved on the server only (D-021). demo = synthetic sample family; guided = invite-only real users, category level.
export type AdviceMode = 'off' | 'guided' | 'internal' | 'demo' | 'advised';
/** Modes allowed to name the user's own funds with an amount or a date (docs/12 ladder rung 3). */
export const namesFunds = (m: AdviceMode) => m === 'demo' || m === 'internal' || m === 'advised';
/** One disclaimer per mode, shown under every Ask answer and given once in the conversation. Test builds say so plainly. */
export const DISCLAIMER: Record<AdviceMode, { en: string; hi: string }> = {
  demo: { en: 'Test build on sample data. For testing only, not investment advice.', hi: 'टेस्ट वर्ज़न, सैंपल डेटा पर। सिर्फ़ टेस्टिंग के लिए, निवेश सलाह नहीं।' },
  internal: { en: 'Test build. For testing only, not investment advice.', hi: 'टेस्ट वर्ज़न। सिर्फ़ टेस्टिंग के लिए, निवेश सलाह नहीं।' },
  guided: { en: 'General guidance, not SEBI-registered investment advice.', hi: 'सामान्य जानकारी, SEBI-रजिस्टर्ड निवेश सलाह नहीं।' },
  advised: { en: 'Investment advice from a SEBI-registered adviser.', hi: 'SEBI-रजिस्टर्ड सलाहकार की निवेश सलाह।' },
  off: { en: 'Information only, not investment advice.', hi: 'सिर्फ़ जानकारी, निवेश सलाह नहीं।' },
};
