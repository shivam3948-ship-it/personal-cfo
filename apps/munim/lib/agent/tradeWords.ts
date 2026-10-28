// Does this text tell someone to sell, switch, exit, redeem, stop or top up an investment or policy they hold? English, Hindi
// and Hinglish (D-051, D-065, D-066). Used by the answer guard (lib/agent/claude.ts, lib/agent/funds.ts) and the eval
// checker (evals/score.ts). The eval can't catch what this misses, so tests/advice-guard.test.ts holds an independent list
// of real instructions and real money-path advice that must pass through, collected from three reviews (28 Oct).
//
// It looks at what each verb acts on, not just whether a fund word is nearby: "Move ₹40,000 from savings into a liquid fund"
// moves money FROM savings (new money by category, allowed); "Move ₹20,000 out of your small cap fund" is an exit. A clause
// break (", and, then, aur, और, फिर, but") ends a verb's reach ("Cancel Netflix and start a SIP" is about Netflix), except a
// short aside (", honestly,") and a verb pair ("Redeem and reinvest your fund"). A word-pattern check can't be complete:
// it is the backstop behind the prompt, not the whole defence.

// Between a verb and what it acts on: anything but a sentence or clause end. A full stop only inside a number (₹1.5 lakh) or
// after "Rs"; a comma only inside a number (₹1,50,000).
// a purpose clause ("to fund your SIP", "to build the buffer") also ends it: what follows is the goal, not the object
const W = String.raw`(?:(?!\s(?:and|then|but|aur|phir|or else)\s|\s(?:और|फिर|लेकिन)\s|\sto\s(?:fund|build|pay|clear|start|cover|save|invest|buy|put|boost|grow|top)\b)(?:[^.;!?।\n,]|\.(?=\d)|,(?=\d)|(?<=\b(?:Rs|rs|RS|Re|re))\.))`;
// What an exit acts on: a fund, scheme, policy or SIP; units, holdings, equity; a fund category. Not a savings pot ("emergency
// fund"), and not "fund" used as a verb ("sell the bike to fund the card payoff").
const POT = String.raw`(?<!\b(?:emergency|safety|rainy[- ]day|sinking|contingency|buffer|wedding|travel|goal)\s)`;
const CATS = String.raw`(?:small|mid|large|flexi|multi|large\s*&\s*mid)[- ]?caps?|ELSS|index(?:\s+funds?)?|bluechip|nifty|sensex|liquid\s+funds?|debt\s+funds?|hybrid\s+funds?|gold\s+funds?|equity(?:\s+funds?)?|equities|ULIPs?|endowment|NPS`;
const TARGET_BASE = String.raw`${POT}(?<!\bto\s)\b(?:funds?|schemes?|polic(?:y|ies)|SIPs?|units|holdings?|investments?|mutual\s+funds?|MFs?|portfolio|stocks?|shares|${CATS})\b`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const EXIT_VERB = String.raw`(?:sell(?:ing|s)?|redeem(?:ing|s)?|exit(?:ing|s)?(?!\s+load)|switch(?:ing|es)?(?:\s+(?:out\s+of|from))?|surrender(?:ing|s)?(?!\s+(?:value|and\s+paid|charges?|penalty))|withdraw(?:ing)?|get(?:ting)?\s+(?:out\s+of|rid\s+of)|let(?:ting)?\s+go\s+of|offload(?:ing)?|pull(?:ing)?\s+(?:\S+\s+){0,3}out\s+of|cash(?:ing)?\s+out|close\s+out|wind\s+down|liquidat(?:e|ing)|dump(?:ing)?|trim(?:ming)?|reduc(?:e|ing)\s+(?:your\s+)?(?:exposure|allocation|holding)s?\s+(?:to|in)|stop(?:ping)?\s+investing\s+in|discontinu(?:e|ing))`;
// move/shift/transfer/take/withdraw is an exit only when what follows "out of / from" IS a holding
const MOVE = String.raw`\b(?:move|moving|shift|shifting|transfer|transferring|put|take|taking|withdraw|withdrawing)\b${W}{0,40}?\b(?:out\s+of|from)\s+(?:(?:your|the|my|this|that|all|of|these|those)\s+){0,3}`;
// the holding as the object: "Shift your small cap fund to large cap", "Replace X with an index fund", "Move the ₹50,000 in
// your small cap fund to a liquid fund", "Reduce your small cap fund to ₹20,000"
const OBJ = String.raw`\b(?:move|shift|transfer|switch|swap|replace|put|reduce|cut|lower)\s+(?:(?:your|the|my|this|that|all|of)\s+){0,2}(?:₹?[\d,.]+\s*(?:lakh|crore|k)?\s+(?:in\s+(?:your|the|my)\s+)?)?(?:(?!(?:to|into|in|a|an|by|for|with|from|of|towards?|across|through)\b)[\w&-]+\s+){0,3}?`; // the holding is the verb's OWN object: "Put the bonus into a liquid fund for…" moves the bonus, not the fund (review 4)
const OBJ_END = String.raw`(?:\s+(?:money|units|investment|holdings?))?\s+(?:to|into|for|with|in|by)\b`;
// part of a holding moved somewhere else (review 5): "Move ₹50,000 of Monsoon Small Cap to a liquid fund", "Shift half of your
// small cap fund to large cap", "Move your money in the ELSS to a liquid fund". The source must be the user's ("your/the/my"
// or a held name) and a destination must follow, so "Put the bonus in index funds for retirement" stays new money.
const PART = String.raw`\b(?:move|moving|shift|shifting|transfer|transferring|switch|swap|replace|put|reduce|cut|lower)\s+(?:(?!(?:to|into|towards?)\b)[\w₹,.&-]+\s+){0,5}?(?:of|in|from)\s+`;
const PART_END = String.raw`(?:\s+(?:fund|money|units))?\s+(?:to|into|with|for\s+an?)\b`;
// stop/pause/close/cut a SIP or premiums: the SIP must be the verb's own object, a few words away, no verb in between
// ("Stop checking your portfolio", "Pause before you change your SIP" are not SIP calls)
const STOP = String.raw`\b(?:stop(?:ping)?|paus(?:e|ing)|cancel(?:ling|ing)?|halt|discontinu(?:e|ing)|close|end|cut|lower|reduce)\s+(?:(?:your|the|my|this|that|all|these|those|regular[- ]plan|monthly|paying)\s+){0,3}(?:(?![\w-]+ing\b)(?!before\b|after\b|about\b)[\w&-]+\s+){0,4}?`;
// topping up a fund the user holds (base form only; "You've been investing in X since 2021" is a fact)
const BUY_HELD = String.raw`(?<!\b(?:been|started|start|have|has|had|you've|was|were|by|from|after|before|since|keep|kept|continue)\s)\b(?:buy|invest\s+(?:more\s+)?in|add\s+(?:more\s+)?to|top\s+up|increase\s+(?:your\s+)?(?:SIP|investment)\s+in)\b${W}{0,40}?`;
// booking gains is the sell call itself (docs/03 §3); "you can book" and "if you book" are facts
const BOOK = /\b(?<!(?:can|could|may|allowed to|up to|limit to)\s(?:\w+\s)?)(?:book(?:ing)?|harvest(?:ing)?|realis(?:e|ing)|realiz(?:e|ing))\s+(?:₹?[\d,.]+\s*(?:lakh|crore|k)?\s+)?(?:of\s+)?(?:(?:your|the|long[- ]term|short[- ]term|capital|tax[- ]free)\s+){0,3}(?:gains?|profits?)\b/i;
// object first: "That small cap fund? Sell it.", "The small cap fund should be sold", "make it paid-up"
const PRONOUN_CALL = /\b(?:sell|redeem|exit|switch|dump|offload|surrender|ditch)\s+(?:it|them|this|that|those|these)\b|\b(?:should|must|needs?\s+to|ought\s+to|has\s+to|have\s+to)\s+be\s+(?:sold|redeemed|exited|switched|surrendered|stopped|closed|liquidated)\b|\bmake\s+(?:it|the\s+policy|your\s+policy)\s+paid[- ]up\b/i;

// a refusal to ADVISE governs the trade word ("can't tell you to sell", "cannot recommend whether to redeem"); so does a
// negation ("don't stop your SIP"), a condition ("if you sell…", "when you sell…") or "no need to"
const REFUSING = /\b(?:can[’']?t|cannot|won[’']?t|will not|(?:am )?not able to|unable to)\s+(?:tell|advise|recommend|suggest|say|ask)\s+(?:you\s+)?(?:to|whether|which|if)\b(?:(?!\bbut\b|\bhowever\b)(?:[^.!?;:,—–\n-]|,(?=\s+(?:or\s+)?(?:sell|switch|exit|redeem|stop|buy|surrender|move|pause)\b)|(?<=\b(?:sell|switch|exit|redeem|stop|buy|surrender|move|pause)),(?=\s*$))){0,60}$|\b(?:don[’']?t|do not|doesn[’']?t|does not)\s+(?:need|have)\s+to\s+$|\bno need to\s+$|\b(?:never|not|don[’']?t|do not|doesn[’']?t)\s+(?:to\s+|ever\s+|just\s+)?$|^\s*(?:if|when|once|whenever|before|after|unless)\s+(?:you\s+|they\s+|one\s+)?(?:ever\s+)?$/i; // a condition only when it opens the sentence: "You can't go wrong if you sell this fund" is still a call
const refused = (a: string, at: number | undefined) => { const from = Math.max(0, (at ?? 0) - 90); return REFUSING.test((from ? '\u0001' : '') + a.slice(from, at)); }; // cut mid-sentence: "^" can't match // a verb list ("sell, switch or stop") stays refused
// a sentence about what an action does, with the action as its subject: "Switching … counts as a sale", "Surrendering … returns little"
const GERUND_FACT = /^\s*(?:Selling|Switching|Surrendering|Redeeming|Exiting|Stopping|Booking|Withdrawing)\b(?![^.!?]*\b(?:best|better|should|recommend|right move|good idea|wise)\b)[^.!?]*\b(?:counts|is|are|returns|means|costs|attracts|triggers|will|would|can|may|usually|often|gives)\b/i;

// Hindi and Hinglish (the primary user, D-054): commands, in the same clause as a fund, SIP, policy, category or held fund.
// Word order is usually object first ("small cap fund sell kar do"), so these are matched by clause, not by reach.
const HI_SELL = new RegExp([
  String.raw`बेच\s*(?:दो|दें|दीजिए|दीजिये|डालो|डालें|देना\s*(?:चाहिए|बेहतर)|देनी\s*चाहिए|दें\s*तो)|बेचिए|बेचिये|बेचो|बेचें|बेचकर|बेचना\s*(?:चाहिए|बेहतर)|बेचनी\s*चाहिए`,
  String.raw`(?:रिडीम|सरेंडर|स्विच|एग्ज़िट|एग्जिट|बंद)\s*(?:कर(?:ो|ें|िए|िये)|कर\s*(?:दो|दें|लो|लें|दीजिए|देना\s*चाहिए|देनी\s*चाहिए|लेना\s*चाहिए)|करना\s*चाहिए|करनी\s*चाहिए)`,
  String.raw`निकल\s*(?:जाइए|जाइये|जाओ|जाएं|जाएँ|लीजिए|लो|आइए|आओ)|बाहर\s*निकलिए|बाहर\s*निकल(?:ें|िये)|निकाल\s*(?:लीजिए|लीजिये|लो|लें|दीजिए)|छोड़\s*(?:दो|दें|दीजिए|दीजिये|देना\s*चाहिए)`,
  String.raw`(?:बंद|रोक)\s*(?:कर\s*)?(?:दो|दें|दीजिए|दीजिये|करें|करो|करिए|कीजिए|देना\s*चाहिए)|रोकनी\s*चाहिए|रोकना\s*चाहिए`,
  String.raw`\b(?:bech\s*(?:do|dijiye|dein|daalo|dena\s*chahiye|deni\s*chahiye|ke|kar)|bechiye|becho|bechna\s*chahiye|nikaa?l\s*(?:lo|do|jao|jaiye|jaayein|lijiye)|chho?d\s*(?:do|dijiye|dein|dena\s*chahiye)|(?:sell|redeem|surrender|switch|exit|stop|band|rok|close)\s*(?:kar(?:o|ein|en|iye)|kar\s*(?:do|lo|dijiye|dein|lein|dena\s*chahiye|lena\s*chahiye|deni\s*chahiye)|karna\s*chahiye|karni\s*chahiye))\b`,
].join('|'), 'i');
const HI_TARGET = String.raw`(?<![ऀ-ॿ])(?:फ़ंड|फंड|पॉलिसी|स्कीम|एसआईपी|यूनिट|स्मॉल\s*कैप|मिड\s*कैप|लार्ज\s*कैप|फ्लेक्सी\s*कैप|फ़्लेक्सी\s*कैप|इंडेक्स|निवेश|एंडोमेंट)|\b(?:funds?|polic(?:y|ies)|schemes?|SIPs?|units|${CATS})\b`;
const HI_POT = /(?:इमरजेंसी|आपात(?:कालीन)?|सेफ्टी)\s*(?:फ़ंड|फंड)|\b(?:emergency|safety|rainy[- ]day)\s+fund\b/gi;
// the refusal itself, a negation ("मत", "mat", "nahi") or a condition ("अगर", "agar", "जब आप")
const HI_REFUSAL = /नहीं बता सकत|सलाह नहीं|नहीं कह सकत|लाइसेंस नहीं|(?:^|\s)मत\s|nahi?n? bata sakt|salah nahi|license nahi|\bmat\b|\bnahi?n?\b|अगर|\bagar\b|जब आप|\bjab\b/i;

/** Sentences, without breaking on "Rs.", "No.", "e.g." or a decimal point (₹1.5). */
export const sentences = (a: string) =>
  a.split(/(?<=[।!?\n])\s*|(?<!\b(?:Rs|rs|RS|Re|re|No|no|vs|e\.g|i\.e|approx|Mr|Ms|Dr|St)\.)(?<=\.)\s+/).filter((s) => s.trim());
const clauses = (s: string) => s.split(/,(?!\d)\s*|\s+(?:and|then|but|aur|phir|par|lekin|magar)\s+|\s+(?:और|फिर|पर|लेकिन|मगर)\s+/i);
// an aside or a verb pair should not end a verb's reach (review 3: "You should sell, honestly, your fund"; "Redeem and reinvest")
const unwrap = (s: string) => s.replace(/,\s*(?:honestly|frankly|really|ideally|basically|actually|in my view|I think|I'd say|now|perhaps|maybe|please|if possible)\s*,/gi, ' ')
  .replace(/\b(sell|redeem|exit|switch|surrender|offload|dump)\s+(?:and|&)\s+(?=[a-z]+\s)/gi, '$1 ');

const cache = new Map<string, { exit: RegExp; move: RegExp; obj: RegExp; part: RegExp; putHeld: RegExp | null; hiSource: RegExp; stop: RegExp; buy: RegExp | null; target: RegExp; hiTarget: RegExp }>();
// Hindi and Hinglish moves: a holding as the source ("small cap ka paisa…", "…fund ko…") and a move verb in the clause
const HI_MOVE = /(?:daa?l)\s*(?:do|dijiye|dein|de)\b|डाल\s*(?:दो|दें|दीजिए|दीजिये|दे)|\b(?:shift|transfer|replace|switch)\s*kar\s*(?:do|dijiye|dein|lo)\b|(?:शिफ्ट|ट्रांसफर|रिप्लेस|स्विच)\s*कर\s*(?:दो|दें|दीजिए|दीजिये)/i;
function patterns(held: string[]) {
  const key = held.join('\u0001'); const hit = cache.get(key); if (hit) return hit;
  const names = [...new Set(held.filter((n) => n.length > 3))].sort((x, y) => y.length - x.length).map(esc);
  const HELD = names.length ? String.raw`(?<![\p{L}\p{N}])(?:${names.join('|')})(?![\p{L}\p{N}])` : '';
  const TARGET = HELD ? `(?:${HELD}|${TARGET_BASE})` : TARGET_BASE;
  const p = {
    exit: new RegExp(String.raw`\b${EXIT_VERB}\b${W}{0,60}?${TARGET}`, 'giu'),
    move: new RegExp(`${MOVE}${TARGET}`, 'giu'),
    obj: new RegExp(`${OBJ}${TARGET}${OBJ_END}`, 'giu'),
    part: new RegExp(`${PART}(?:${HELD ? `${HELD}|` : ''}(?:your|the|my|this|that)\\s+(?:[\\w&-]+\\s+){0,2}?${TARGET_BASE})${PART_END}`, 'giu'),
    putHeld: HELD ? new RegExp(String.raw`\bput\b${W}{0,40}?\b(?:in|into)\s+(?:the\s+)?${HELD}`, 'giu') : null,
    hiSource: new RegExp(`(?:${HELD ? `${HELD}|` : ''}${HI_TARGET})(?:\\s+wala\\s+fund)?\\s+(?:ka|ki|ke|ko|का|की|के|को)\\s`, 'iu'),
    stop: new RegExp(String.raw`${STOP}(?:\bSIPs?\b|\bpremiums?\b|${TARGET})`, 'giu'),
    buy: HELD ? new RegExp(`${BUY_HELD}${HELD}`, 'giu') : null,
    target: new RegExp(TARGET, 'iu'),
    hiTarget: new RegExp(HELD ? `(?:${HELD}|${HI_TARGET})` : HI_TARGET, 'iu'),
  };
  if (cache.size > 50) cache.clear(); cache.set(key, p); return p;
}
const anyUnrefused = (re: RegExp | null, s: string) => !!re && [...s.matchAll(re)].some((m) => !refused(s, m.index));

/** An instruction to sell, switch, exit, redeem, surrender, move out of, stop, book gains on, or (for a fund the user holds,
 *  `held` = its names) top up an investment or policy. Outside advice mode the answer guard removes these. */
function flags(a: string, held: string[]): { s: string; hit: boolean }[] {
  const p = patterns(held);
  const all = sentences(a);
  return all.map((raw, i) => ({ s: raw, hit: ((): boolean => {
    if (GERUND_FACT.test(raw)) return false;
    // "That small cap fund? Sell it.": the pronoun points back to the sentence before
    if (PRONOUN_CALL.test(raw) && !p.target.test(raw) && i > 0 && p.target.test(all[i - 1]) && !refused(raw, PRONOUN_CALL.exec(raw)?.index)) return true;
    const s = unwrap(raw);
    return anyUnrefused(p.exit, s) || anyUnrefused(p.move, s) || anyUnrefused(p.obj, s) || anyUnrefused(p.part, s) || anyUnrefused(p.putHeld, s) || anyUnrefused(p.stop, s) || anyUnrefused(p.buy, s)
      || (BOOK.test(s) && !refused(s, BOOK.exec(s)?.index))
      || (PRONOUN_CALL.test(s) && p.target.test(s) && !refused(s, PRONOUN_CALL.exec(s)?.index))
      || clauses(s).some((c) => !HI_REFUSAL.test(c) && ((HI_SELL.test(c) && p.hiTarget.test(c.replace(HI_POT, ''))) || (HI_MOVE.test(c) && p.hiSource.test(c.replace(HI_POT, '')))));
  })() }));
}
export const tellsToExit = (a: string, held: string[] = []): boolean => flags(a, held).some((f) => f.hit);
/** Kept for the eval and older callers: the same check. */
export const tellsToTrade = tellsToExit;

/** Sentences that carry such an instruction. */
export const exitSentences = (a: string, held: string[] = []) => flags(a, held).filter((f) => f.hit).map((f) => f.s); // in context: "Sell it." after its fund
export const tradeSentences = exitSentences;
