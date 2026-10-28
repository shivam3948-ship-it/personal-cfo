// Fund names in Ask. The user's own funds may be named as facts (D-066); what must never happen outside advice mode is a
// fund name next to an instruction to buy, sell, switch, exit or redeem it (D-051). Found by the first live-Claude eval
// (28 Oct): a Hinglish answer paired a holding with a judgement. The guard finds such sentences and swaps the name there.
import { shortName } from '@core/portfolio/engine';
import type { Dataset } from '@core/types';
import { tradeSentences } from './tradeWords';

type Holding = NonNullable<Dataset['portfolio']>['holdings'][number];
export interface FundLabel { names: string[]; label: string }

const catWords = (c: string) => (/^[A-Z0-9]{2,}\b/.test(c) ? c : c.toLowerCase()); // ELSS stays ELSS; "Small cap" → "small cap"

/** Each holding: every way its name can appear (scheme as printed, short name, without "Fund", its first two words when
 *  they are unique and not just the fund house), and the words to use instead. Same category twice → numbered. */
export function fundLabels(holdings: Holding[], lang: 'hi' | 'en'): FundLabel[] {
  const firstTwo = (h: Holding) => shortName(h.scheme).replace(/ Fund$/i, '').split(' ').slice(0, 2).join(' ');
  const twoCount = new Map<string, number>(); for (const h of holdings) twoCount.set(firstTwo(h), (twoCount.get(firstTwo(h)) ?? 0) + 1);
  const catSeen = new Map<string, number>(), catTotal = new Map<string, number>();
  for (const h of holdings) catTotal.set(h.category, (catTotal.get(h.category) ?? 0) + 1);
  return holdings.map((h) => {
    const short = shortName(h.scheme), bare = short.replace(/ Fund$/i, ''), two = firstTwo(h);
    const amc = (h.amc ?? '').toLowerCase();
    // with no fund house known (a phone-read CAS can leave it empty), the first two words may BE the fund house: skip them
    const twoOk = !!amc && two.length > 3 && twoCount.get(two) === 1 && !amc.startsWith(two.toLowerCase()) && two.toLowerCase() !== amc;
    const n = (catSeen.get(h.category) ?? 0) + 1; catSeen.set(h.category, n);
    const nth = (catTotal.get(h.category) ?? 0) > 1 ? ` (${n})` : '';
    const cat = h.category && h.category !== 'Other' ? catWords(h.category) : '';
    const label = lang === 'hi' ? (cat ? `आपका ${cat} फ़ंड${nth}` : `आपका एक फ़ंड${nth}`) : (cat ? `your ${cat} fund${nth}` : `one of your funds${nth}`);
    return { names: [...new Set([h.scheme, short, bare, ...(twoOk ? [two] : [])])].filter((x) => x.length > 3), label };
  });
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Every name of every fund, longest first, so "X Flexi Cap - Direct Growth" is replaced before "X Flexi Cap". */
function patterns(funds: FundLabel[]) {
  return funds.flatMap((f) => f.names.map((name) => ({ name, label: f.label }))).sort((a, b) => b.name.length - a.name.length)
    .map(({ name, label }) => ({ re: new RegExp(`(?<![\\p{L}\\p{N}])${esc(name)}(?:\\s+Fund)?(?![\\p{L}\\p{N}])`, 'giu'), name, label }));
}
/** Fund names that appear in a sentence telling the user to trade (names stated as facts elsewhere are fine). */
export const namedFunds = (answer: string, funds: FundLabel[]) => { const ts = tradeSentences(answer).join(' '); return patterns(funds).filter((p) => p.re.test(ts)).map((p) => p.name); };
/** In those sentences only, a name becomes its category ("your small cap fund"). */
export function scrubFunds(answer: string, funds: FundLabel[]) {
  let a = answer;
  for (const t of tradeSentences(answer)) { let u = t; for (const p of patterns(funds)) u = u.replace(p.re, p.label); a = a.replace(t, u); }
  return a.replace(/\b(The|A|An)\s+(your|one of your)\b/g, (_, __, w: string) => w[0].toUpperCase() + w.slice(1)).replace(/\b(the|a|an)\s+(your|one of your)\b/g, '$2');
}
/** For tool results: a fund's name → its label (unknown names come back unchanged). */
export function labelFor(funds: FundLabel[], lang: 'hi' | 'en' = 'en') {
  return (name: string) => funds.find((f) => f.names.some((n) => n.toLowerCase() === name.toLowerCase()))?.label ?? (lang === 'hi' ? 'आपका एक फ़ंड' : 'one of your funds');
}
