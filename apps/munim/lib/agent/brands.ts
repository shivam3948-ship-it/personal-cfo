// Products the answer names that the user doesn't hold and the owner hasn't picked (D-066 review, #4). A heuristic: a fund
// house followed by fund words ("Parag Parikh Flexi Cap"), or an insurer's name ("HDFC Life", "Star Health"). Banks and
// cards ("HDFC credit card", "SBI account", "Tata Play plan") don't match, because a fund house only counts next to fund
// words. Latin script only: a name written in Devanagari is not caught (the prompt and advice_picks still apply).
const AMC = ['SBI', 'HDFC', 'ICICI(?: Prudential| Pru)?', 'Axis', 'Kotak', 'Nippon(?: India)?', 'Aditya Birla(?: Sun Life)?', 'UTI', 'DSP',
  'Mirae(?: Asset)?', 'Parag Parikh', 'PPFAS', 'Quant', 'Motilal Oswal', 'Tata', 'Franklin(?: (?:India|Templeton))?', 'Edelweiss', 'Invesco(?: India)?',
  'Canara Robeco', 'Bandhan', 'IDFC', 'HSBC', 'Sundaram', 'Baroda BNP(?: Paribas)?', 'Mahindra Manulife', 'PGIM(?: India)?', 'Navi', 'Zerodha',
  'Groww', 'WhiteOak(?: Capital)?', 'Union', 'LIC', 'Bajaj Finserv', '360 ONE', 'Helios', 'Old Bridge', 'Samco', 'ITI', 'JM Financial', 'Quantum', 'Shriram', 'Trust'];
const FUND_WORDS = String.raw`(?:fund|scheme|ELSS|index|flexi ?cap|small ?cap|mid ?cap|large ?cap|large & mid ?cap|multi ?cap|bluechip|nifty|sensex|liquid|overnight|money market|short (?:term|duration)|debt|gilt|hybrid|multi[- ]asset|balanced advantage|equity savings|tax ?saver|FoF|ETF|value|focused|contra|dividend yield)`;
// fund words in any case; brand names and the capitalised words of a product name stay case-sensitive
const ci = (src: string) => src.replace(/(?<!\\)[a-zA-Z]/g, (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`);
const INSURER = ['LIC(?: of India)?', 'HDFC Life', 'ICICI Pru(?:dential)? Life', '(?:Axis )?Max Life', 'SBI Life', 'Tata AIA', 'Bajaj (?:Allianz|Life)', 'Kotak (?:Mahindra )?Life',
  'PNB MetLife', 'Aditya Birla (?:Sun Life Insurance|Health)', 'Star Health', 'Niva Bupa', 'Care Health', 'HDFC Ergo', 'ICICI Lombard', 'Go Digit', 'Digit Insurance',
  'Acko', 'Tata AIG', 'Manipal ?Cigna', 'Reliance (?:General|Health|Nippon Life)', 'Bharti AXA', 'Edelweiss (?:Tokio|Life)', 'Canara HSBC', 'Future Generali', 'IndiaFirst', 'Shriram Life', 'Bandhan Life', 'Galaxy Health', 'Aditya Birla Capital'];
const PRODUCT = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:(?:${INSURER.join('|')})(?:[ \t]+[A-Z0-9][\w'’+-]*){0,4}|(?:${AMC.join('|')})(?:[ \t]+[A-Z0-9][\w&'’+-]*){0,4}?[ \t]+${ci(FUND_WORDS)}(?:[ \t]+[A-Z0-9][\w'’+-]*){0,3})(?![\p{L}\p{N}])`, 'gu');
// "your HDFC fund", "your LIC policy": a fund house or insurer plus a generic word only, which is fine when the user holds one
const GENERIC = /^(?:\S+(?:\s+\S+){0,3}?)\s+(?:mutual\s+)?(?:fund|funds|policy|policies|plan|premium|MF)$/i;

export interface Known { names: string[]; houses: string[] }
const norm = (s: string) => s.toLowerCase().replace(/[-–—]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Every name the answer may use: the user's own funds and policies, and (advice mode) the owner's picks. */
export function knownProducts(holdings: { scheme: string; amc?: string }[], policies: { insurer: string; name: string }[], picks: string[] = []): Known {
  const short = (s: string) => s.replace(/\s*[-–(].*$/, '').replace(/\s+(?:Fund|Plan)$/i, '');
  return {
    names: [...holdings.flatMap((h) => [h.scheme, short(h.scheme)]), ...policies.flatMap((p) => [p.name, `${p.insurer} ${p.name}`, short(p.name)]), ...picks, ...picks.map(short)].filter((n) => n.length > 3).map(norm),
    houses: [...holdings.map((h) => h.amc ?? ''), ...holdings.map((h) => h.scheme.split(/\s+/).slice(0, 2).join(' ')), ...policies.map((p) => p.insurer)].filter(Boolean).map(norm),
  };
}

/** Product names in the answer that are neither held nor picked. */
export function strangerProducts(answer: string, known: Known): string[] {
  const out = new Set<string>();
  for (const m of answer.matchAll(PRODUCT)) {
    const name = m[0].trim(), n = norm(name);
    if (known.names.some((k) => k.includes(n) || n.includes(k))) continue; // held or picked (any spelling of it)
    if (GENERIC.test(name) && known.houses.some((h) => h.startsWith(norm(name.split(/\s+(?:mutual\s+)?(?:fund|funds|policy|policies|plan|premium|MF)$/i)[0])) || n.startsWith(h))) continue;
    out.add(name);
  }
  return [...out];
}
