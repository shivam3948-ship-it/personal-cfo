// Hindi ("bharat") copy on the Sunday call and Ask Munim: every state reads in Hindi, English stays as it was,
// and the Hindi suggestion chips route to the same offline intents as the English ones.
import { describe, expect, test, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { intentOf } from '@/lib/agent/offline';
import { DISCLAIMER } from '@/lib/advice';

// One logic instance per render target, reachable from the test so we can step through beats and states
// (react-dom/server can't click). Same contract as ui/dc.js useDC.
type Vals = Record<string, () => void>;
type Logic = { state: Record<string, unknown>; props: unknown; setState: (p: Record<string, unknown>) => void; renderVals: () => Vals };
const live: { inst: Logic | null; vals: Vals } = { inst: null, vals: {} };
vi.mock('@/ui/dc', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    useDC: (C: new (p: unknown) => Logic, props: unknown) => {
      if (!live.inst) { const inst = new C(props); inst.setState = (p) => { inst.state = { ...inst.state, ...p }; }; live.inst = inst; }
      live.inst.props = props; live.vals = live.inst.renderVals(); return live.vals;
    },
  };
});

const SundayCall = (await import('@/screens/SundayCall')).default as Screen;
const Ask = (await import('@/screens/Ask')).default as Screen;
const { default: AskLive, CHIPS, CHIPS_HI, UI } = await import('@/ui/AskLive');

const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const attrs = (html: string) => [...html.matchAll(/(?:aria-label|placeholder|title)="([^"]*)"/g)].map((m) => m[1]).join(' ');
// Latin words a Hindi screen may still show: acronyms kept in Latin (style guide), the brand Claude/Sarvam, and names from data.
const ALLOW = new Set(['SIP', 'EMI', 'UPI', 'FD', 'RD', 'KYC', 'PDF', 'CAS', 'OTP', 'SMS', 'AI', 'ACT', 'Fibernet', 'Netflix', 'Orbit', 'Finserv', 'cult', 'fit', 'Sarvam', 'Claude']);
const english = (s: string) => (s.match(/[A-Za-z][A-Za-z']*/g) ?? []).filter((w) => !ALLOW.has(w));

type Screen = (props: Record<string, unknown>) => React.ReactNode;
function render(C: Screen, props: Record<string, unknown>, steps: ((v: Vals, inst: Logic) => void)[] = []) {
  live.inst = null; const out: string[] = [];
  let html = renderToStaticMarkup(createElement(C, props)); out.push(html);
  for (const step of steps) { step(live.vals, live.inst!); html = renderToStaticMarkup(createElement(C, props)); out.push(html); }
  return out;
}
const sundayAll = (variant: string) => [
  ...render(SundayCall, { variant, state: 'ready' }, [(v) => v.toggleMode(), (v) => v.next(), (v) => v.next(), (v) => v.next(), (v) => v.next(), (v) => v.decide()]),
  ...['loading', 'error', 'empty'].flatMap((state) => render(SundayCall, { variant, state })),
];
const askAll = (variant: string) => [
  ...['ready', 'loading', 'error', 'empty'].flatMap((state) => render(Ask, { variant, state })),
  ...render(Ask, { variant, state: 'ready' }, [(_v, i) => i.setState({ step: 'answer' }), (v) => v.toggleMath()]),
];

describe('Sunday call in Hindi', () => {
  const pages = sundayAll('bharat');
  test('every beat and state has no English left (text and aria-labels)', () => {
    for (const h of pages) expect(english(text(h) + ' ' + attrs(h))).toEqual([]);
  });
  test('numbers are untouched and the key lines read in Hindi', () => {
    const all = pages.map(text).join(' ');
    for (const n of ['₹350', '₹750', '₹17,163', '₹7,873', '₹9,290', '₹5,267', '₹5,000', '₹2,200', '₹12,039', '₹1,059', '₹799', '₹10,181', '₹12,78,285', '₹45,078']) expect(all).toContain(n);
    for (const l of ['रविवार की मनी कॉल', '9–15 अक्टूबर का हफ़्ता', 'ऑटोपे से ₹350 की बचत', 'इस हफ़्ते ₹17,163 खर्च', 'मुनीम बोल रहा है · हिंदी', 'फिर कोशिश करें', 'अगले रविवार, 25 अक्टूबर सुबह 9 बजे तैयार', '✓ ठीक है। अगले रविवार मिलते हैं।']) expect(all).toContain(l);
    expect(pages[0]).toContain('lang="hi"');
  });
  test('standard is unchanged', () => {
    const all = sundayAll('standard').map(text).join(' ');
    for (const l of ['Week of 9–15 Oct', 'Sunday Money Call', '1 of 5 · Your win', '₹350 saved on autopay', '7 of 7 days this week. ₹750 since you started on 1 Oct.', 'Good morning, Rohan!',
      '₹17,163 spent this week', 'Subscriptions renewed', '₹12,039 due in 7 days', 'Orbit Finserv EMI · 20 Oct', 'Review your subscriptions?', '✓ Noted. See you next Sunday.',
      'Munim is speaking · English', 'Preparing your call · adding up this week…', "Couldn't connect", "This week's call didn't load", 'Try again', "Read last week's instead",
      'Ready next Sunday, 25 Oct at 9 am', '3 · What\'s coming', "Back to today's check-in", 'Voice note', 'Tap the mic to interrupt and ask anything', 'Read instead', 'Listen', 'Finish']) expect(all).toContain(l);
    expect(english(all).length).toBeGreaterThan(100);
  });
});

describe('Ask Munim design in Hindi', () => {
  const pages = askAll('bharat');
  test('idle, listening, thinking, answer (with the math open) and error have no English left', () => {
    for (const h of pages) expect(english(text(h) + ' ' + attrs(h))).toEqual([]);
  });
  test('numbers are untouched and the answer reads in Hindi', () => {
    const all = pages.map(text).join(' ');
    expect(all).toContain('हाँ। ₹36,343 का कार्ड बिल 24 अक्टूबर को भरना है। आपके बैंक में ₹1,41,764 हैं। सैलरी से पहले के सारे भुगतान के बाद ₹93,083 बचेंगे।');
    for (const l of ['सुन रहा हूँ…', 'लिखकर पूछें', 'हिसाब देखें', 'हिसाब छिपाएँ', 'फिर कोशिश करें', 'मुनीम से पूछें']) expect(all + attrs(pages.join(''))).toContain(l);
  });
  test('standard is unchanged', () => {
    const pagesEn = askAll('standard'); const all = pagesEn.map(text).join(' ');
    for (const l of ['Asking about your money · Rohan', 'Ask anything about your money', 'Speak in Hindi or English. Every answer shows its math.', 'Is my card bill covered?', 'What is cult.fit costing me?',
      'Listening · Hindi or English', 'Checking your bank and bills…', 'Yes. The ₹36,343 card bill is due 24 Oct. Your bank has ₹1,41,764 . After every payment due before salary, ₹93,083 is left.',
      'Show the math', 'Hide the math', 'Bank (SMS alerts, 15 Oct)', 'Remind me on 22 Oct', "Didn't catch that", "Munim couldn't hear you", 'Tap to talk · Type instead', 'Ask another · Type instead']) expect(all).toContain(l);
    expect(pagesEn.join('')).toContain('aria-label="Ask Munim"');
  });
});

describe('Ask Munim live sheet', () => {
  test('Hindi chips route to the same offline intents as the English ones', () => {
    for (const k of Object.keys(CHIPS) as (keyof typeof CHIPS)[]) {
      expect(CHIPS_HI[k].q.map(intentOf)).toEqual(CHIPS[k].q.map(intentOf));
      for (const q of CHIPS_HI[k].q) expect(english(q)).toEqual([]);
    }
  });
  test('the Hindi UI strings carry no English words', () => {
    const flat = (o: Record<string, unknown>) => Object.values(o).map((v) => (typeof v === 'function' ? '' : String(v))).join(' ');
    expect(english(flat(UI.hi))).toEqual([]);
    expect(UI.hi.checked(3, true)).toBe(' · 3 आँकड़े जाँचे गए');
    expect(UI.hi.from('बिल और भुगतान')).toBe('स्रोत: बिल और भुगतान');
  });
  test('renders in Hindi from the profile language, with the Hindi disclaimer', () => {
    const h = renderToStaticMarkup(createElement(AskLive, { hi: true }));
    expect(english(text(h) + ' ' + attrs(h))).toEqual([]);
    expect(text(h)).toContain(DISCLAIMER.guided.hi);
    expect(DISCLAIMER.guided.hi).toBe('सिर्फ़ जानकारी के लिए है, निवेश सलाह नहीं।');
    for (const q of CHIPS_HI.today.q) expect(text(h)).toContain(q);
    expect(text(h)).toContain('सवाल आपके पैसे के बारे में');
  });
  test('English sheet is unchanged', () => {
    const h = text(renderToStaticMarkup(createElement(AskLive, { hi: false })));
    for (const l of ['Asking about your money', 'Ask anything about your money', 'Hindi or English. Every number comes from your own statements.', 'What should I fix first?', DISCLAIMER.guided.en]) expect(h).toContain(l);
  });
});
