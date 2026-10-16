// Munim as an embedded voice layer inside a host savings app (fictional demo host).
// Contract: the HOST owns the data and executes actions; Munim answers from the state the host passes in and
// only PROPOSES actions. Nothing changes until the user confirms ("haan"), and the host applies it.
import { inr } from '../money';
import { parseAmountRupees } from '../agent/lang';
import { checkNumbers, type NumberCheck } from '../agent/guard';
import { spokenDate } from '../dates';

export type HostLang = 'hi' | 'en';
export type Screen = 'home' | 'save' | 'withdraw';
export interface Withdrawal { id: string; amountPaise: number; requestedOn: string; expectedBy: string; status: 'processing' | 'paid' | 'failed'; paidOn?: string; bankRef?: string }
export interface Debit { date: string; amountPaise: number; ref: string }
export interface HostState {
  savedPaise: number;        // total put in so far
  valuePaise: number;        // current value (saved + returns)
  dailyPaise: number;        // daily auto-save amount
  pausedUntil: string | null;
  streakDays: number;
  nextDebit: string;         // YYYY-MM-DD
  monthSavedPaise: number;
  asOf: string;              // YYYY-MM-DD
  withdrawals?: Withdrawal[]; // latest first; the host's own records
  debits?: Debit[];           // recent auto-debits from the bank, latest first
}
export type Proposal =
  | { type: 'set_daily'; amountPaise: number }
  | { type: 'pause'; days: number; until: string }
  | { type: 'resume' }
  // Research (docs/26): reviews punish bots that block a human at a money problem. Handoff is one step, with the case written up.
  | { type: 'handoff'; reason: HandoffReason; summary: string }
  | { type: 'refund_request'; date: string; extraPaise: number; refs: string[] };
export type HandoffReason = 'asked' | 'withdrawal_late' | 'not_understood' | 'extra_debit' | 'trust';
export interface HostCtx { misses?: number; lastIntent?: string }
export interface HostReply { answer: string; lang: HostLang; proposal: Proposal | null; executed: Proposal | null; intent: string; check: NumberCheck }

// ⚠ Demo product rules (fictional host app); a real host passes its own.
export const RULES = { minDailyPaise: 1000, maxDailyPaise: 1000000, withdrawal: { days: 1, charge: 0 }, humanCallbackHours: 2, refundReplyDays: 2 };

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
  if (p.type === 'handoff') return hi ? 'आपकी बात लिखकर टीम के किसी व्यक्ति से जोड़ दूँ?' : 'Shall I write this up and connect you to a person on the team?';
  if (p.type === 'refund_request') return hi ? `ज़्यादा कटे ${inr(p.extraPaise)} वापस भेजने की रिक्वेस्ट डाल दूँ?` : `Raise a request to send back the extra ${inr(p.extraPaise)}?`;
  return hi ? 'बचत फिर से शुरू कर दूँ?' : 'Restart your daily saving?';
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

/** The case note a person on the support team reads first, so the user never repeats themselves. */
export function caseSummary(s: HostState, reason: HandoffReason, said: string): string {
  const w = s.withdrawals?.[0];
  const bits = [`reason=${reason}`, `user_said="${said.slice(0, 120)}"`, `value=${inr(s.valuePaise)}`, `daily=${inr(s.dailyPaise)}`];
  if (w) bits.push(`last_withdrawal=${inr(w.amountPaise)} ${w.status} requested ${w.requestedOn} expected ${w.expectedBy}${w.bankRef ? ` ref ${w.bankRef}` : ''}`);
  return bits.join('; ');
}

/** Extra debits = more than one daily debit on a date, or a debit larger than the daily amount. */
export function extraDebits(s: HostState, days = 7): { date: string; extraPaise: number; refs: string[]; count: number }[] {
  const recent = (s.debits ?? []).filter((d) => daysBetween(d.date, s.asOf) < days && daysBetween(d.date, s.asOf) >= 0);
  const byDate = new Map<string, Debit[]>();
  for (const d of recent) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d]);
  const out: { date: string; extraPaise: number; refs: string[]; count: number }[] = [];
  for (const [date, ds] of byDate) {
    const total = ds.reduce((a, d) => a + d.amountPaise, 0);
    if (total > s.dailyPaise) out.push({ date, extraPaise: total - s.dailyPaise, refs: ds.map((d) => d.ref), count: ds.length });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Rule-based intent engine: fast, predictable, bilingual. Covers the host app's top tasks. */
export function hostRespond(text: string, s: HostState, screen: Screen, pending: Proposal | null, langHint: HostLang | 'auto' = 'auto', ctx: HostCtx = {}): HostReply {
  const lang = detectHostLang(text, langHint); const hi = lang === 'hi';
  const t = text.toLowerCase().trim();
  const facts: unknown[] = [inr(s.savedPaise), inr(s.valuePaise), inr(s.valuePaise - s.savedPaise), inr(s.dailyPaise), inr(s.monthSavedPaise), s.streakDays, RULES.withdrawal.days];
  const done = (answer: string, intent: string, proposal: Proposal | null = null, executed: Proposal | null = null, extra: unknown[] = []): HostReply =>
    ({ answer, lang, proposal, executed, intent, check: checkNumbers(answer, [...facts, ...extra]) });

  const handedOff = (reason: HandoffReason): string => hi
    ? `ठीक है, मैंने आपकी पूरी बात लिखकर टीम को भेज दी है। टीम का कोई व्यक्ति ${RULES.humanCallbackHours} घंटे के अंदर इसी नंबर पर कॉल करेगा, आपको कुछ दोबारा बताना नहीं पड़ेगा।${reason === 'withdrawal_late' ? ' आपकी निकासी का मामला सबसे ऊपर रखा है।' : ''}`
    : `Okay, I've written up your issue and sent it to the team. A person will call you on this number within ${RULES.humanCallbackHours} hours; you won't have to repeat anything.${reason === 'withdrawal_late' ? ' Your withdrawal is marked as priority.' : ''}`;

  if (pending && YES.test(t)) {
    const msg = pending.type === 'set_daily' ? (hi ? `हो गया। रोज़ की बचत अब ${inr(pending.amountPaise)} है।` : `Done. Your daily saving is now ${inr(pending.amountPaise)}.`)
      : pending.type === 'pause' ? (hi ? `हो गया। बचत ${spokenDate(pending.until, 'hi')} तक रुकी है।` : `Done. Saving is paused until ${spokenDate(pending.until, 'en')}.`)
      : pending.type === 'handoff' ? handedOff(pending.reason)
      : pending.type === 'refund_request' ? (hi ? `रिक्वेस्ट डाल दी। ${inr(pending.extraPaise)} के बारे में टीम ${RULES.refundReplyDays} कामकाजी दिन में जवाब देगी, और मैं आपको बता दूँगा।` : `Request raised. The team will reply about ${inr(pending.extraPaise)} within ${RULES.refundReplyDays} working days, and I'll let you know.`)
      : (hi ? 'हो गया। बचत फिर से शुरू।' : 'Done. Daily saving is back on.');
    return done(msg, 'confirm', null, pending, [pending.type === 'set_daily' ? inr(pending.amountPaise) : pending.type === 'refund_request' ? inr(pending.extraPaise) : '', RULES.humanCallbackHours, RULES.refundReplyDays]);
  }
  if (pending && NO.test(t)) return done(hi ? 'ठीक है, कुछ नहीं बदला।' : 'Okay, nothing changed.', 'cancel');

  // 1) A person, in one step. Asking for a human is never answered with more bot.
  if (has(t, /insaan|insan|इंसान|human|real person|a person|person se|talk to someone|someone (?:to talk|from your team)|\bvyakti|व्यक्ति|\bagent\b|customer care|customer support|support se|kisi se baat|किसी से बात|baat karao|baat karwao|बात कराओ|बात करा|बात करवा|complaint|शिकायत|shikayat/)) {
    const prop: Proposal = { type: 'handoff', reason: 'asked', summary: caseSummary(s, 'asked', text) };
    return done(handedOff('asked'), 'handoff', null, prop, [RULES.humanCallbackHours]);
  }

  // 2) "Where is my money?" for a withdrawal already made: answer from the host's own record, with the date and the bank reference.
  const w = s.withdrawals?.[0];
  const recentW = w && (w.status === 'processing' || daysBetween(w.requestedOn, s.asOf) <= 7) ? w : undefined;
  const askedStatus = has(t, /nahi aa?ya|nhi aa?ya|ni aa?ya|nahi mila|nhi mila|नहीं आया|नहीं मिला|not (?:yet )?(?:received|credited|come|came|arrived|got)|(?:hasn|haven|has not|have not)\W?t? (?:arrived|come|reached|been credited|received)|didn.?t (?:get|receive|come)|kab (?:aa?ye?ga|aaega|milega|aayenge|milenge)|कब (?:आएगा|मिलेगा|आएँगे|मिलेंगे)|kahan|kahaan|कहाँ|कहां|where is|status|pending|stuck|atka|अटका|abhi tak|अभी तक|still/)
    && has(t, /nikal|nikl|withdr|निकाल|निकल|paisa|paise|pese|पैसा|पैसे|money|amount|refund|रकम/);
  if (askedStatus && recentW) {
    const r = recentW; const late = r.status === 'processing' && daysBetween(r.expectedBy, s.asOf) > 0;
    const facts = [inr(r.amountPaise), r.bankRef ?? '', daysBetween(r.expectedBy, s.asOf)];
    if (r.status === 'paid') return done(hi
      ? `आपके ${inr(r.amountPaise)} ${spokenDate(r.paidOn ?? r.expectedBy, 'hi')} को आपके बैंक खाते में भेज दिए गए। बैंक का रेफ़रेंस नंबर ${r.bankRef} है। बैंक में दिखने में कुछ घंटे लग सकते हैं; अपने बैंक के SMS या पासबुक में यही नंबर देखिए। फिर भी न दिखे तो बोलिए “इंसान से बात कराओ”।`
      : `Your ${inr(r.amountPaise)} was sent to your bank on ${spokenDate(r.paidOn ?? r.expectedBy, 'en')}. The bank reference is ${r.bankRef}. Banks can take a few hours to show it; look for this number in your bank SMS or passbook. If it still isn't there, say “connect me to a person”.`, 'withdrawal_status', null, null, facts);
    if (r.status === 'failed') return done(hi
      ? `${inr(r.amountPaise)} निकालने की रिक्वेस्ट पूरी नहीं हो पाई, इसलिए पैसा आपकी बचत में ही है, कुछ नहीं कटा। दोबारा निकालें, या बोलिए “इंसान से बात कराओ”।`
      : `The request to withdraw ${inr(r.amountPaise)} didn't go through, so the money is still in your savings; nothing was deducted. Try again, or say “connect me to a person”.`, 'withdrawal_status', null, null, facts);
    if (late) {
      const prop: Proposal = { type: 'handoff', reason: 'withdrawal_late', summary: caseSummary(s, 'withdrawal_late', text) };
      return done(hi
        ? `माफ़ कीजिए, आपके ${inr(r.amountPaise)} ${spokenDate(r.expectedBy, 'hi')} तक आ जाने चाहिए थे, ${daysBetween(r.expectedBy, s.asOf)} दिन की देरी है। रिक्वेस्ट हमारे रिकॉर्ड में दर्ज है। अभी किसी व्यक्ति से जोड़ दूँ? मैंने पूरी बात लिख ली है।`
        : `Sorry, your ${inr(r.amountPaise)} should have arrived by ${spokenDate(r.expectedBy, 'en')}; it's ${daysBetween(r.expectedBy, s.asOf)} day(s) late. Your request is on record. Shall I connect you to a person now? I've written up the details.`, 'withdrawal_late', prop, null, facts);
    }
    return done(hi
      ? `आपकी ${inr(r.amountPaise)} निकालने की रिक्वेस्ट ${spokenDate(r.requestedOn, 'hi')} को मिली थी और अभी प्रोसेस हो रही है। पैसा ${spokenDate(r.expectedBy, 'hi')} तक आपके बैंक खाते में आ जाएगा। अगर तब तक न आए, तो बोलिए “इंसान से बात कराओ”, मैं सीधे जोड़ दूँगा।`
      : `We got your request to withdraw ${inr(r.amountPaise)} on ${spokenDate(r.requestedOn, 'en')}; it's being processed and will reach your bank by ${spokenDate(r.expectedBy, 'en')}. If it hasn't by then, say “connect me to a person” and I'll put you straight through.`, 'withdrawal_status', null, null, facts);
  }

  // 3) "Extra money was cut": check the host's debit list, not a script.
  if (has(t, /(?:do|2|teen|3) (?:baar|bar)|दो बार|तीन बार|twice|double|extra|zyada kat|jyada kat|ज़्यादा कट|ज्यादा कट|deducted (?:twice|extra|more)|kitna kata|kitne kate|कितना कटा|कितने कटे|galat kat|गलत कट|bina bataye|बिना बताए|without (?:asking|telling|consent)/) && has(t, /kat|kaat|कट|काट|deduct|debit|cut|charge/)) {
    const extra = extraDebits(s);
    const recent = (s.debits ?? []).filter((d) => daysBetween(d.date, s.asOf) < 7 && daysBetween(d.date, s.asOf) >= 0);
    const total = recent.reduce((a, d) => a + d.amountPaise, 0);
    if (extra.length) {
      const e = extra[0];
      const prop: Proposal = { type: 'refund_request', date: e.date, extraPaise: e.extraPaise, refs: e.refs };
      return done(hi
        ? `आप सही हैं। ${spokenDate(e.date, 'hi')} को ${e.count} बार पैसे कटे, जबकि रोज़ की बचत ${inr(s.dailyPaise)} एक ही बार कटनी चाहिए। ${inr(e.extraPaise)} ज़्यादा कटे। इन्हें वापस भेजने की रिक्वेस्ट डाल दूँ? हाँ बोलिए।`
        : `You're right. On ${spokenDate(e.date, 'en')} money was taken ${e.count} times, but your daily saving of ${inr(s.dailyPaise)} should be taken once. That's ${inr(e.extraPaise)} extra. Shall I raise a request to send it back? Say yes to confirm.`, 'extra_debit', prop, null, [inr(e.extraPaise), e.count]);
    }
    return done(hi
      ? `पिछले 7 दिन में ${recent.length} बार ${inr(s.dailyPaise)} कटे, कुल ${inr(total)}। हर दिन एक ही बार कटा है, कोई ज़्यादा कटौती नहीं दिखी। अगर बैंक में कुछ और दिखा है, तो बोलिए “इंसान से बात कराओ”।`
      : `In the last 7 days ${inr(s.dailyPaise)} was taken ${recent.length} times, ${inr(total)} in all, once a day. I don't see any extra debit. If your bank shows something else, say “connect me to a person”.`, 'debit_check', null, null, [inr(total), recent.length]);
  }

  // 4) "Why is it less?": show the arithmetic, including charges, instead of reassurance.
  if (has(t, /kam kyu|kam kyon|kam kyun|kam kaise|kam dikh|kam ho gaya|कम क्यों|कम क्यूँ|कम कैसे|कम दिख|कम हो गया|less than|lower than|why.*(?:less|lower|down|drop)|\bloss\b|ghata|घाटा|nuksan|नुकसान|hidden charge|charges? (?:kitna|kya)|कितना चार्ज|kitna charge/)) {
    const diff = s.valuePaise - s.savedPaise;
    return done(hi
      ? `हिसाब यह है: आपने ${inr(s.savedPaise)} जमा किए, ${diff >= 0 ? `बाज़ार से ${inr(diff)} बढ़े` : `बाज़ार से ${inr(-diff)} घटे`}, और चार्ज ${inr(RULES.withdrawal.charge)}। इसलिए अभी कीमत ${inr(s.valuePaise)} है। इस डेमो में निकालने पर कोई कटौती नहीं होती।`
      : `Here's the math: you put in ${inr(s.savedPaise)}, the market moved it ${diff >= 0 ? `up ${inr(diff)}` : `down ${inr(-diff)}`}, and charges are ${inr(RULES.withdrawal.charge)}. So it's worth ${inr(s.valuePaise)} now. In this demo nothing is deducted when you withdraw.`, 'value_breakdown', null, null, [inr(RULES.withdrawal.charge), inr(Math.abs(diff))]);
  }

  // Actions (proposed, never executed here)
  const amt = parseAmountRupees(t.replace(/\b(\d+)\s*(?:rs|rupaye|rupees|रुपये|रुपए)\b/g, '$1 ')) ?? (() => { const m = t.match(/(?:₹\s?|rs\.?\s?)(\d{2,6})/); return m ? Number(m[1]) : null; })() ?? (() => { const m = t.match(/\b(\d{2,4})\b/); return m && has(t, /roz|daily|रोज़|रोज|har din|हर दिन|per day/) ? Number(m[1]) : null; })();
  if (amt && has(t, /roz|daily|रोज़|रोज|har din|हर दिन|per day|a day|every day|make it|kar do|karo|कर दो|badal|बदल|change|set|kam|कम|zyada|ज़्यादा|बढ़ा|increase|reduce/)) {
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
  if (has(t, /nikal|withdraw|निकाल|kab milega|kab milenge|kab aayenge|कब मिलेगा|कब मिलेंगे|कब आएंगे|कब आएँगे|wapas|वापस|redeem|charge|चार्ज|\bfees?\b|फीस/) || (screen === 'withdraw' && has(t, /kitna|कितना|how much|time|samay|समय/)))
    return done(hi ? `आप पूरे ${inr(s.valuePaise)} कभी भी निकाल सकते हैं। पैसा ${RULES.withdrawal.days} कामकाजी दिन में बैंक खाते में आता है, और निकालने का कोई चार्ज नहीं है।` : `You can withdraw all ${inr(s.valuePaise)} any time. It reaches your bank in ${RULES.withdrawal.days} working day, with no charge.`, 'withdraw_info', null, null, [RULES.withdrawal.charge]);
  if (has(t, /return|byaj|ब्याज|interest|kamaya|कमाया|munafa|मुनाफ़ा|मुनाफा|kamai|कमाई|earn|badha|बढ़ा/))
    return done(hi ? `आपने कुल ${inr(s.savedPaise)} बचाए, जो अब ${inr(s.valuePaise)} के हैं। यानी ${inr(s.valuePaise - s.savedPaise)} की कमाई। यह बाज़ार के साथ थोड़ा ऊपर-नीचे हो सकता है।` : `You've put in ${inr(s.savedPaise)}; it's worth ${inr(s.valuePaise)} now, so ${inr(s.valuePaise - s.savedPaise)} earned. It can move up or down a little with the market.`, 'returns');
  if (has(t, /kab katega|kab kategi|कटेगा|कटेगी|कब कटेगा|कब कटेगी|next|agla|अगला|auto ?debit|debit|kitna katta|कितना कटता/))
    return done(s.pausedUntil ? (hi ? `बचत ${spokenDate(s.pausedUntil, 'hi')} तक रुकी है।` : `Saving is paused until ${spokenDate(s.pausedUntil, 'en')}.`) : (hi ? `अगली बचत ${spokenDate(s.nextDebit, 'hi')} को ${inr(s.dailyPaise)} कटेगी।` : `Next saving: ${inr(s.dailyPaise)} on ${spokenDate(s.nextDebit, 'en')}.`), 'next_debit');
  if (has(t, /safe|surakshit|सुरक्षित|dhokha|धोखा|bharosa|भरोसा|sebi|regulated|kahan jata|कहाँ जाता|कहां जाता|where.*money|fraud|froad|scam|fake|फ्रॉड|फ्रोड|ठग/))
    return done(hi ? 'इस डेमो में आपकी बचत आपके नाम की म्यूचुअल फंड यूनिट्स में जाती है, जो फंड हाउस के पास दर्ज रहती हैं, ऐप के पास नहीं। असली ऐप में यह जानकारी उसी ऐप की शर्तों से आएगी।' : 'In this demo, your savings buy mutual fund units in your own name, recorded with the fund house, not held by the app. In a real app this answer comes from that app’s own terms.', 'trust');
  if (has(t, /kitna|कितना|कितने|balance|bacha|बचा|saved|jama|जमा|total|kul|कुल|how much|how am i|kaisa chal|कैसा चल/))
    return done(hi ? `आपने अब तक ${inr(s.savedPaise)} बचाए हैं, जिनकी कीमत अब ${inr(s.valuePaise)} है। इस महीने ${inr(s.monthSavedPaise)} जमा हुए, और ${s.streakDays} दिन से लगातार बचत चल रही है।` : `You've saved ${inr(s.savedPaise)} so far, now worth ${inr(s.valuePaise)}. This month you added ${inr(s.monthSavedPaise)}, and you're on a ${s.streakDays}-day streak.`, 'status');

  if ((ctx.misses ?? 0) >= 1) {
    const prop: Proposal = { type: 'handoff', reason: 'not_understood', summary: caseSummary(s, 'not_understood', text) };
    return done(hi ? 'माफ़ कीजिए, मैं यह ठीक से नहीं समझ पाया। आपकी बात लिखकर टीम के किसी व्यक्ति से जोड़ दूँ?' : "Sorry, I didn't get that again. Shall I write it up and connect you to a person on the team?", 'offer_handoff', prop);
  }
  return done(hi ? 'मैं आपकी बचत के बारे में बता सकता हूँ और उसे बदल भी सकता हूँ। पूछिए: "कितना बचा?", "रोज़ 30 रुपये कर दो", या "पैसे कब मिलेंगे?"' : 'I can tell you about your savings and change them. Try: "How much have I saved?", "Make it ₹30 a day", or "When will I get my money?"', 'help', null, null, [30]);
}
