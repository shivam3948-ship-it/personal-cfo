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
const INSURER_NAME = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${INSURER.join('|')})(?:[ \t]+[A-Z][\w'’+-]*){0,4}(?![\p{L}\p{N}])`, 'gu');
const BUY_COVER = /\b(?:buy|take|get|choose|pick|go\s+(?:with|for)|consider|opt\s+for|switch\s+to|port\s+(?:it\s+)?to|purchase|apply\s+for|sign\s+up\s+(?:for|with)|recommend|suggest)\b[^.!?\n]{0,80}\b(?:plan|policy|cover|insurance|term|health)\b|\b(?:plan|policy|cover|insurance)\b[^.!?\n]{0,40}\b(?:from|with|by)\s+[A-Z]/i;
const OWN_COVER = /\b(?:surrender|paid[- ]up)\s+value|\bpremium\b|\brenew|\bclaim|\bdue\b|\byour\s+(?:existing\s+)?(?:\w+\s+)?(?:policy|cover|plan)\b/i;
const STRONG_BUY = /\b(?:buy|choose|switch\s+to|port\s+(?:it\s+)?to|purchase|sign\s+up|go\s+(?:with|for)|opt\s+for)\b/i;
// "your HDFC fund", "your LIC policy": a fund house or insurer plus a generic word only, fine when the user holds one
const GENERIC = /^(?:\S+(?:\s+\S+){0,3}?)\s+(?:mutual\s+)?(?:fund|funds|policy|policies|plan|premium|MF)$/i;

export interface Known { names: string[]; houses: string[] }
const norm = (s: string) => s.toLowerCase().replace(/[-–—]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Every name the answer may use: the user's own funds and policies, (advice mode) the owner's picks, and any fund or
 *  insurer the user named themselves (`said`: their own words; "is Star Health any good?" may be answered). */
export function knownProducts(holdings: { scheme: string; amc?: string }[], policies: { insurer: string; name: string }[], picks: string[] = [], said: string[] = []): Known {
  const short = (s: string) => s.replace(/\s*[-–(].*$/, '').replace(/\s+(?:Fund|Plan)$/i, '');
  const theirs = said.flatMap((t) => [...t.matchAll(AMC_PRODUCT), ...t.matchAll(INSURER_NAME)].map((m) => m[0]));
  return {
    names: [...holdings.flatMap((h) => [h.scheme, short(h.scheme)]), ...policies.flatMap((p) => [p.name, `${p.insurer} ${p.name}`, short(p.name)]), ...picks, ...picks.map(short), ...theirs]
      .filter((n) => n.length > 2).map(norm),
    houses: [...holdings.map((h) => h.amc ?? ''), ...holdings.map((h) => h.scheme.split(/\s+/).slice(0, 2).join(' ')), ...policies.map((p) => p.insurer)].filter(Boolean).map(norm),
  };
}

/** Product names in the answer that are neither held, picked nor named by the user. */
export function strangerProducts(answer: string, known: Known): string[] {
  const out = new Set<string>();
  const ok = (name: string) => { const n = norm(name); return known.names.some((k) => k.includes(n) || n.includes(k)); };
  const ownHouse = (name: string) => { const n = norm(name.split(/\s+(?:mutual\s+)?(?:fund|funds|policy|policies|plan|premium|MF)$/i)[0]); return known.houses.some((h) => h.startsWith(n) || n.startsWith(h)); };
  for (const m of answer.matchAll(AMC_PRODUCT)) {
    const name = m[0].trim();
    if (ok(name) || (GENERIC.test(name) && ownHouse(name))) continue;
    out.add(name);
  }
  for (const s of answer.split(/(?<=[.!?।\n])\s+/)) {
    if (!BUY_COVER.test(s) || (OWN_COVER.test(s) && !STRONG_BUY.test(s))) continue;
    for (const m of s.matchAll(INSURER_NAME)) { const name = m[0].trim(); if (!ok(name) && !ownHouse(name)) out.add(name); }
  }
  return [...out];
}
