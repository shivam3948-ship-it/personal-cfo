// Today on your own statements (D-049): the figures the Today screen needs, from data that lives on the phone.
// Pure and browser-safe: lib/local/patch.ts runs it in the browser; tests run it on the sample family's statements.
// The check-in keeps its three cards: Save (money path, from ESS/EMG), the latest day in your statements, and one fix.
import type { Dataset } from '@core/types';
import { asOfDate, categoryHi, latestBankBalance, leaks, monthPictures, subscriptionsToConfirm, type Leak } from '@core/finance/picture';
import { inr } from '@core/money';
import { bucketOf, buildSpendsMain } from './spendsMain';
import { cleanMerchant } from './spends';

const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dm = (iso: string) => `${+iso.slice(8, 10)} ${MON3[+iso.slice(5, 7) - 1]}`;
// Hindi twins (D-054, Hindi-first): every English line the screen shows has a `...Hi` sibling; the design picks by variant
const MON_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
const MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_HI = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
const dmHi = (iso: string) => `${+iso.slice(8, 10)} ${MON_HI[+iso.slice(5, 7) - 1]}`;
/** "14 Oct" → "14 अक्टूबर" (the day-month strings the Spends view builds). */
const dmTextHi = (s: string) => s.replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (_, d, m) => `${d} ${MON_HI[MON3.indexOf(m)]}`);
/** Today's date on this phone, in Hindi ("गुरुवार, 15 अक्टूबर"); lib/local/patch.ts uses it too. */
export const dateLineHi = (d: Date) => `${DAYS_HI[d.getDay()]}, ${d.getDate()} ${MON_HI[d.getMonth()]}`;

/** The Hindi of a "What you can change" line from buildSpendsMain (its FIXES carry English only). Leak titles reuse the
 *  engine's titleHi; the rest follow the shapes spendsMain writes. A FIX that already carries titleHi/subHi wins. */
export function fixHi(f: { title: string; sub: string; titleHi?: string; subHi?: string }, lk: Leak[]): { titleHi: string; subHi: string } {
  const T: [RegExp, (...m: string[]) => string][] = [
    [/^(.+) up (\d+)% this month$/, (c, p) => `इस महीने ${categoryHi(c)} पर खर्च ${p}% ज़्यादा`],
    [/^(.+) charged after you cancelled$/, (m) => `${m} ने रद्द करने के बाद भी पैसे काटे`],
    [/^(.+) unused since (.+)$/, (m, mo) => `${m} ${MON_EN.includes(mo) ? MON_HI[MON_EN.indexOf(mo)] + ' से' : 'काफ़ी समय से'} इस्तेमाल नहीं हुआ`],
    [/^(.+) charged twice$/, (m) => `${m} ने दो बार पैसे काटे`],
    [/^(.+) trial became paid$/, (m) => `${m} का ट्रायल अब पेड हो गया`],
    [/^Ask (.+) to match ([\d.]+)%$/, (l, r) => `${l} से ${r}% की दर माँगें`],
  ];
  const S: [RegExp, (...m: string[]) => string][] = [
    [/^Skip 2 orders, save (₹[\d,]+)$/, (a) => `2 ऑर्डर कम करें, ${a} बचाएँ`],
    [/^Spend a little less here, save (₹[\d,]+)$/, (a) => `यहाँ थोड़ा कम खर्च करें, ${a} बचाएँ`],
    [/^Check it was cancelled; ask for it back$/, () => 'पक्का करें कि रद्द हुआ था; पैसे वापस माँगें'],
    [/^(₹[\d,]+) each time · cancel it$/, (a) => `हर बार ${a} · इसे बंद करें`],
    [/^Keep it, or turn off auto-renew first$/, () => 'रखें, या पहले ऑटो-रिन्यू बंद करें'],
    [/^(₹[\d,]+) a month$/, (a) => `हर महीने ${a}`],
    [/^(.*)ask for a refund$/, (d) => `${dmTextHi(d)}रिफ़ंड माँगें`],
    [/^Cancel or ask for a refund$/, () => 'बंद करें या रिफ़ंड माँगें'],
    [/^Taking (.+)’s offer loses (₹[\d,]+) after fees$/, (l, a) => `${l} का ऑफ़र लेने पर फ़ीस के बाद ${a} का नुकसान`],
  ];
  const by = (rules: typeof T, s: string) => { for (const [re, f] of rules) { const m = re.exec(s); if (m) return f(...m.slice(1)); } return s; };
  return { titleHi: f.titleHi ?? lk.find((l) => l.title === f.title)?.titleHi ?? by(T, f.title), subHi: f.subHi ?? by(S, f.sub) };
}
const daysIn = (key: string) => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7), 0)).getUTCDate();

export interface TodayMine {
  mine: true;
  verdictSub: string; verdictSubHi: string;
  dateLine: string; dateLineHi: string; // today's date on this phone (the patch sets it); the asOf date in tests
  inv: boolean;                    // a CAS is on this phone (the patch sets it)
  bill: { amount: number; due: string; dueHi: string; dueIso: string; covered: boolean | null } | null; // the latest card bill, and whether the latest bank balance covers it
  day: { none?: boolean; date: string; label: string; labelHi: string; spent: number; usual: number | null; top: [string, number][]; unsorted: number }; // whole rupees
  fix: { title: string; sub: string; titleHi: string; subHi: string; href: string } | null;
  /** The subscription card (D-052): a finding the statements prove, else one recurring charge to confirm. */
  sub: { merchant: string; kind: 'still_charged' | 'unused' | 'renewal' | 'ask'; title: string; sub: string; titleHi: string; subHi: string } | null;
}

/** Which subscription the "One fix" card asks about: proof first (charged after cancelling, a membership with no orders,
 *  a renewal within 30 days), then the most expensive recurring charge you haven't answered about. */
export function subCard(ds: Dataset): TodayMine['sub'] { return subCardFrom(leaks(ds), subscriptionsToConfirm(ds)); }
export function subCardFrom(lk: Leak[], toConfirm: ReturnType<typeof subscriptionsToConfirm>): TodayMine['sub'] {
  const pick = (k: string) => lk.find((l) => l.kind === k);
  const still = pick('still_charged'), unused = pick('membership_unused'), renew = pick('renewal');
  if (still) return { merchant: still.merchant, kind: 'still_charged', title: still.title, sub: `${inr(still.amount)} went out. Check the cancellation went through, and ask for it back.`,
    titleHi: still.titleHi, subHi: `${inr(still.amount)} कट गए। पक्का करें कि रद्द हुआ था, और पैसे वापस माँगें।` };
  if (unused) return { merchant: unused.merchant, kind: 'unused', title: unused.title, sub: `It costs ${inr(unused.amount)} a month, ${inr(unused.annualCost)} a year. Orders paid from an account you haven’t added won’t show here.`,
    titleHi: unused.titleHi, subHi: `इसका खर्च महीने में ${inr(unused.amount)}, साल में ${inr(unused.annualCost)} है। जो ऑर्डर ऐसे खाते से भरे जो आपने नहीं जोड़ा, वो यहाँ नहीं दिखेंगे।` };
  if (renew) return { merchant: renew.merchant, kind: 'renewal', title: renew.title, sub: 'Refunds after a renewal are often hard to get, so decide before.',
    titleHi: renew.titleHi, subHi: 'रिन्यू होने के बाद रिफ़ंड अक्सर मुश्किल से मिलता है, इसलिए पहले तय कर लें।' };
  const r = toConfirm[0];
  if (!r) return null;
  const per = r.cadence === 'yearly' ? 'a year' : 'a month', perHi = r.cadence === 'yearly' ? 'हर साल' : 'हर महीने';
  return { merchant: r.merchant, kind: 'ask', title: `${inr(r.amount)} ${per} to ${r.merchant}. Still using it?`, sub: `Last charged ${dm(r.lastDate)}. Your bank statement can’t tell if you use it; you can.`,
    titleHi: `${r.merchant} को ${perHi} ${inr(r.amount)}। अभी भी इस्तेमाल करते हैं?`, subHi: `आख़िरी चार्ज ${dmHi(r.lastDate)} को। बैंक स्टेटमेंट से पता नहीं चलता कि आप इसे इस्तेमाल करते हैं या नहीं; यह आप बता सकते हैं।` };
}

export function buildTodayMine(ds: Dataset): TodayMine {
  const asOf = asOfDate(ds);
  if (!ds.txns.length) return { mine: true, verdictSub: 'From your mutual fund statement', verdictSubHi: 'आपके म्यूचुअल फ़ंड स्टेटमेंट से', dateLine: '', dateLineHi: '', inv: false, bill: null, fix: null, sub: null, // a CAS but no bank or card statement yet
    day: { none: true, date: asOf, label: '', labelHi: '', spent: 0, usual: null, top: [], unsorted: 0 } };
  // the most recent day with spending, sorted or not (a day with only an SIP or a transfer says nothing about spending). Unsorted
  // UPI to people and small shops is most of a first-time saver's spending, so it counts (D-076, 29 Oct)
  const spendB = (t: { category?: string }) => { const b = bucketOf(t.category ?? 'Other', 'debit'); return b === 'everyday' || b === 'uncat'; };
  const evDays = ds.txns.filter((t) => t.dir === 'debit' && spendB(t)).map((t) => t.date).sort();
  const day = evDays.at(-1) ?? asOf;
  const onDay = ds.txns.filter((t) => t.date === day && t.dir === 'debit');
  const everyday = onDay.filter((t) => bucketOf(t.category ?? 'Other', 'debit') === 'everyday');
  const byMerchant = new Map<string, number>();
  for (const t of everyday) { const m = cleanMerchant(t.merchant ?? t.desc); byMerchant.set(m, (byMerchant.get(m) ?? 0) + t.amount); }
  const top = [...byMerchant.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m, p]) => [m, Math.round(p / 100)] as [string, number]);
  const unsorted = onDay.filter((t) => bucketOf(t.category ?? 'Other', 'debit') === 'uncat').reduce((s, t) => s + t.amount, 0);
  const spent = everyday.reduce((s, t) => s + t.amount, 0) + unsorted; // the whole day; the card says how much of it is unsorted

  // your average day: everyday spending over the complete months in your statements ÷ their days (null if none yet)
  const complete = monthPictures(ds).filter((p) => p.complete);
  const evTotal = complete.reduce((s, p) => s + ds.txns.filter((t) => t.date.startsWith(p.key) && t.dir === 'debit' && spendB(t)).reduce((a, t) => a + t.amount, 0), 0); // same measure as the day: sorted and unsorted
  const days = complete.reduce((s, p) => s + daysIn(p.key), 0);
  const usual = days ? Math.round(evTotal / days / 100) : null;

  const f = buildSpendsMain(ds, { reportFrom: null }).FIXES[0] as { kind?: string; title: string; sub: string } | undefined;
  const cat = f?.kind === 'pace' ? f.title.split(' up ')[0] : null;
  // the latest card bill, only while it is still ahead of the statements' last day (a bill whose date has passed is history, not a to-do)
  const st = [...ds.cardStatements].filter((c) => c.dueDate && c.dueDate >= asOf).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).at(-1);
  const bank = latestBankBalance(ds);
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return {
    mine: true,
    dateLine: `${DAYS[new Date(asOf + 'T00:00:00Z').getUTCDay()]}, ${dm(asOf)}`, dateLineHi: `${DAYS_HI[new Date(asOf + 'T00:00:00Z').getUTCDay()]}, ${dmHi(asOf)}`, inv: false,
    bill: st ? { amount: Math.round(st.totalDue / 100), due: dm(st.dueDate), dueHi: dmHi(st.dueDate), dueIso: st.dueDate, covered: bank ? bank.balance >= st.totalDue : null } : null,
    verdictSub: `From your statements, up to ${dm(asOf)}`, verdictSubHi: `आपके स्टेटमेंट से, ${dmHi(asOf)} तक`,
    day: { date: day, label: `Your last spending day, ${dm(day)}`, labelHi: `आपके खर्च का आख़िरी दिन, ${dmHi(day)}`, spent: Math.round(spent / 100), usual, top, unsorted: Math.round(unsorted / 100) },
    fix: f ? { title: f.title, sub: f.sub, ...fixHi(f, leaks(ds)), href: cat ? `/spends/category/${encodeURIComponent(cat)}` : '/spends' } : null,
    sub: subCard(ds),
  };
}
