// Products the answer names that the user doesn't hold and the owner hasn't picked (D-066 review, #4; review 2, N3).
// A heuristic, Latin script only (a name written in Devanagari is not caught; the prompt and advice_picks still apply):
//   · a fund house followed by fund words: "Parag Parikh Flexi Cap", "Mirae Asset Large Cap Fund". A bank, card or loan
//     word in between ends it, and "debt" or "value" alone are not fund words, so "SBI Card debt", "HDFC Credit Card",
//     "Axis Bank Index" and "Tata Nexon value" never match;
//   · an insurer's name, but only in a sentence that recommends buying or moving cover. "Your LIC premium is due", "Ask LIC
//     for the surrender value" and "That ₹12,000 to ICICI Lombard is your car renewal" are facts about the user's own cover.
const AMC = ['SBI', 'HDFC', 'ICICI(?: Prudential| Pru)?', 'Axis', 'Kotak', 'Nippon(?: India)?', 'Aditya Birla(?: Sun Life)?', 'UTI', 'DSP',
  'Mirae(?: Asset)?', 'Parag Parikh', 'PPFAS', 'Quant', 'Motilal Oswal', 'Tata', 'Franklin(?: (?:India|Templeton))?', 'Edelweiss', 'Invesco(?: India)?',
  'Canara Robeco', 'Bandhan', 'IDFC', 'HSBC', 'Sundaram', 'Baroda BNP(?: Paribas)?', 'Mahindra Manulife', 'PGIM(?: India)?', 'Navi', 'Zerodha',
  'Groww', 'WhiteOak(?: Capital)?', 'Union', 'LIC', 'Bajaj Finserv', '360 ONE', 'Helios', 'Old Bridge', 'Samco', 'ITI', 'JM Financial', 'Quantum', 'Shriram', 'Trust',
  'Jio BlackRock', 'Unifi', 'Capitalmind', 'Angel One'];
const INSURER = ['LIC(?: of India)?', 'HDFC Life', 'ICICI Pru(?:dential)? Life', '(?:Axis )?Max Life', 'SBI Life', 'Tata AIA', 'Bajaj (?:Allianz|Life)', 'Kotak (?:Mahindra )?Life',
  'PNB MetLife', 'Aditya Birla (?:Sun Life Insurance|Health)', 'Star Health', 'Niva Bupa', 'Care Health', 'HDFC Ergo', 'ICICI Lombard', 'Go Digit', 'Digit Insurance',
  'Acko', 'Tata AIG', 'Manipal ?Cigna', 'Reliance (?:General|Health|Nippon Life)', 'Bharti AXA', 'Edelweiss (?:Tokio|Life)', 'Canara HSBC', 'Future Generali', 'IndiaFirst',
  'Shriram Life', 'Bandhan Life', 'Galaxy Health'];
const FUND_END = String.raw`(?:fund(?:s)?(?:\s+of\s+funds)?|scheme|ELSS|FoF|ETF|(?:flexi|small|mid|large|multi|large\s*&\s*mid)[- ]?cap|bluechip|nifty(?:\s+(?:50|next\s+50|midcap\s+150|smallcap\s+250))?|sensex|liquid|overnight|money\s+market|gilt|tax\s*saver|balanced\s+advantage|multi[- ]asset(?:\s+allocation)?|equity\s+savings|arbitrage|index\s+fund)`;
const NOT_FUND = String.raw`(?:Bank|Card|Cards|Credit|Debit|Loan|Loans|EMI|Account|Home|Car|Personal|Finance|Securities|Pay|UPI|Life|Ergo|Lombard|General|Health)`;
const ci = (src: string) => src.replace(/(?<!\\)[a-zA-Z]/g, (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`); // fund words in any case
const NAMEWORD = (extra = '') => String.raw`[ \t]+(?!${NOT_FUND}\b)[A-Z0-9][\w${extra}'’+-]*`;
const AMC_PRODUCT = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${AMC.join('|')})(?:${NAMEWORD('&')}){0,4}?[ \t]+${ci(FUND_END)}(?:${NAMEWORD()}){0,3}(?![\p{L}\p{N}])`, 'gu');
const INSURER_NAME = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${INSURER.join('|')})(?:[ \t]+[A-Z0-9][\w'’+-]*){0,4}(?![\p{L}\p{N}])`, 'gu');
const BUY_COVER = /\b(?:buy|take|get|choose|pick|go\s+(?:with|for)|consider|opt\s+for|switch\s+to|port\s+(?:it\s+)?to|purchase|apply\s+for|sign\s+up\s+(?:for|with)|recommend|suggest)\b[^.!?\n]{0,80}\b(?:plan|policy|cover|insurance|term|health)\b|\b(?:plan|policy|cover|insurance)\b[^.!?\n]{0,40}\b(?:from|with|by)\s+[A-Z]/i;
const OWN_COVER = /\b(?:surrender|paid[- ]up)\s+value|\bpremium\b|\brenew|\bclaim|\bdue\b|\byour\s+(?:existing\s+)?(?:\w+\s+)?(?:policy|cover|plan)\b/i;
const STRONG_BUY = /\b(?:buy|choose|switch\s+to|port\s+(?:it\s+)?to|purchase|sign\s+up|go\s+(?:with|for)|opt\s+for)\b/i;
// "your HDFC fund", "your LIC policy": a fund house or insurer plus a generic word only, fine when the user holds one
const GENERIC = /^(?:\S+(?:\s+\S+){0,3}?)\s+(?:mutual\s+)?(?:fund|funds|policy|policies|plan|premium|MF)$/i;

export interface Known { names: string[]; houses: string[]; said: string[] }
// Any capitalised product name ending in Fund/Scheme/Plan, for houses not on the list ("QuickRich Growth Fund"): counted only
// where the sentence recommends it, and not when every word is a category word ("a Liquid Fund", "an Index Fund").
const ANY_FUND = /(?<![\p{L}\p{N}])(?:[A-Z][\w&'’-]*\s+){1,4}(?:Fund|Scheme|Plan)\b/gu;
// "Plan" counts only in a sentence about insurance or pensions: "Switch to the Netflix Basic Plan" is subscription advice (review 7)
const COVER_TALK = /\b(?:insur\w*|term|health|cover|policy|policies|pension|ULIP|endowment|life|mediclaim|bima)\b|बीमा|पॉलिसी/i;
// government small-savings schemes are categories, not picks: naming them is what the prompt's table does
const GOVT = /^(?:the\s+)?(?:Public Provident Fund|Employees'? Provident Fund|Voluntary Provident Fund|National Pension (?:Scheme|System)|Senior Citizens'? Savings Scheme|Post Office (?:Monthly Income|Time Deposit|Recurring Deposit)(?: Scheme| Account)?|Sukanya Samriddhi(?: Yojana| Scheme| Account)?|Atal Pension Yojana|Kisan Vikas Patra|National Savings Certificate|Pradhan Mantri \w+(?: \w+)? (?:Yojana|Scheme))$/i;
const CATEGORY_WORD = /^(?:a|an|the|your|my|this|that|liquid|index|debt|hybrid|multi|asset|allocation|flexi|cap|small|mid|large|term|health|mutual|equity|low|cost|low-cost|short|duration|gold|arbitrage|balanced|advantage|elss|tax|saver|overnight|money|market|nifty|50|sensex|emergency|safety|new|regular|direct|growth|good|well|rated|well-rated|family|floater|retirement|pension|sip|savings|corporate|bond|dynamic|conservative|aggressive|value|dividend|fund|funds|scheme|plan)$/i;
// a sentence that recommends something (review 3): a product the user named may be discussed, never recommended back
const RECOMMEND = /\b(?:buy|invest(?:ing)?\s+in|go\s+(?:with|for)|choose|pick|consider|opt\s+for|switch\s+to|port\s+(?:it\s+)?to|recommend|suggest|purchase|take|get|start\s+(?:a\s+)?SIP|put\s+(?:\S+\s+){0,4}(?:in|into))\b|\bis\s+(?:a\s+|the\s+)?(?:good|great|best|better|solid|safe|top|ideal|right|smart)\b|^\s*(?:yes|haan?|ji)\b|\b(?:should|could|might|try)\b|\b(?:move|shift|transfer|park|invest|switch)\b[^.!?]{0,40}\b(?:in|into|to)\b|अच्छा|बेहतर|खरीद|ले\s*लो|\ble\s*lo\b|\bkharid/i;
const norm = (s: string) => s.toLowerCase().replace(/[-–—]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Every name the answer may use: the user's own funds and policies, (advice mode) the owner's picks, and any fund or
 *  insurer the user named themselves (`said`: their own words; "is Star Health any good?" may be answered). */
export function knownProducts(holdings: { scheme: string; amc?: string }[], policies: { insurer: string; name: string }[], picks: string[] = [], said: string[] = []): Known {
  const short = (s: string) => s.replace(/\s*[-–(].*$/, '').replace(/\s+(?:Fund|Plan)$/i, '');
  const theirs = said.flatMap((t) => [...t.matchAll(AMC_PRODUCT), ...t.matchAll(INSURER_NAME)].map((m) => m[0]));
  return {
    names: [...holdings.flatMap((h) => [h.scheme, short(h.scheme)]), ...policies.flatMap((p) => [p.name, `${p.insurer} ${p.name}`, short(p.name)]), ...picks, ...picks.map(short)]
      .filter((n) => n.length > 2).map(norm),
    said: theirs.map(norm),
    houses: [...holdings.map((h) => h.amc ?? ''), ...holdings.map((h) => h.scheme.split(/\s+/).slice(0, 2).join(' ')), ...policies.map((p) => p.insurer)].filter(Boolean).map(norm),
  };
}

/** Product names in the answer that are neither held nor picked. A product the user named themselves may be discussed in a
 *  fact sentence, never recommended back (review 3: "Should I buy X?" → "Yes, buy X" is a pick from memory). A fund from a
 *  fund house anywhere; an insurer with a product name anywhere ("HDFC Life Click 2 Protect is a good term plan"), unless it
 *  is "your …"; an insurer alone only where cover is recommended. */
export function strangerProducts(answer: string, known: Known): string[] {
  const out = new Set<string>();
  const has = (list: string[], name: string) => { const n = norm(name); return list.some((k) => k.includes(n) || n.includes(k)); };
  const ownHouse = (name: string) => { const n = norm(name.split(/\s+(?:mutual\s+)?(?:fund|funds|policy|policies|plan|premium|MF)$/i)[0]); return known.houses.some((h) => h.startsWith(n) || n.startsWith(h)); };
  for (const s of answer.split(/(?<=[.!?।\n])\s+/)) {
    const rec = RECOMMEND.test(s);
    const allowed = (name: string) => has(known.names, name) || (!rec && has(known.said, name));
    for (const m of s.matchAll(AMC_PRODUCT)) {
      const name = m[0].trim();
      if (allowed(name) || (GENERIC.test(name) && ownHouse(name) && !rec)) continue;
      out.add(name);
    }
    if (rec) for (const m of s.matchAll(ANY_FUND)) {
      const name = m[0].trim().replace(/^(?:(?:Consider|Buy|Try|Choose|Pick|Take|Get|Go|Switch|Move|Put|Invest|Start|Use|Opt|Yes|So|Then|Also|Maybe|Perhaps)\s+)+/, ''); // a sentence-opening verb is not part of the name
      if (!/\s/.test(name)) continue;
      if (/\bPlan$/.test(name) && !COVER_TALK.test(s)) continue;
      if (GOVT.test(name)) continue;
      if (name.split(/\s+/).every((w) => CATEGORY_WORD.test(w)) || allowed(name) || [...out].some((o) => o.includes(name) || name.includes(o))) continue;
      if (INSURER_NAME.test(name)) { INSURER_NAME.lastIndex = 0; continue; } // insurers are judged below
      INSURER_NAME.lastIndex = 0;
      out.add(name);
    }
    for (const m of s.matchAll(INSURER_NAME)) {
      const name = m[0].trim(), product = /\s[A-Z0-9]/.test(name.replace(new RegExp(`^(?:${INSURER.join('|')})`), ''));
      const own = /\b(?:your|my|aapki|aapka|apni|apna)\s+$/i.test(s.slice(Math.max(0, (m.index ?? 0) - 12), m.index)) || /(?:आपकी|आपका|अपनी|अपना)\s*$/.test(s.slice(0, m.index));
      if (allowed(name) || own) continue;
      if (product) { out.add(name); continue; } // a named plan, whatever the verb
      if (!(BUY_COVER.test(s) || rec) || (OWN_COVER.test(s) && !STRONG_BUY.test(s))) continue;
      if (ownHouse(name) && !rec) continue;
      out.add(name);
    }
  }
  return [...out];
}
