// Fund names in Ask (D-051): before the adviser licence an answer never names a fund, not even the user's own. Tools label
// funds by category before Claude sees them (the root fix), and the answer is checked and scrubbed after (the backstop).
// Found by the first live-Claude eval (28 Oct): a Hinglish answer named a holding the X-ray tool had passed through.
import { shortName } from '@core/portfolio/engine';
import type { Dataset } from '@core/types';

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
    const twoOk = two.length > 3 && twoCount.get(two) === 1 && !amc.startsWith(two.toLowerCase()) && two.toLowerCase() !== amc;
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
export const namedFunds = (answer: string, funds: FundLabel[]) => patterns(funds).filter((p) => p.re.test(answer)).map((p) => p.name);
export function scrubFunds(answer: string, funds: FundLabel[]) {
  let a = answer;
  for (const p of patterns(funds)) a = a.replace(p.re, p.label);
  return a.replace(/\b(The|A|An)\s+(your|one of your)\b/g, (_, __, w: string) => w[0].toUpperCase() + w.slice(1)).replace(/\b(the|a|an)\s+(your|one of your)\b/g, '$2');
}
/** For tool results: a fund's name → its label (unknown names come back unchanged). */
export function labelFor(funds: FundLabel[]) {
  return (name: string) => funds.find((f) => f.names.some((n) => n.toLowerCase() === name.toLowerCase()))?.label ?? name;
}
