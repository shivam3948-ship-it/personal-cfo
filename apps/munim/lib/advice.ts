// Advice modes and their disclaimers. Pure (no Node APIs) so screens and on-device code can use it; the MODE itself is
// always resolved on the server (lib/session.ts).
// Advice mode is resolved on the server only (D-021). demo = synthetic sample family; guided = invite-only real users, category level.
// private = advice switched on by the owner (MUNIM_ADVICE=on) for browsers holding the unlock key (D-066), before any licence.
export type AdviceMode = 'off' | 'guided' | 'internal' | 'demo' | 'advised' | 'private';
/** Naming a fund (to buy, move or switch) needs an investment adviser licence (D-051, Shivam 23 Oct): no mode names one
 *  until 'advised'. Munim suggests categories instead: a liquid fund, a well-rated multi-asset fund, a low-cost index fund. */
export const namesFunds = (m: AdviceMode) => m === 'advised' || m === 'private';
/** One disclaimer per mode, shown under every Ask answer and given once in the conversation (D-051 wording). */
const EDU = { en: 'For education only, not investment advice.', hi: 'सिर्फ़ जानकारी के लिए है, निवेश सलाह नहीं।' };
export const DISCLAIMER: Record<AdviceMode, { en: string; hi: string }> = {
  demo: { en: 'Test build on sample data. ' + EDU.en, hi: 'टेस्ट वर्ज़न, सैंपल डेटा पर। ' + EDU.hi },
  internal: { en: 'Test build. ' + EDU.en, hi: 'टेस्ट वर्ज़न। ' + EDU.hi },
  guided: EDU,
  advised: { en: 'Investment advice from a SEBI-registered adviser.', hi: 'SEBI-रजिस्टर्ड सलाहकार की निवेश सलाह।' },
  // honest while advice is on before a licence: it IS advice, from someone who isn't registered (D-066)
  private: { en: 'Private test. Munim is not a SEBI-registered investment adviser or an AMFI-registered mutual fund distributor; check with a registered adviser before you act.', hi: 'निजी टेस्ट। मुनीम न SEBI-रजिस्टर्ड निवेश सलाहकार है, न AMFI-रजिस्टर्ड म्यूचुअल फ़ंड डिस्ट्रीब्यूटर; कोई कदम उठाने से पहले किसी रजिस्टर्ड सलाहकार से पूछें।' },
  off: EDU,
};
/** What Munim says when someone pushes for a fund name. */
export const NO_LICENCE = { en: 'Munim doesn’t have an investment adviser licence yet, so it can’t name funds.', hi: 'मुनीम के पास अभी निवेश सलाहकार का लाइसेंस नहीं है, इसलिए वह फ़ंड का नाम नहीं बता सकता।' };
/** Said in place of a sell/switch/exit instruction the guard removed (D-066 review, B3). */
export const NO_TRADE = { en: 'Munim doesn’t have an investment adviser licence yet, so it can’t tell you to sell, switch or stop a fund or policy; a SEBI-registered adviser can.', hi: 'मुनीम के पास अभी निवेश सलाहकार का लाइसेंस नहीं है, इसलिए वह किसी फ़ंड या पॉलिसी को बेचने, बदलने या रोकने को नहीं कह सकता; SEBI-रजिस्टर्ड सलाहकार बता सकते हैं।' };
/** Outside advice mode, when the answer named a fund or insurance plan the user doesn't hold (review 2, N3: product-neutral). */
export const NO_PRODUCT = { en: 'Munim doesn’t have an investment adviser licence yet, so it doesn’t name specific funds or insurance plans; it tells you the type to look for.', hi: 'मुनीम के पास अभी निवेश सलाहकार का लाइसेंस नहीं है, इसलिए वह किसी ख़ास फ़ंड या बीमा प्लान का नाम नहीं बताता; वह बताता है कि किस तरह का प्लान देखें।' };
/** Advice mode, when the answer named a product that is neither held nor one of the owner's picks (D-066 review, #4). */
export const NO_PICK = { en: 'No specific pick is set up for this yet, so Munim gives the category only.', hi: 'इसके लिए अभी कोई ख़ास पसंद तय नहीं है, इसलिए मुनीम सिर्फ़ कैटेगरी बता रहा है।' };
