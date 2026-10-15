import type { Txn } from '../types';

/** How a category counts in the money picture. */
export type Group = 'income' | 'spend' | 'committed' | 'non_spend';

export interface Category { name: string; group: Group; hi: string }

export const CATEGORIES: Record<string, Category> = {
  Salary: { name: 'Salary', group: 'income', hi: 'सैलरी' },
  'Other income': { name: 'Other income', group: 'income', hi: 'दूसरी आमदनी' },
  Rent: { name: 'Rent', group: 'spend', hi: 'किराया' },
  'Food delivery': { name: 'Food delivery', group: 'spend', hi: 'फ़ूड डिलीवरी' },
  'Quick commerce': { name: 'Quick commerce', group: 'spend', hi: 'क्विक कॉमर्स' },
  Groceries: { name: 'Groceries', group: 'spend', hi: 'राशन' },
  Dining: { name: 'Dining', group: 'spend', hi: 'बाहर खाना' },
  Shopping: { name: 'Shopping', group: 'spend', hi: 'शॉपिंग' },
  Electronics: { name: 'Electronics', group: 'spend', hi: 'इलेक्ट्रॉनिक्स' },
  Travel: { name: 'Travel', group: 'spend', hi: 'ट्रैवल' },
  Cabs: { name: 'Cabs', group: 'spend', hi: 'कैब' },
  Fuel: { name: 'Fuel', group: 'spend', hi: 'पेट्रोल' },
  Utilities: { name: 'Utilities', group: 'spend', hi: 'बिजली-पानी' },
  'Mobile & internet': { name: 'Mobile & internet', group: 'spend', hi: 'मोबाइल-इंटरनेट' },
  Subscriptions: { name: 'Subscriptions', group: 'spend', hi: 'सब्सक्रिप्शन' },
  Fitness: { name: 'Fitness', group: 'spend', hi: 'जिम' },
  Education: { name: 'Education', group: 'spend', hi: 'पढ़ाई' },
  'Cash withdrawal': { name: 'Cash withdrawal', group: 'spend', hi: 'कैश निकासी' },
  'Fees & charges': { name: 'Fees & charges', group: 'spend', hi: 'बैंक चार्ज' },
  Other: { name: 'Other', group: 'spend', hi: 'अन्य' },
  'Loan EMI': { name: 'Loan EMI', group: 'committed', hi: 'लोन EMI' },
  Insurance: { name: 'Insurance', group: 'committed', hi: 'बीमा' },
  Investments: { name: 'Investments', group: 'committed', hi: 'निवेश' },
  'Family support': { name: 'Family support', group: 'committed', hi: 'परिवार को' },
  'Self transfer': { name: 'Self transfer', group: 'non_spend', hi: 'अपने खाते में' },
  'Card bill payment': { name: 'Card bill payment', group: 'non_spend', hi: 'कार्ड बिल' },
  Cashback: { name: 'Cashback', group: 'non_spend', hi: 'कैशबैक' },
  Interest: { name: 'Interest', group: 'non_spend', hi: 'ब्याज' },
  Refund: { name: 'Refund', group: 'non_spend', hi: 'रिफ़ंड' },
};

export const groupOf = (cat: string): Group => CATEGORIES[cat]?.group ?? 'spend';

interface Rule { cat: string; re: RegExp; dir?: 'debit' | 'credit' }

// Priority-ordered; first match wins. Word boundaries, not substrings (\blic\b would not match "licious").
const RULES: Rule[] = [
  { cat: 'Card bill payment', re: /\b(billpay|bill ?pay|payment)\b.*\bcredit card\b|\bcc bill\b|\bcard bill\b/i, dir: 'debit' },
  { cat: 'Card bill payment', re: /\bpayment received\b/i, dir: 'credit' }, // card-side receipt of the bill payment
  { cat: 'Cashback', re: /\bcashback\b/i, dir: 'credit' },
  { cat: 'Refund', re: /\brefund\b|\breversal\b/i, dir: 'credit' },
  { cat: 'Interest', re: /\b(sb )?interest (credit|paid)\b|\bint\.? ?pd\b/i, dir: 'credit' },
  { cat: 'Salary', re: /\bsalary\b|\bsal cr\b/i, dir: 'credit' },
  { cat: 'Subscriptions', re: /\bnetflix\b|\bspotify\b|\bhotstar\b|\bjiohotstar\b|\byoutube ?premium\b|\byoutubepremium\b|\bprime\b|\bsonyliv\b|\bzee5\b|\blingopro\b|\baudible\b|\bicloud\b|\bgoogle one\b|\bchatgpt\b|\bopenai\b/i },
  { cat: 'Fitness', re: /\bcult(fit|\.fit)?\b|\bgym\b|\bfitness\b|\bhealthifyme\b/i },
  { cat: 'Self transfer', re: /\bself\b|\bown a\/c\b/i },
  { cat: 'Loan EMI', re: /\bemi\b|\bauto finance\b|\bfinserv\b|\bloan\b|\bln xx\d+/i, dir: 'debit' },
  { cat: 'Investments', re: /\bmf sip\b|\bsip\b|\bmutual fund\b|\bbse ltd\b|\biccl\b|\bzerodha\b|\bgroww\b/i, dir: 'debit' },
  { cat: 'Insurance', re: /\binsurance\b|\bpremium\b|\blic\b|\bpol xx\d+/i, dir: 'debit' },
  { cat: 'Rent', re: /\brent\b/i, dir: 'debit' },
  { cat: 'Family support', re: /\b(papa|mummy|maa|mom|dad|father|mother)\b/i, dir: 'debit' },
  { cat: 'Fees & charges', re: /\b(annual fee|charges?|chg|chgs|gst on|late fee|penal)\b/i, dir: 'debit' },
  { cat: 'Cash withdrawal', re: /\batm\b.*\bwdl\b|\batm wdl\b|\bcash withdrawal\b/i, dir: 'debit' },
  { cat: 'Food delivery', re: /\bswiggy\b|\bzomato\b|\beatsure\b/i },
  { cat: 'Quick commerce', re: /\bblinkit\b|\bzepto\b|\binstamart\b|\bbigbasket now\b/i },
  { cat: 'Groceries', re: /\bdmart\b|\bbigbasket\b|\bjiomart\b|\bnature'?s basket\b|\bgrocer/i },
  { cat: 'Cabs', re: /\buber\b|\bola(cabs)?\b|\brapido\b|\bblusmart\b/i },
  { cat: 'Fuel', re: /\bhpcl\b|\biocl\b|\bbpcl\b|\bfuel\b|\bpetrol\b|\bshell\b/i },
  { cat: 'Mobile & internet', re: /\bairtel\b|\bjio\b|\bvodafone\b|\bvi postpaid\b|\bact fibernet\b|\bbroadband\b|\bpostpaid\b/i },
  { cat: 'Utilities', re: /\belectricity\b|\bdhbvn\b|\bbescom\b|\btata power\b|\bwater\b|\bgas\b|\bigl\b/i },
  { cat: 'Electronics', re: /\bcroma\b|\breliance digital\b|\bvijay sales\b|\bapple store\b/i },
  { cat: 'Travel', re: /\bmakemytrip\b|\bgoibibo\b|\bindigo\b|\birctc\b|\bresort\b|\bhotel\b|\boyo\b|\bairbnb\b|\bcleartrip\b/i },
  { cat: 'Dining', re: /\bcafe\b|\brestaurant\b|\bbiryani\b|\bsocial\b|\bchaayos\b|\bstarbucks\b|\bdominos\b|\bpos\b/i },
  { cat: 'Shopping', re: /\bamazon\b|\bflipkart\b|\bmyntra\b|\bajio\b|\bnykaa\b|\bmeesho\b/i },
  { cat: 'Education', re: /\bcoursera\b|\budemy\b|\bschool\b|\bcollege\b|\btuition\b/i },
];

const MERCHANTS: [RegExp, string][] = [
  [/\bswiggy\b/i, 'Swiggy'], [/\bzomato\b/i, 'Zomato'], [/\bblinkit\b/i, 'Blinkit'], [/\bzepto\b/i, 'Zepto'],
  [/\bdmart\b/i, 'DMart'], [/\buber\b/i, 'Uber'], [/\bola(cabs)?\b/i, 'Ola'], [/\brapido\b/i, 'Rapido'],
  [/\bnetflix\b/i, 'Netflix'], [/\bspotify\b/i, 'Spotify'], [/\b(jio)?hotstar\b/i, 'JioHotstar'], [/\byoutube ?premium\b|youtubepremium/i, 'YouTube Premium'],
  [/\bamazon prime\b/i, 'Amazon Prime'], [/\blingopro\b/i, 'LingoPro'], [/\bcult(fit|\.fit)?\b/i, 'cult.fit'],
  [/\bairtel\b/i, 'Airtel'], [/\bact fibernet\b/i, 'ACT Fibernet'], [/\bdhbvn\b/i, 'DHBVN Electricity'],
  [/\bmf sip\b|\bbse ltd\b|\biccl\b/i, 'Mutual fund SIP'], [/\batm\b/i, 'ATM cash'],
  [/\bamazon\b/i, 'Amazon'], [/\bmyntra\b/i, 'Myntra'], [/\bcroma\b/i, 'Croma'], [/\bmakemytrip\b/i, 'MakeMyTrip'],
  [/\bkestrel\b/i, 'Kestrel Auto Finance'], [/\borbit\b/i, 'Orbit Finserv'], [/\bbharosa\b/i, 'Bharosa Life'],
  [/\bsuraksha\b/i, 'Suraksha Health'], [/\btarang\b/i, 'Tarang Life'], [/\bhpcl\b/i, 'HPCL'], [/\biocl\b/i, 'IOCL'],
];

export function merchantOf(desc: string): string {
  for (const [re, name] of MERCHANTS) if (re.test(desc)) return name;
  // Fallback: the most informative token of a UPI/POS narration, never a person's handle.
  const parts = desc.split(/[/|]/).map((p) => p.trim()).filter(Boolean);
  const isP2P = /\bp2p\b/i.test(desc);
  if (isP2P) return 'Person-to-person';
  const cand = parts.find((p) => !/^(upi|neft|imps|ach|ach dr|pos|bbps|billpay|autopay|nach|cr|dr)$/i.test(p) && !/@/.test(p) && !/^\d+$/.test(p));
  return (cand ?? desc).replace(/\s+/g, ' ').slice(0, 40);
}

export function categorize(t: Pick<Txn, 'desc' | 'dir'>): string {
  for (const r of RULES) {
    if (r.dir && r.dir !== t.dir) continue;
    if (r.re.test(t.desc)) return r.cat;
  }
  return t.dir === 'credit' ? 'Other income' : 'Other';
}

export function categorizeAll(txns: Txn[]): Txn[] {
  return txns.map((t) => ({ ...t, category: t.category ?? categorize(t), merchant: t.merchant ?? merchantOf(t.desc) }));
}
