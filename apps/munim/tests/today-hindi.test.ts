import { describe, expect, it, vi } from 'vitest';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { loadDemo } from '@core/demo';
import { emptyDataset } from '@core/types';
import type { Leak } from '@core/finance/picture';
import { buildToday } from '@/lib/views/today';
import { buildTodayMine, subCardFrom, type TodayMine } from '@/lib/views/todayMine';
import { cleanMerchant } from '@/lib/views/spends';

// Today in Hindi (variant "bharat"): every scenario, state, card, sheet and answer reads in Hindi; English is unchanged.
// The design's logic is driven without a browser: useDC is swapped for one that keeps the instance between renders, so a
// case can tap buttons (call the handlers the design returns) or set state, then render again.
const H = vi.hoisted(() => ({ keep: null as any, last: null as any }));
vi.mock('@/ui/dc', async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, useDC: (C: any, props: any) => {
    const inst = H.keep ?? new C(props);
    inst.setState = (p: any) => { inst.state = { ...inst.state, ...(typeof p === 'function' ? p(inst.state, inst.props) : p) }; };
    inst.props = props; H.keep = inst; H.last = inst.renderVals(); return H.last;
  } };
});

type Step = (V: any, inst: any) => void;
interface Case { name: string; props: Record<string, unknown>; steps?: Step[] }
const set = (patch: Record<string, unknown>): Step => (_V, inst) => inst.setState(patch);
const tap = (f: (V: any) => void): Step => (V) => f(V);

const SCEN = ['new', 'day4', 'autopayOn', 'debitFailed', 'sunday', 'salaryDay'];
const BILLS = ['pending', 'dueSoon', 'paid'];
const STEPS = ['buffer', 'debt', 'emergency', 'insurance', 'invest'];
const OFF = ['reasons', 'txns', 'fix', 'category', 'missing', 'fraud', 'done'];
const SHEETS = ['autopay', 'once', 'topup', 'pay', 'debt', 'ins', 'now'];

function sampleCases(): Case[] {
  const out: Case[] = [];
  for (const scenario of SCEN) for (const bills of BILLS) for (const moneyStep of STEPS) out.push({ name: `${scenario}/${bills}/${moneyStep}`, props: { scenario, bills, moneyStep } });
  for (const state of ['loading', 'error', 'empty']) out.push({ name: `state ${state}`, props: { state } });
  for (const offStep of OFF) out.push({ name: `off ${offStep}`, props: { offStep } });
  for (const scenario of ['sunday', 'salaryDay']) out.push({ name: `${scenario} → daily`, props: { scenario }, steps: [tap((V) => V.doDaily())] });
  for (const moneyStep of STEPS) out.push({ name: `why ${moneyStep}`, props: { moneyStep }, steps: [tap((V) => V.openWhy())] });
  for (const scenario of ['new', 'day4']) out.push({ name: `streak ${scenario}`, props: { scenario }, steps: [tap((V) => V.openStreak())] });
  for (const sheet of SHEETS) {
    out.push({ name: `sheet ${sheet}`, props: {}, steps: [set({ sheet })] });
    out.push({ name: `sheet ${sheet} other, bad amount`, props: {}, steps: [set({ sheet, autoOther: true, autoCustom: '5', onceSel: 'other', onceCustom: '5', debtSel: 'other', debtCustom: '5' })] });
    out.push({ name: `sheet ${sheet} other, good amount`, props: {}, steps: [set({ sheet, autoOther: true, autoCustom: '75', onceSel: 'other', onceCustom: '250', debtSel: 'other', debtCustom: '3000' })] });
    out.push({ name: `sheet ${sheet} notified`, props: {}, steps: [set({ sheet, onceSel: 1, debtSel: 0, notified: true })] });
  }
  // the whole check-in, answered every way, then the summary and the review of each answer
  const finish: Step[] = [tap((V) => V.reviewCards()), tap((V) => V.steps[1].go()), tap((V) => V.steps[2].go()), tap((V) => V.backToSummary())];
  out.push({ name: 'new: autopay reserved, looks right, cancel', props: {}, steps: [tap((V) => V.cur.primary()), tap((V) => V.notify()), tap((V) => V.sheetDone()), tap((V) => V.cur.primary()), tap((V) => V.cur.primary()), ...finish, tap((V) => V.reviewCards()), tap((V) => V.changeAnswer())] });
  out.push({ name: 'new: not now, still use it', props: {}, steps: [tap((V) => V.cur.tertiary()), tap((V) => V.cur.primary()), tap((V) => V.cur.secondary()), ...finish] });
  out.push({ name: 'new: save once', props: {}, steps: [tap((V) => V.cur.secondary()), set({ onceSel: 2 }), tap((V) => V.notify()), tap((V) => V.sheetDone()), tap((V) => V.reviewCards())] });
  out.push({ name: 'debt: extra payment', props: { moneyStep: 'debt' }, steps: [tap((V) => V.cur.primary()), set({ debtSel: 1 }), tap((V) => V.notify()), tap((V) => V.sheetDone()), tap((V) => V.reviewCards())] });
  out.push({ name: 'insurance: yes both', props: { moneyStep: 'insurance' }, steps: [tap((V) => V.cur.primary()), tap((V) => V.reviewCards())] });
  out.push({ name: 'insurance: not sure → sheet → done', props: { moneyStep: 'insurance' }, steps: [tap((V) => V.cur.secondary()), tap((V) => V.notify()), tap((V) => V.sheetDone()), tap((V) => V.reviewCards())] });
  out.push({ name: 'invest: opened', props: { moneyStep: 'invest' }, steps: [tap((V) => V.cur.primary()), tap((V) => V.reviewCards())] });
  out.push({ name: 'dueSoon: pay now, remind', props: { bills: 'dueSoon' }, steps: [tap((V) => V.steps[2].go()), tap((V) => V.cur.primary()), tap((V) => V.notify()), tap((V) => V.sheetDone()), tap((V) => V.steps[2].go())] });
  out.push({ name: 'dueSoon: remind tomorrow', props: { bills: 'dueSoon' }, steps: [tap((V) => V.steps[2].go()), tap((V) => V.cur.secondary()), tap((V) => V.steps[2].go())] });
  out.push({ name: 'autopayOn: top-up', props: { scenario: 'autopayOn' }, steps: [tap((V) => V.steps[2].go()), tap((V) => V.openTopup()), tap((V) => V.notify()), tap((V) => V.sheetDone())] });
  out.push({ name: 'autopayOn: not today', props: { scenario: 'autopayOn' }, steps: [tap((V) => V.steps[2].go()), tap((V) => V.dismissTopup())] });
  out.push({ name: 'debitFailed: save now / skip', props: { scenario: 'debitFailed' }, steps: [tap((V) => V.steps[2].go()), tap((V) => V.cur.primary()), set({ sheet: null }), tap((V) => V.cur.secondary()), tap((V) => V.steps[2].go())] });
  out.push({ name: 'hidden + math', props: {}, steps: [tap((V) => V.toggleHidden()), tap((V) => V.toggleMath())] });
  // "Something's off?" journey, every branch
  const off = (steps: Step[]): Step[] => [tap((V) => V.steps[1].go()), tap((V) => V.cur.secondary()), ...steps];
  out.push({ name: 'off: math', props: {}, steps: off([tap((V) => V.toggleOffMath())]) });
  out.push({ name: 'off: category always (work)', props: {}, steps: off([tap((V) => V.off.rows[0].go()), tap((V) => V.off.rows[0].go()), tap((V) => V.off.rows[0].go()), tap((V) => V.offCats[2].pick()), tap((V) => V.applyAlways())]) });
  out.push({ name: 'off: category once', props: {}, steps: off([tap((V) => V.off.rows[0].go()), tap((V) => V.off.rows[1].go()), tap((V) => V.off.rows[0].go()), tap((V) => V.offCats[0].pick()), tap((V) => V.applyOnce()), tap((V) => V.offFinish())]) });
  out.push({ name: 'off: shared → finish', props: {}, steps: off([tap((V) => V.off.rows[0].go()), tap((V) => V.off.rows[0].go()), tap((V) => V.off.rows[1].go()), tap((V) => V.offFinish())]) });
  out.push({ name: 'off: duplicate → undo', props: {}, steps: off([tap((V) => V.off.rows[0].go()), tap((V) => V.off.rows[0].go()), tap((V) => V.off.rows[2].go()), tap((V) => V.offUndo())]) });
  out.push({ name: 'off: fraud from txn', props: {}, steps: off([tap((V) => V.off.rows[0].go()), tap((V) => V.off.rows[0].go()), tap((V) => V.off.rows[3].go()), tap((V) => V.markDisputed())]) });
  out.push({ name: 'off: fraud, any payment', props: {}, steps: off([tap((V) => V.off.rows[2].go())]) });
  out.push({ name: 'off: missing other', props: {}, steps: off([tap((V) => V.off.rows[1].go()), tap((V) => V.offAmts[3].pick()), set({ offAddCustom: '320', offAddAmt: 320 })]) });
  out.push({ name: 'off: missing added', props: {}, steps: off([tap((V) => V.off.rows[1].go()), tap((V) => V.offAmts[1].pick()), tap((V) => V.offAddCats[1].pick()), tap((V) => V.addMissing()), tap((V) => V.offFinish())]) });
  return out;
}

describe('Today in Hindi', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement } = await import('react');
  const Today = (await import('@/screens/Today')).default;
  const { getSession } = await import('@/lib/session');
  const s = await loadDemo();
  const sample = buildToday(s, await getSession(new Request('http://local/')));
  const bankOnly = { ...emptyDataset('b'), accounts: s.accounts.filter((a) => a.kind === 'bank'), txns: s.txns.filter((t) => t.account.startsWith('bank:')) };
  const user = { kind: 'user' as const, memberLabel: 'Me', displayName: 'Asha' };
  const run = (c: Case, variant: string, data: Record<string, unknown>, state?: string) => {
    H.keep = null;
    const props = { theme: 'light', variant, data, ...(state ? { state } : {}), ...c.props };
    let html = renderToStaticMarkup(createElement(Today, props));
    for (const st of c.steps ?? []) { st(H.last, H.keep); html = renderToStaticMarkup(createElement(Today, props)); }
    return html;
  };

  // what a person reads: text nodes plus aria-label / placeholder / title / alt, entities decoded, CSS dropped
  const readable = (html: string) => {
    const h = html.replace(/<style>[\s\S]*?<\/style>/g, ' ');
    const attrs = [...h.matchAll(/\s(?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map((m) => m[1]);
    const text = h.replace(/<[^>]+>/g, ' ');
    return [text, ...attrs].join(' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  };
  const ALLOW = new Set(['SIP', 'EMI', 'UPI', 'FD', 'RD', 'KYC', 'PDF', 'CAS', 'OTP', 'PIN', 'SMS', 'app', 'cybercrime', 'gov', 'in']);
  // names that come from the data (merchants, lenders, banks) stay as they are written on the statement
  const names = new Set<string>(['Zomato', 'YouTube', 'Premium', 'cult', 'fit', 'Rohan', 'Asha', 'R', 'A']); // R, A: the avatar shows the name's first letter
  for (const t of s.txns) for (const w of cleanMerchant(t.merchant ?? t.desc).split(/[^A-Za-z]+/)) if (w) names.add(w);
  for (const l of s.loans) for (const w of l.lender.split(/[^A-Za-z]+/)) if (w) names.add(w);
  for (const o of s.offers) for (const w of o.lender.split(/[^A-Za-z]+/)) if (w) names.add(w);
  const english = (html: string) => [...new Set((readable(html).match(/[A-Za-z]+/g) ?? []).filter((w) => !ALLOW.has(w) && !names.has(w)))];

  const tdCases = (): [string, Record<string, unknown>, string?][] => {
    const td = buildTodayMine(bankOnly);
    const cas = { ...buildTodayMine(emptyDataset('none')), inv: true, dateLine: 'Monday, 1 Jan', dateLineHi: 'सोमवार, 1 जनवरी' };
    const base = { ...buildToday(bankOnly, user), NAME: 'Asha' };
    const withBill = (covered: boolean | null): TodayMine => ({ ...td, inv: true, bill: { amount: 36343, due: '24 Oct', dueHi: '24 अक्टूबर', dueIso: '2026-10-24', covered } });
    return [
      ['mine: bank only', { ...base, TD: td }], ['mine: no name', { ...base, NAME: '', TD: td }],
      ['mine: CAS only', { ...buildToday(emptyDataset('none'), user), NAME: 'Asha', TD: cas }],
      ['mine: bill covered', { ...base, TD: withBill(true) }], ['mine: bill short', { ...base, TD: withBill(false) }], ['mine: bill unknown', { ...base, TD: withBill(null) }],
      ['mine: nothing to fix, no sub', { ...base, TD: { ...td, fix: null, sub: null } }],
      ['mine: nothing that day', { ...base, TD: { ...td, day: { ...td.day, top: [], spent: 0, usual: null, unsorted: 120 } } }],
      ['mine: empty state', { ...base, TD: null }, 'empty'],
      ...SUBS.map((sub) => [`mine: sub ${sub!.kind} ${sub!.merchant}`, { ...base, TD: { ...td, sub } }] as [string, Record<string, unknown>]),
    ];
  };
  const L = (kind: Leak['kind'], merchant: string, title: string, titleHi: string): Leak => ({ kind, merchant, title, titleHi, amount: 19900, annualCost: 238800, evidence: [], actionHint: 'cancel' });
  const SUBS = [
    subCardFrom([L('still_charged', 'Netflix', 'Netflix charged again on 3 Oct, after you decided to cancel', 'Netflix ने रद्द करने के फ़ैसले के बाद 3 अक्टूबर को फिर पैसे काटे')], []),
    subCardFrom([L('membership_unused', 'Swiggy One', 'Swiggy One is active, but no Swiggy orders since 2 Aug', 'Swiggy One चालू है, पर आपके स्टेटमेंट में 2 अगस्त से कोई Swiggy ऑर्डर नहीं')], []),
    subCardFrom([L('renewal', 'Amazon Prime', 'Amazon Prime is due to renew around 2 Nov, for about ₹1,499', 'Amazon Prime लगभग 2 नवंबर को करीब ₹1,499 में रिन्यू होगा')], []),
    subCardFrom([], [{ merchant: 'Spotify', amount: 11900, cadence: 'monthly', lastDate: '2026-10-08' } as never]),
    subCardFrom([], [{ merchant: 'LingoPro', amount: 499900, cadence: 'yearly', lastDate: '2026-09-02' } as never]),
  ];
  for (const w of ['Netflix', 'Swiggy', 'One', 'Amazon', 'Prime', 'Spotify', 'LingoPro']) names.add(w);

  // the same cases, answered on the user's own statements: every handler path on a TD card
  const tdSteps: Case[] = [
    { name: 'answer all', props: {}, steps: [tap((V) => V.cur.tertiary?.()), tap((V) => V.cur.primary()), tap((V) => V.cur.primary()), tap((V) => V.reviewCards()), tap((V) => V.steps[1].go()), tap((V) => V.steps[2].go())] },
    { name: 'sub secondary', props: {}, steps: [tap((V) => V.steps[2].go()), tap((V) => V.cur.secondary()), tap((V) => V.steps[2].go())] },
    { name: 'sub later', props: {}, steps: [tap((V) => V.steps[2].go()), tap((V) => V.cur.tertiary?.() ?? V.cur.secondary()), tap((V) => V.steps[2].go())] },
    { name: 'math', props: {}, steps: [tap((V) => V.toggleMath())] },
  ];

  const ALL = sampleCases();
  const DUMP = process.env.TODAY_DUMP; // regression check while editing: TODAY_DUMP=write|check:<file>
  it('standard: English output', () => {
    const got: Record<string, string> = {};
    for (const c of ALL) got[c.name] = run(c, 'standard', sample);
    for (const [n, d, st] of tdCases()) for (const c of [{ name: '', props: {} } as Case, ...tdSteps]) got[`${n} ${c.name}`] = run(c, 'standard', d, st);
    if (DUMP?.startsWith('write:')) writeFileSync(DUMP.slice(6), JSON.stringify(got));
    if (DUMP?.startsWith('check:') && existsSync(DUMP.slice(6))) {
      const want = JSON.parse(readFileSync(DUMP.slice(6), 'utf8')) as Record<string, string>;
      for (const k of Object.keys(want)) expect(got[k], k).toBe(want[k]);
    }
    const t = readable(got['new/pending/emergency']);
    for (const line of ['Rohan, your money’s okay today', 'Bills covered · spent below a usual day', "Today's check-in", 'Save ₹50 a day, automatically', 'Set up autopay', 'Your big picture · net worth', 'Card bill ₹36,343', 'due 24 Oct', 'Thursday, 15 Oct', 'Today', 'Ask Munim'])
      expect(t).toContain(line);
    expect(readable(got['off reasons'])).toContain("What's off about yesterday?");
    expect(readable(got['why emergency'])).toContain('General guidance, not investment advice.');
    expect(readable(got['mine: bank only '])).toContain('Asha, here’s your money today');
    expect(readable(got['mine: bank only '])).toContain('Step 2: Last day');
    expect(readable(got['mine: bank only '])).toContain('From your statements, up to 15 Oct');
  });

  it('bharat: every scenario, state, card and sheet reads in Hindi', () => {
    const bad: string[] = [];
    for (const c of ALL) { const w = english(run(c, 'bharat', sample)); if (w.length) bad.push(`${c.name}: ${w.join(' ')}`); }
    for (const [n, d, st] of tdCases()) for (const c of [{ name: '', props: {} } as Case, ...tdSteps]) { const w = english(run(c, 'bharat', d, st)); if (w.length) bad.push(`${n} ${c.name}: ${w.join(' ')}`); }
    expect(bad).toEqual([]);
  });

  it('bharat: key lines, numbers unchanged, the Hindi disclaimer', () => {
    const t = readable(run({ name: '', props: {} }, 'bharat', sample));
    for (const line of ['Rohan, आज आपका पैसा ठीक है', 'गुरुवार, 15 अक्टूबर', '₹8,58,754', '₹36,343', 'आज', 'मुनीम से पूछें']) expect(t).toContain(line);
    expect(readable(run({ name: '', props: {}, steps: [tap((V) => V.openWhy())] }, 'bharat', sample))).toContain('सिर्फ़ जानकारी के लिए है, निवेश सलाह नहीं।');
    expect(readable(run({ name: '', props: {}, steps: [set({ sheet: 'ins' })] }, 'bharat', sample))).toContain('सिर्फ़ जानकारी के लिए है, निवेश सलाह नहीं।');
    const td = buildTodayMine(bankOnly);
    const m = readable(run({ name: '', props: {}, steps: [tap((V) => V.steps[1].go())] }, 'bharat', { ...buildToday(bankOnly, user), NAME: 'Asha', TD: td }));
    expect(m).toContain(td.day.labelHi); expect(m).toContain(`₹${td.day.spent.toLocaleString('en-IN')} खर्च`);
  });

  it('view model: Hindi twins for every English line', () => {
    const td = buildTodayMine(bankOnly);
    expect(td.verdictSubHi).toBe('आपके स्टेटमेंट से, 15 अक्टूबर तक');
    expect(td.dateLineHi).toBe('गुरुवार, 15 अक्टूबर');
    expect(td.day.labelHi).toBe('आपके खर्च का आख़िरी दिन, 15 अक्टूबर');
    expect(td.fix).toMatchObject({ titleHi: 'इस महीने फ़ूड डिलीवरी पर खर्च 28% ज़्यादा', subHi: '2 ऑर्डर कम करें, ₹1,094 बचाएँ' });
    expect(buildTodayMine(s).bill?.dueHi).toBe('24 अक्टूबर');
    for (const sub of SUBS) { expect(sub!.titleHi).not.toMatch(/[A-Za-z]{3,}.*[a-z]{3,} [a-z]{3,}/); expect(sub!.subHi).not.toMatch(/\b(the|you|your|it)\b/i); }
  });
});
