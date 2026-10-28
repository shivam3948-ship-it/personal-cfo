// Does this text tell someone to sell, switch, exit, redeem, stop or top up an investment or policy they hold? English, Hindi
// and Hinglish (D-051, D-065, D-066). Used by the answer guard (lib/agent/claude.ts, lib/agent/funds.ts) and the eval
// checker (evals/score.ts). The eval can't catch what this misses, so tests/advice-guard.test.ts holds an independent list
// of real instructions and real money-path advice that must pass through, collected from two reviews (28 Oct).
//
// The check looks at what the verb acts on, not just whether a fund word is nearby (review 2, N1/N2): "Move ₹40,000 from
// savings into a liquid fund" moves money FROM savings, so it is new money by category (allowed); "Move ₹20,000 out of your
// small cap fund" moves it out of a holding (an exit). A clause break (", and, then, aur, और, फिर, but") ends the reach of a
// verb, so "Cancel Netflix and start a SIP" is about Netflix.

// Between a verb and what it acts on: anything but a sentence or clause end. A full stop only inside a number (₹1.5 lakh) or
// after "Rs"; a comma only inside a number (₹1,50,000).
const W = String.raw`(?:(?!\s(?:and|then|but|aur|phir|or else)\s|\s(?:और|फिर|लेकिन)\s)(?:[^.;!?।\n,]|\.(?=\d)|,(?=\d)|(?<=\b(?:Rs|rs|RS|Re|re))\.))`;
// What an exit acts on: a fund, scheme, policy or SIP; units or holdings; a fund category (small cap, ELSS…). Not a savings
// pot ("emergency fund"), which is the safety net, not a fund product.
const POT = String.raw`(?<!\b(?:emergency|safety|rainy[- ]day|sinking|contingency|buffer|wedding|travel|goal)\s)`;
const CATS = String.raw`(?:small|mid|large|flexi|multi|large\s*&\s*mid)[- ]?caps?|ELSS|index(?:\s+funds?)?|bluechip|nifty|sensex|liquid\s+funds?|debt\s+funds?|hybrid\s+funds?|gold\s+funds?|ULIPs?|endowment|NPS`;
const TARGET_BASE = String.raw`${POT}\b(?:funds?|schemes?|polic(?:y|ies)|SIPs?|units|holdings?|investments?|mutual\s+funds?|MFs?|portfolio|stocks?|shares|${CATS})\b`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const EXIT_VERB = String.raw`(?:sell(?:ing|s)?|redeem(?:ing|s)?|exit(?:ing|s)?(?!\s+load)|switch(?:ing|es)?(?:\s+(?:out\s+of|from))?|surrender(?:ing|s)?(?!\s+(?:value|and\s+paid|charges?|penalty))|withdraw(?:ing)?\s+from|get(?:ting)?\s+out\s+of|pull(?:ing)?\s+(?:\S+\s+){0,3}out\s+of|cash(?:ing)?\s+out|liquidat(?:e|ing)|dump(?:ing)?|trim(?:ming)?|reduc(?:e|ing)\s+(?:your\s+)?(?:exposure|allocation|holding)s?\s+(?:to|in)|stop(?:ping)?\s+investing\s+in|discontinu(?:e|ing))`;
// move/shift/transfer is an exit only when what follows "out of / from" IS a holding (review 2, N2)
const MOVE = String.raw`\b(?:move|moving|shift|shifting|transfer|transferring|put)\b${W}{0,40}?\b(?:out\s+of|from)\s+(?:(?:your|the|my|this|that|all|of|these|those)\s+){0,3}`;
// stop/pause/cancel is an exit only when its own object is the SIP or a fund (not "Cancel Netflix and start a SIP")
const STOP = String.raw`\b(?:stop(?:ping)?|paus(?:e|ing)|cancel(?:ling|ing)?|halt|discontinu(?:e|ing))\b${W}{0,40}?`;
// topping up a fund the user holds is a call on that fund too (review 2, N6); buying a category for new money is not
const BUY_HELD = String.raw`\b(?:buy(?:ing)?|invest(?:ing)?\s+(?:more\s+)?in|add(?:ing)?\s+(?:more\s+)?to|top(?:ping)?\s+up|increas(?:e|ing)\s+(?:your\s+)?(?:SIP|investment)\s+in)\b${W}{0,40}?`;
// booking gains is the sell call itself, whatever the fund (docs/03 §3 lists it as gated)
const BOOK = /\b(?<!(?:can|could|may|allowed to|up to|limit to)\s(?:\w+\s)?)(?:book(?:ing)?|harvest(?:ing)?|realis(?:e|ing)|realiz(?:e|ing))\s+(?:₹?[\d,.]+\s*(?:lakh|crore|k)?\s+)?(?:of\s+)?(?:(?:your|the|long[- ]term|short[- ]term|capital|tax[- ]free)\s+){0,3}(?:gains?|profits?)\b/i;

// a refusal to ADVISE governs the trade word ("can't tell you to sell", "cannot recommend whether to redeem"); a comma,
// colon or "but" ends it. "You don't need to sell" is not an instruction either.
const REFUSING = /\b(?:can[’']?t|cannot|won[’']?t|will not|(?:am )?not able to|unable to)\s+(?:tell|advise|recommend|suggest|say|ask)\s+(?:you\s+)?(?:to|whether|which|if)\b(?:(?!\bbut\b|\bhowever\b)(?:[^.!?;:,—–\n-]|,(?=\s+(?:or\s+)?(?:sell|switch|exit|redeem|stop|buy|surrender|move|pause)\b)|(?<=\b(?:sell|switch|exit|redeem|stop|buy|surrender|move|pause)),(?=\s*$))){0,60}$|\b(?:don[’']?t|do not|doesn[’']?t|does not)\s+(?:need|have)\s+to\s+$|\bno need to\s+$|\b(?:never|not)\s+(?:to\s+)?$/i;
const refused = (a: string, at: number | undefined) => REFUSING.test(a.slice(Math.max(0, (at ?? 0) - 90), at)); // a list ("sell, switch or stop") stays refused

// Hindi and Hinglish (the primary user, D-054): commands only, in the same clause as a fund, SIP, policy, category or a fund
// the user holds. A description ("बदलने का मतलब बेचना", switching means selling) is not a command.
const HI_SELL = new RegExp([
  String.raw`बेच\s*(?:दो|दें|दीजिए|दीजिये|डालो|डालें|देना\s*चाहिए|देनी\s*चाहिए|दें\s*तो)|बेचिए|बेचिये|बेचो|बेचें|बेचना\s*चाहिए|बेचनी\s*चाहिए`,
  String.raw`(?:रिडीम|सरेंडर|स्विच|एग्ज़िट|एग्जिट)\s*कर(?:ो|ें|िए|िये|\s*(?:दो|दें|लो|लें|दीजिए|देना\s*चाहिए|लेना\s*चाहिए))`,
  String.raw`निकल\s*(?:जाइए|जाइये|जाओ|जाएं|जाएँ|लीजिए|लो|आइए|आओ)|छोड़\s*(?:दो|दें|दीजिए|दीजिये|देना\s*चाहिए)|(?:बंद|रोक)\s*(?:कर\s*)?(?:दो|दें|दीजिए|दीजिये|करें|करो|करिए|कीजिए|देना\s*चाहिए)`,
  String.raw`\b(?:bech\s*(?:do|dijiye|dein|daalo|dena\s*chahiye|deni\s*chahiye)|bechiye|becho|bechna\s*chahiye|nikaa?l\s*(?:lo|do|jao|jaiye|jaayein)|chho?d\s*(?:do|dijiye|dein|dena\s*chahiye)|(?:band|rok)\s*kar\s*(?:do|dijiye|dein|lo|lein|dena\s*chahiye)|(?:redeem|surrender|switch|exit|stop)\s*kar\s*(?:do|lo|dijiye|dein|lein|dena\s*chahiye|lena\s*chahiye))\b`,
].join('|'), 'i');
const HI_TARGET = String.raw`(?<![ऀ-ॿ])(?:फ़ंड|फंड|पॉलिसी|स्कीम|एसआईपी|यूनिट|स्मॉल\s*कैप|मिड\s*कैप|लार्ज\s*कैप|फ्लेक्सी\s*कैप|फ़्लेक्सी\s*कैप|इंडेक्स|निवेश)|\b(?:funds?|polic(?:y|ies)|schemes?|SIPs?|units|${CATS})\b`;
const HI_POT = /(?:इमरजेंसी|आपात(?:कालीन)?|सेफ्टी)\s*(?:फ़ंड|फंड)|\b(?:emergency|safety|rainy[- ]day)\s+fund\b/gi;
const HI_REFUSAL = /नहीं बता सकत|सलाह नहीं|नहीं कह सकत|लाइसेंस नहीं|nahi?n? bata sakt|salah nahi|license nahi/i;

/** Sentences, without breaking on "Rs.", "No.", "e.g." or a decimal point (₹1.5). */
export const sentences = (a: string) =>
  a.split(/(?<=[।!?\n])\s*|(?<!\b(?:Rs|rs|RS|Re|re|No|no|vs|e\.g|i\.e|approx|Mr|Ms|Dr|St)\.)(?<=\.)\s+/).filter((s) => s.trim());
const clauses = (s: string) => s.split(/,(?!\d)\s*|\s+(?:and|then|but|aur|phir|par|lekin|magar)\s+|\s+(?:और|फिर|पर|लेकिन|मगर)\s+/i);

const cache = new Map<string, { exit: RegExp; move: RegExp; stop: RegExp; buy: RegExp | null; hiTarget: RegExp }>();
function patterns(held: string[]) {
  const key = held.join('\u0001'); const hit = cache.get(key); if (hit) return hit;
  const names = [...new Set(held.filter((n) => n.length > 3))].sort((x, y) => y.length - x.length).map(esc);
  const HELD = names.length ? String.raw`(?<![\p{L}\p{N}])(?:${names.join('|')})(?![\p{L}\p{N}])` : '';
  const TARGET = HELD ? `(?:${HELD}|${TARGET_BASE})` : TARGET_BASE;
  const p = {
    exit: new RegExp(String.raw`\b${EXIT_VERB}\b${W}{0,60}?${TARGET}`, 'giu'),
    move: new RegExp(`${MOVE}${TARGET}`, 'giu'),
    stop: new RegExp(String.raw`${STOP}(?:\bSIPs?\b|${TARGET})`, 'giu'),
    buy: HELD ? new RegExp(`${BUY_HELD}${HELD}`, 'giu') : null,
    hiTarget: new RegExp(HELD ? `(?:${HELD}|${HI_TARGET})` : HI_TARGET, 'iu'),
  };
  if (cache.size > 50) cache.clear(); cache.set(key, p); return p;
}
const anyUnrefused = (re: RegExp | null, s: string) => !!re && [...s.matchAll(re)].some((m) => !refused(s, m.index));

/** An instruction to sell, switch, exit, redeem, surrender, move out of, stop, book gains on, or (for a fund the user holds,
 *  `held` = its names) top up an investment or policy. Outside advice mode the answer guard removes these. */
export function tellsToExit(a: string, held: string[] = []): boolean {
  const p = patterns(held);
  return sentences(a).some((s) =>
    anyUnrefused(p.exit, s) || anyUnrefused(p.move, s) || anyUnrefused(p.stop, s) || anyUnrefused(p.buy, s)
    || (BOOK.test(s) && !refused(s, BOOK.exec(s)?.index))
    || clauses(s).some((c) => HI_SELL.test(c) && p.hiTarget.test(c.replace(HI_POT, '')) && !HI_REFUSAL.test(c)));
}
/** Kept for the eval and older callers: the same check. */
export const tellsToTrade = tellsToExit;

/** Sentences that carry such an instruction. */
export const exitSentences = (a: string, held: string[] = []) => sentences(a).filter((s) => tellsToExit(s, held));
export const tradeSentences = exitSentences;
