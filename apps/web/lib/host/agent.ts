// Munim as an embedded voice layer inside a host savings app (fictional demo host).
// Contract: the HOST owns the data and executes actions; Munim answers from the state the host passes in and
// only PROPOSES actions. Nothing changes until the user confirms ("haan"), and the host applies it.
import { inr } from '../money';
import { parseAmountRupees } from '../agent/lang';
import { checkNumbers, type NumberCheck } from '../agent/guard';
import { spokenDate } from '../dates';

export type HostLang = 'hi' | 'en';
export type Screen = 'home' | 'save' | 'withdraw';
export interface HostState {
  savedPaise: number;        // total put in so far
  valuePaise: number;        // current value (saved + returns)
  dailyPaise: number;        // daily auto-save amount
  pausedUntil: string | null;
  streakDays: number;
  nextDebit: string;         // YYYY-MM-DD
  monthSavedPaise: number;
  asOf: string;              // YYYY-MM-DD
}
export type Proposal =
  | { type: 'set_daily'; amountPaise: number }
  | { type: 'pause'; days: number; until: string }
  | { type: 'resume' };
export interface HostReply { answer: string; lang: HostLang; proposal: Proposal | null; executed: Proposal | null; intent: string; check: NumberCheck }

// ⚠ Demo product rules (fictional host app); a real host passes its own.
export const RULES = { minDailyPaise: 1000, maxDailyPaise: 1000000, withdrawal: { days: 1, charge: 0 } };

const has = (t: string, re: RegExp) => re.test(t);
const YES = /^(?:\s*(?:haan|han|ha|haa|yes|yeah|ok|okay|sure|kar do|karo|theek hai|thik hai|ji|bilkul|हाँ|हां|जी|ठीक है|कर दो|करो|बिल्कुल)(?=[\s.!,।]|$)[\s.!,।]*)+$/i;
const NO = /^(?:\s*(?:nahi|nahin|na|no|cancel|mat karo|rehne do|नहीं|ना|मत करो|रहने दो)(?=[\s.!,।]|$)[\s.!,।]*)+$/i;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

export function detectHostLang(text: string, hint?: HostLang | 'auto'): HostLang {
  if (hint === 'hi' || hint === 'en') return hint;
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  return /\b(kitna|kitne|mera|meri|kya|kar do|karo|roz|bacha|paise|paisa|nikal|band|rok|haan|nahi|batao|hai)\b/i.test(text) ? 'hi' : 'en';
}

export function describeProposal(p: Proposal, s: HostState, lang: HostLang): string {
  const hi = lang === 'hi';
  if (p.type === 'set_daily') return hi ? `रोज़ की बचत ${inr(s.dailyPaise)} से ${inr(p.amountPaise)} कर दूँ?` : `Change your daily saving from ${inr(s.dailyPaise)} to ${inr(p.amountPaise)}?`;
  if (p.type === 'pause') return hi ? `${p.days} दिन के लिए बचत रोक दूँ? ${spokenDate(p.until, 'hi')} से फिर शुरू होगी, अब तक की बचत वैसी ही रहेगी।` : `Pause saving for ${p.days} days? It restarts on ${spokenDate(p.until, 'en')}; what you've saved stays as it is.`;
  return hi ? 'बचत फिर से शुरू कर दूँ?' : 'Restart your daily saving?';
}

/** Rule-based intent engine: fast, predictable, bilingual. Covers the host app's top tasks. */
export function hostRespond(text: string, s: HostState, screen: Screen, pending: Proposal | null, langHint: HostLang | 'auto' = 'auto'): HostReply {
  const lang = detectHostLang(text, langHint); const hi = lang === 'hi';
  const t = text.toLowerCase().trim();
  const facts: unknown[] = [inr(s.savedPaise), inr(s.valuePaise), inr(s.valuePaise - s.savedPaise), inr(s.dailyPaise), inr(s.monthSavedPaise), s.streakDays, RULES.withdrawal.days];
  const done = (answer: string, intent: string, proposal: Proposal | null = null, executed: Proposal | null = null, extra: unknown[] = []): HostReply =>
    ({ answer, lang, proposal, executed, intent, check: checkNumbers(answer, [...facts, ...extra]) });

  if (pending && YES.test(t)) {
    const msg = pending.type === 'set_daily' ? (hi ? `हो गया। रोज़ की बचत अब ${inr(pending.amountPaise)} है।` : `Done. Your daily saving is now ${inr(pending.amountPaise)}.`)
      : pending.type === 'pause' ? (hi ? `हो गया। बचत ${spokenDate(pending.until, 'hi')} तक रुकी है।` : `Done. Saving is paused until ${spokenDate(pending.until, 'en')}.`)
      : (hi ? 'हो गया। बचत फिर से शुरू।' : 'Done. Daily saving is back on.');
    return done(msg, 'confirm', null, pending, [pending.type === 'set_daily' ? inr(pending.amountPaise) : '']);
  }
  if (pending && NO.test(t)) return done(hi ? 'ठीक है, कुछ नहीं बदला।' : 'Okay, nothing changed.', 'cancel');

  // Actions (proposed, never executed here)
  const amt = parseAmountRupees(t.replace(/\b(\d+)\s*(?:rs|rupaye|rupees|रुपये|रुपए)\b/g, '$1 ')) ?? (() => { const m = t.match(/(?:₹\s?|rs\.?\s?)(\d{2,6})/); return m ? Number(m[1]) : null; })() ?? (() => { const m = t.match(/\b(\d{2,4})\b/); return m && has(t, /roz|daily|रोज़|रोज|har din|हर दिन|per day/) ? Number(m[1]) : null; })();
  if (amt && has(t, /roz|daily|रोज़|रोज|har din|हर दिन|per day|kar do|karo|कर दो|badal|बदल|change|set|kam|कम|zyada|ज़्यादा|बढ़ा|increase|reduce/)) {
    const p = Math.round(amt * 100);
    if (p < RULES.minDailyPaise || p > RULES.maxDailyPaise) return done(hi ? `रोज़ की बचत ${inr(RULES.minDailyPaise)} से ${inr(RULES.maxDailyPaise)} के बीच रख सकते हैं।` : `Daily saving can be between ${inr(RULES.minDailyPaise)} and ${inr(RULES.maxDailyPaise)}.`, 'set_daily_out_of_range', null, null, [inr(RULES.minDailyPaise), inr(RULES.maxDailyPaise)]);
    const prop: Proposal = { type: 'set_daily', amountPaise: p };
    return done(describeProposal(prop, s, lang) + (hi ? ' हाँ बोलिए।' : ' Say yes to confirm.'), 'set_daily', prop, null, [inr(p)]);
  }
  if (has(t, /pause|rok|ruk|band kar|बंद कर|रोक|रुक|skip|break|abhi nahi|paisa nahi hai|पैसे नहीं|tight/)) {
    const m = t.match(/(\d{1,2})\s*(din|दिन|day|days|hafte|हफ़्ते|week)/);
    const days = m ? (/(hafte|हफ़्ते|week)/.test(m[2]) ? Number(m[1]) * 7 : Number(m[1])) : 7;
    const prop: Proposal = { type: 'pause', days: Math.min(Math.max(days, 1), 90), until: addDays(s.asOf, Math.min(Math.max(days, 1), 90)) };
    return done(describeProposal(prop, s, lang) + (hi ? ' हाँ बोलिए।' : ' Say yes to confirm.'), 'pause', prop, null, [prop.days]);
  }
  if (s.pausedUntil && has(t, /resume|shuru|chalu|फिर से|शुरू|चालू|restart/)) {
    const prop: Proposal = { type: 'resume' };
    return done(describeProposal(prop, s, lang), 'resume', prop);
  }

  // Questions
  if (has(t, /nikal|withdraw|निकाल|kab milega|कब मिलेगा|wapas|वापस|redeem/) || (screen === 'withdraw' && has(t, /kitna|कितना|how much|time|samay|समय/)))
    return done(hi ? `आप पूरे ${inr(s.valuePaise)} कभी भी निकाल सकते हैं। पैसा ${RULES.withdrawal.days} कामकाजी दिन में बैंक खाते में आता है, और निकालने का कोई चार्ज नहीं है।` : `You can withdraw all ${inr(s.valuePaise)} any time. It reaches your bank in ${RULES.withdrawal.days} working day, with no charge.`, 'withdraw_info', null, null, [RULES.withdrawal.charge]);
  if (has(t, /return|byaj|ब्याज|interest|kamaya|कमाया|munafa|मुनाफ़ा|मुनाफा|kamai|कमाई|earn|badha|बढ़ा/))
    return done(hi ? `आपने कुल ${inr(s.savedPaise)} बचाए, जो अब ${inr(s.valuePaise)} के हैं। यानी ${inr(s.valuePaise - s.savedPaise)} की कमाई। यह बाज़ार के साथ थोड़ा ऊपर-नीचे हो सकता है।` : `You've put in ${inr(s.savedPaise)}; it's worth ${inr(s.valuePaise)} now, so ${inr(s.valuePaise - s.savedPaise)} earned. It can move up or down a little with the market.`, 'returns');
  if (has(t, /kab katega|कटेगा|कब कटेगा|next|agla|अगला|auto ?debit|debit|kitna katta|कितना कटता/))
    return done(s.pausedUntil ? (hi ? `बचत ${spokenDate(s.pausedUntil, 'hi')} तक रुकी है।` : `Saving is paused until ${spokenDate(s.pausedUntil, 'en')}.`) : (hi ? `अगली बचत ${spokenDate(s.nextDebit, 'hi')} को ${inr(s.dailyPaise)} कटेगी।` : `Next saving: ${inr(s.dailyPaise)} on ${spokenDate(s.nextDebit, 'en')}.`), 'next_debit');
  if (has(t, /safe|surakshit|सुरक्षित|dhokha|धोखा|bharosa|भरोसा|sebi|regulated|kahan jata|कहाँ जाता|कहां जाता|where.*money/))
    return done(hi ? 'इस डेमो में आपकी बचत आपके नाम की म्यूचुअल फंड यूनिट्स में जाती है, जो फंड हाउस के पास दर्ज रहती हैं, ऐप के पास नहीं। असली ऐप में यह जानकारी उसी ऐप की शर्तों से आएगी।' : 'In this demo, your savings buy mutual fund units in your own name, recorded with the fund house, not held by the app. In a real app this answer comes from that app’s own terms.', 'trust');
  if (has(t, /kitna|कितना|कितने|balance|bacha|बचा|saved|jama|जमा|total|kul|कुल|how much|how am i|kaisa chal|कैसा चल/))
    return done(hi ? `आपने अब तक ${inr(s.savedPaise)} बचाए हैं, जिनकी कीमत अब ${inr(s.valuePaise)} है। इस महीने ${inr(s.monthSavedPaise)} जमा हुए, और ${s.streakDays} दिन से लगातार बचत चल रही है।` : `You've saved ${inr(s.savedPaise)} so far, now worth ${inr(s.valuePaise)}. This month you added ${inr(s.monthSavedPaise)}, and you're on a ${s.streakDays}-day streak.`, 'status');

  return done(hi ? 'मैं आपकी बचत के बारे में बता सकता हूँ और उसे बदल भी सकता हूँ। पूछिए: "कितना बचा?", "रोज़ 30 रुपये कर दो", या "पैसे कब मिलेंगे?"' : 'I can tell you about your savings and change them. Try: "How much have I saved?", "Make it ₹30 a day", or "When will I get my money?"', 'help', null, null, [30]);
}
