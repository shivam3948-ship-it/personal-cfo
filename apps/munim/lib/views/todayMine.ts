// Today on your own statements (D-049): the figures the Today screen needs, from data that lives on the phone.
// Pure and browser-safe: lib/local/patch.ts runs it in the browser; tests run it on the sample family's statements.
// The check-in keeps its three cards: Save (money path, from ESS/EMG), the latest day in your statements, and one fix.
import type { Dataset } from '@core/types';
import { asOfDate, categoryHi, latestBankBalance, leaks, monthPictures, subscriptionsToConfirm, type Leak } from '@core/finance/picture';
import { inr } from '@core/money';
import { bucketOf, buildSpendsMain } from './spendsMain';
import { cleanMerchant } from './spends';
import { cardBills, type CardBill } from '@core/finance/cards';

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
  /** what's left to pay on card bills still ahead (all cards, D-092), and whether the latest bank balance covers it; paidAll when every one is paid */
  bill: { amount: number; due: string; dueHi: string; dueIso: string; covered: boolean | null; count?: number; paidAll?: boolean } | null;
  bills?: ReturnType<typeof billLines>[]; // each card, for the bills sheet
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

export function buildTodayMine(ds: Dataset, today?: string): TodayMine {
  const asOf = asOfDate(ds);
  if (!ds.txns.length) return { mine: true, verdictSub: 'From your mutual fund statement', verdictSubHi: 'आपके म्यूचुअल फ़ंड स्टेटमेंट से', dateLine: '', dateLineHi: '', inv: false, bill: null, fix: null, sub: null, // a CAS but no bank or card statement yet
    day: { none: true, date: asOf, label: '', labelHi: '', spent: 0, usual: null, top: [], unsorted: 0 } };
  // the most recent day with spending, sorted or not (a day with only an SIP or a transfer says nothing about spending). Unsorted
  // UPI to people and small shops is most of a first-time saver's spending, so it counts (D-076, 29 Oct)
  const spendB = (t: { category?: string }) => { const b = bucketOf(t.category ?? 'Other', 'debit'); return b === 'everyday' || b === 'uncat'; };
  const evDays = ds.txns.filter((t) => t.dir === 'debit' && spendB(t)).map((t) => t.date).sort();
  if (!evDays.length) return { mine: true, verdictSub: 'From your statements', verdictSubHi: 'आपके स्टेटमेंट से', dateLine: '', dateLineHi: '', inv: false, bill: null, fix: null, sub: null, // only SIPs or transfers: no spending day to show
    day: { none: true, date: asOf, label: '', labelHi: '', spent: 0, usual: null, top: [], unsorted: 0 } };
  const day = evDays.at(-1)!;
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
  // every card's latest bill (D-092): what's left to pay on the ones still ahead, and each card's state for the bills sheet.
  // Before 8 Nov only the single latest bill showed, so a second card due the same day disappeared.
  const now = today && today > asOf ? today : asOf; // the phone's date, so an old statement's due date isn't shown as ahead
  const all = cardBills(ds, asOf, today).filter((b) => b.dueDate >= now || b.status === 'not_seen' || b.status === 'unknown');
  const open = all.filter((b) => b.dueDate >= now && b.status !== 'paid_full');
  const left = open.reduce((a, b) => a + Math.max(0, b.totalDue - b.paid), 0);
  const bank = latestBankBalance(ds);
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return {
    mine: true,
    dateLine: `${DAYS[new Date(asOf + 'T00:00:00Z').getUTCDay()]}, ${dm(asOf)}`, dateLineHi: `${DAYS_HI[new Date(asOf + 'T00:00:00Z').getUTCDay()]}, ${dmHi(asOf)}`, inv: false,
    bill: open.length ? { amount: Math.round(left / 100), due: dm(open.map((b) => b.dueDate).sort()[0]), dueHi: dmHi(open.map((b) => b.dueDate).sort()[0]), dueIso: open.map((b) => b.dueDate).sort()[0], covered: bank ? bank.balance >= left : null, count: open.length }
      : all.length ? { amount: 0, due: '', dueHi: '', dueIso: '', covered: true, count: 0, paidAll: true } : null,
    bills: all.map((b) => billLines(b, ds.accounts.find((a) => a.id === b.account)?.label)),
    verdictSub: `From your statements, up to ${dm(asOf)}`, verdictSubHi: `आपके स्टेटमेंट से, ${dmHi(asOf)} तक`,
    day: { date: day, label: `Your last spending day, ${dm(day)}`, labelHi: `आपके खर्च का आख़िरी दिन, ${dmHi(day)}`, spent: Math.round(spent / 100), usual, top, unsorted: Math.round(unsorted / 100) },
    fix: f ? { title: f.title, sub: f.sub, ...fixHi(f, leaks(ds)), href: cat ? `/spends/category/${encodeURIComponent(cat)}` : '/spends' } : null,
    sub: subCard(ds),
  };
}

const R = (p: number) => inr(p, 'auto'); // a card bill to the paisa, as printed (₹7,743.55)
/** One card in the bills sheet (D-092): its bill, where it stands, the minimum-only warning, and how much of the limit it uses.
 *  Card rules are said as "most cards" (review, 8 Nov): most Indian cards charge interest on the whole bill when it isn't paid in
 *  full, but not every card's terms are the same. Interest and fees are only mentioned once the due date has passed. */
export function billLines(b: CardBill, label?: string) {
  const name = label ? `${label.replace(/\s*[•·*x]+\s*\d{4}$/i, '')} ••${b.last4}` : `Card ••${b.last4}`;
  const left = Math.max(0, b.totalDue - b.paid);
  const head = { en: `${R(b.totalDue)} · due ${dm(b.dueDate)}`, hi: `${R(b.totalDue)} · आख़िरी तारीख़ ${dmHi(b.dueDate)}` };
  const beforeDue = !b.pastDue;
  const st: Record<CardBill['status'], { en: string; hi: string; warn: boolean }> = {
    due: { en: `Minimum ${R(b.minDue)}. Pay the full ${R(b.totalDue)} by ${dm(b.dueDate)}: on most cards, paying only the minimum means interest on the whole bill, and new purchases stop being interest-free (check your card’s terms).`,
      hi: `कम से कम ${R(b.minDue)}। ${dmHi(b.dueDate)} तक पूरे ${R(b.totalDue)} भरें: ज़्यादातर कार्ड पर सिर्फ़ कम से कम रक़म भरने से पूरे बिल पर ब्याज लगता है, और नई ख़रीद पर ब्याज-मुक्त दिन नहीं मिलते (अपने कार्ड की शर्तें देखें)।`, warn: false },
    paid_min: beforeDue
      ? { en: `${R(b.paid)} paid so far, at least the minimum. Pay the other ${R(left)} by ${dm(b.dueDate)} to avoid interest.`, hi: `अब तक ${R(b.paid)} भरे, न्यूनतम रक़म या उससे ज़्यादा। ब्याज से बचने के लिए ${dmHi(b.dueDate)} तक बाक़ी ${R(left)} भरें।`, warn: false }
        : { en: `You paid ${R(b.paid)}, not the full bill. On most cards interest is now running on the whole bill: pay the other ${R(left)} to stop it (interest already charged shows on the next bill).`,
        hi: `आपने ${R(b.paid)} भरे, पूरा बिल नहीं। ज़्यादातर कार्ड पर अब पूरे बिल पर ब्याज लग रहा है: इसे रोकने के लिए बाक़ी ${R(left)} भरें (लग चुका ब्याज अगले बिल में दिखेगा)।`, warn: true },
    paid_part: beforeDue
      ? { en: `${R(b.paid)} paid so far, less than the ${R(b.minDue)} minimum. Pay at least the minimum by ${dm(b.dueDate)}, and the full ${R(left)} left to avoid interest.`,
        hi: `अब तक ${R(b.paid)} भरे, जो कम से कम ${R(b.minDue)} से कम है। ${dmHi(b.dueDate)} तक कम से कम इतना भरें, और ब्याज से बचने के लिए बाक़ी पूरे ${R(left)}।`, warn: true }
      : { en: `You paid ${R(b.paid)}, less than the ${R(b.minDue)} minimum: a late fee and interest can apply. Pay the other ${R(left)}.`,
        hi: `आपने ${R(b.paid)} भरे, जो कम से कम ${R(b.minDue)} से भी कम है: लेट फ़ीस और ब्याज लग सकता है। बाक़ी ${R(left)} भरें।`, warn: true },
    paid_full: { en: 'Paid in full ✓', hi: 'पूरा भर दिया ✓', warn: false },
    not_seen: { en: `No payment to this card by ${dm(b.dueDate)} in the statements you added. If you paid from another account or an app like CRED, you’re fine; if not, pay it now.`,
      hi: `आपके जोड़े हुए स्टेटमेंट में ${dmHi(b.dueDate)} तक इस कार्ड का भुगतान नहीं दिखा। अगर किसी और खाते या CRED जैसे ऐप से भरा है, तो ठीक है; नहीं तो अभी भरें।`, warn: true },
    unknown: { en: `Your statements end before ${dm(b.dueDate)}, so Munim can’t see whether it was paid. Check that it was.`,
      hi: `आपके स्टेटमेंट ${dmHi(b.dueDate)} से पहले ख़त्म होते हैं, इसलिए दिख नहीं रहा कि भरा या नहीं। एक बार देख लें।`, warn: false },
  };
  const s = st[b.status];
  const used = b.usedPct !== undefined && b.limit ? { en: `This bill uses ${b.usedPct}% of your ${R(b.limit)} limit${b.usedPct > 30 ? ': a common rule of thumb is that above 30% can lower your credit score' : ''}`,
    hi: `यह बिल आपकी ${R(b.limit)} की लिमिट का ${b.usedPct}% है${b.usedPct > 30 ? ': आमतौर पर माना जाता है कि 30% से ज़्यादा इस्तेमाल से क्रेडिट स्कोर घट सकता है' : ''}` } : { en: 'Munim couldn’t read the credit limit from this statement', hi: 'मुनीम इस स्टेटमेंट से क्रेडिट लिमिट नहीं पढ़ पाया' };
  return { name, head: head.en, headHi: head.hi, line: s.en, lineHi: s.hi, warn: s.warn, used: used.en, usedHi: used.hi, status: b.status };
}
