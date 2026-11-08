'use client';
// Ask Munim, live: typed questions answered by /api/ask from the engine's figures. Same sheet, tokens and type as designs/Voice.
// Context-aware: the screen you came from (?from= or the referrer) picks the suggested questions.
// Voice: mic → /api/stt (Sarvam) or the browser's speech recognition, after a one-time note on where the audio goes.
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { send, usageInstall, usageOff } from '@/lib/telemetry';
import { answerProps } from '@/lib/telemetryCore';
import { askLocal } from '@/lib/local/askLocal';
import { DISCLAIMER } from '@/lib/advice';
import { getProfile } from '@/lib/local/profile';
import { redact } from '@core/privacy/redact';
import { disclaimerLast, forSpeech, splitForSpeech } from '@core/agent/lang';
import { doneNote, type Action } from '@/lib/actionsCore';
import { record, browserListen, browserSttAvailable, speakPieces, stopSpeaking, unlockAudio, playBase64, watchForSpeech, type Audio64, type CutInWatch, type RecorderHandle, type Recording } from '@/ui/voice';
import { turnCost } from '@/lib/cost';
import type { CutIn, TurnRecord } from '@/lib/turnLog';

// Latency sprint: the moment you stop talking, a short spoken acknowledgement plays while Munim hears and answers, so the
// first sound comes in about a second instead of after the whole answer. Voiced once per language and reused.
const ACK = { hi: 'एक सेकंड, देख रहा हूँ।', en: 'One second, let me check.' } as const;
const ackCache = new Map<'hi' | 'en', Promise<Audio64 | null>>();
type Msg = { role: 'user' | 'assistant'; content: string; spoken?: string; done?: string; meta?: { checked: number; ok: boolean; tools: string[]; engine: string; id?: string }; lat?: Lat };
/** Seconds-level timings of one voice turn (D-058): hearing (speech to text), answering, and until the first word is heard. */
type Lat = { stt?: number; agent: number; speak?: number; cut?: { need: number; peak: number; how: CutIn['how'] } };
type SttTiming = { mode: 'server' | 'browser'; ms?: number; audioMs?: number };
const sec = (ms: number, hi = false) => `${(ms / 1000).toFixed(1)} ${hi ? 'सेकंड' : 's'}`;
type Why = 'wrong_number' | 'not_answered' | 'hard_to_follow';
const WHY: Why[] = ['wrong_number', 'not_answered', 'hard_to_follow'];
type Ctx = 'xray' | 'invest' | 'spends' | 'credit' | 'today';

export const CHIPS: Record<Ctx, { label: string; q: string[] }> = {
  xray: { label: 'your funds', q: ['What do regular plans cost me?', 'How much can I book tax-free this year?', 'Are my funds beating an FD?'] },
  invest: { label: 'your savings', q: ['How big is my safety net?', 'How are my funds doing?', 'Is my term cover enough?'] },
  spends: { label: 'your spending', q: ['Where is my money going?', 'Which subscriptions should I cut?', 'Anything unusual this month?'] },
  credit: { label: 'your credit', q: ['What changed in my credit score?', 'Can I get a better rate on my loan?', 'Should I prepay my car loan?'] },
  today: { label: 'your money', q: ['What should I fix first?', 'मेरा पैसा कहाँ जा रहा है?', 'What bills are due before salary?'] },
};
// Hindi chips keep each English chip's intent (lib/agent/offline.ts INTENTS), so the offline answers route the same way.
// Labels are oblique ("आपके पैसे") because they sit before "के बारे में".
export const CHIPS_HI: Record<Ctx, { label: string; q: string[] }> = {
  xray: { label: 'आपके फ़ंड', q: ['रेगुलर प्लान में मेरा कितना खर्च होता है?', 'इस साल कितना मुनाफ़ा टैक्स-फ़्री मिल सकता है?', 'क्या मेरे फ़ंड FD से अच्छा कर रहे हैं?'] },
  invest: { label: 'आपकी बचत', q: ['मेरा इमरजेंसी फ़ंड कितना बड़ा है?', 'मेरे फ़ंड कैसे चल रहे हैं?', 'क्या मेरा टर्म बीमा काफ़ी है?'] },
  spends: { label: 'आपके खर्च', q: ['मेरा पैसा कहाँ जा रहा है?', 'कौन से सब्सक्रिप्शन बंद करूँ?', 'इस महीने कुछ अजीब खर्च तो नहीं?'] },
  credit: { label: 'आपके क्रेडिट', q: ['मेरा क्रेडिट स्कोर क्यों बदला?', 'क्या मेरे लोन पर ब्याज कम हो सकता है?', 'क्या कार लोन पहले चुका दूँ?'] },
  today: { label: 'आपके पैसे', q: ['सबसे पहले क्या ठीक करूँ?', 'मेरा पैसा कहाँ जा रहा है?', 'सैलरी से पहले कौन से बिल आने वाले हैं?'] },
};
const TOOL_LABEL_HI: Record<string, string> = {
  portfolio_xray: 'आपका फ़ंड स्टेटमेंट', emergency_fund: 'बैंक बैलेंस और ज़रूरी खर्च', money_overview: 'बैंक और कार्ड स्टेटमेंट', spending_breakdown: 'बैंक और कार्ड स्टेटमेंट',
  sunday_briefing: 'इस हफ़्ते का हिसाब', subscriptions_and_leaks: 'कार्ड और बैंक स्टेटमेंट', unusual_spending: 'बैंक और कार्ड स्टेटमेंट', upcoming_dues: 'बिल और भुगतान',
  loans_overview: 'लोन के कागज़', simulate_prepayment: 'लोन के कागज़', loan_negotiation: 'लोन के कागज़ और ऑफ़र', insurance_overview: 'बीमा पॉलिसी', claim_helper: 'बीमा पॉलिसी',
  credit_health: 'क्रेडिट रिपोर्ट', search_documents: 'आपके दस्तावेज़', advice_plan: 'आपके सारे दस्तावेज़',
  create_reminder: 'एक रिमाइंडर', draft_email: 'एक ईमेल ड्राफ़्ट', create_savings_goal: 'एक लक्ष्य', save_prepayment_plan: 'लोन जल्दी चुकाने का प्लान',
};
/** The sheet's own words (not the answers, which follow the question's language). Picked by the profile language. */
export const UI = {
  en: {
    dialog: 'Ask Munim', asking: (what: string) => <>Asking about <b style={{ color: 'var(--ink2)', fontWeight: 600 }}>{what}</b></>, test: 'Test mode', close: 'Close',
    title: 'Ask anything about your money', sub: 'Hindi or English. Every number comes from your own statements.',
    listen: 'Listen', stop: 'Stop', listenAria: 'Listen to this answer', stopAria: 'Stop reading this answer',
    from: (s: string) => `From ${s}`, general: 'General help', yourDocs: 'your documents',
    checked: (n: number, ok: boolean) => ` · ${n} number${n > 1 ? 's' : ''} ${ok ? 'checked' : 'could not be checked'}`, rules: 'rules, no AI', byClaude: 'AI (Claude)',
    busy: 'Checking your statements…', retry: 'Retry',
    noAnswer: 'Munim could not answer just now.', notCaught: 'Didn’t catch that. Try again or type.',
    noMic: 'Couldn’t use the microphone. Allow it in the browser, or type.', noBrowserVoice: 'Voice typing isn’t working in this browser right now. Type instead.',
    sttBusy: 'Voice service is busy, so your browser will listen instead. Tap the mic again.',
    consentAria: 'Turn on voice', consent: 'Your voice is turned into text by a speech service (Sarvam, or your browser’s). Munim doesn’t keep the recording. After each answer the mic turns on again by itself. While Munim speaks, your phone keeps the last 2 seconds of sound on the phone so you can interrupt; your words are sent only when you do. Tap ■ to stop.',
    talkHint: 'Listening… just talk. Tap ■ to end.', interruptHint: 'Talk or tap to interrupt.', cutInTap: 'Tap to talk', ownerLog: 'Owner log on', ownerLogTip: 'This browser keeps every question and answer in the owner’s log (names removed)', talkEnded: 'Conversation ended. Tap the mic to talk again.', endTalk: 'End the conversation',
    micOn: 'Turn on mic', type: 'Type instead', label: 'Your question', listening: 'Listening… Hindi or English', hearing: 'Turning it into text…',
    aiOff: 'AI off', placeholder: 'Ask, or tap the mic', send: 'Ask', stopSend: 'Stop and send', speak: 'Speak your question',
    lat: (l: Lat) => `Voice: ${[l.stt !== undefined ? `hearing ${sec(l.stt)}` : '', `answer ${sec(l.agent)}`, l.speak !== undefined ? `first word ${sec(l.speak)}` : '', l.cut ? `cut-in ${l.cut.how === 'voice' ? 'heard you' : l.cut.how === 'tap' ? 'by tap' : 'not used'}: bar ${l.cut.need}, loudest ${l.cut.peak}` : ''].filter(Boolean).join(' · ')}`,
    helped: 'Did this help?', up: 'Yes, it helped', down: 'No, it didn’t help', whatWrong: 'What went wrong?', thanks: 'Thanks. This helps Munim get better.',
    why: { wrong_number: 'A number looks wrong', not_answered: 'Didn’t answer my question', hard_to_follow: 'Hard to follow' } as Record<Why, string>,
  },
  hi: {
    dialog: 'मुनीम से पूछें', asking: (what: string) => <>सवाल <b style={{ color: 'var(--ink2)', fontWeight: 600 }}>{what}</b> के बारे में</>, test: 'टेस्ट मोड', close: 'बंद करें',
    title: 'अपने पैसे के बारे में कुछ भी पूछें', sub: 'हिंदी या अंग्रेज़ी में। हर आँकड़ा आपके अपने स्टेटमेंट से आता है।',
    listen: 'सुनें', stop: 'रोकें', listenAria: 'यह जवाब सुनें', stopAria: 'यह जवाब सुनाना रोकें',
    from: (s: string) => `स्रोत: ${s}`, general: 'आम जानकारी', yourDocs: 'आपके दस्तावेज़',
    checked: (n: number, ok: boolean) => ` · ${n} ${n > 1 ? 'आँकड़े' : 'आँकड़ा'} ${ok ? (n > 1 ? 'जाँचे गए' : 'जाँचा गया') : 'जाँच नहीं हो पाई'}`, rules: 'नियम, AI नहीं', byClaude: 'AI (क्लॉड)',
    busy: 'आपके स्टेटमेंट देख रहा हूँ…', retry: 'फिर कोशिश करें',
    noAnswer: 'मुनीम अभी जवाब नहीं दे पाया। फिर कोशिश करें।', notCaught: 'सुनाई नहीं दिया। फिर कोशिश करें या लिखकर पूछें।',
    noMic: 'माइक नहीं चल पाया। ब्राउज़र में माइक की इजाज़त दें, या लिखकर पूछें।', noBrowserVoice: 'इस ब्राउज़र में अभी बोलकर पूछना काम नहीं कर रहा। लिखकर पूछें।',
    sttBusy: 'आवाज़ वाली सर्विस अभी व्यस्त है, इसलिए अब आपका ब्राउज़र सुनेगा। माइक फिर से दबाएँ।',
    consentAria: 'आवाज़ चालू करें', consent: 'आपकी आवाज़ एक स्पीच सर्विस (Sarvam, या आपका ब्राउज़र) लिखे हुए शब्दों में बदलती है। मुनीम रिकॉर्डिंग नहीं रखता। हर जवाब के बाद माइक अपने-आप फिर चालू होता है। मुनीम के बोलते समय आपका फ़ोन आख़िरी 2 सेकंड की आवाज़ फ़ोन पर ही रखता है ताकि आप बीच में बोल सकें; आपकी बात तभी भेजी जाती है जब आप बीच में बोलें। रोकने के लिए ■ दबाएँ।',
    talkHint: 'सुन रहा हूँ… बस बोलिए। ख़त्म करने के लिए ■ दबाएँ।', interruptHint: 'बीच में बोलकर या टैप करके रोक सकते हैं।', cutInTap: 'बोलने के लिए टैप करें', ownerLog: 'मालिक का लॉग चालू', ownerLogTip: 'यह ब्राउज़र हर सवाल-जवाब मालिक के लॉग में रखता है (नाम हटाकर)', talkEnded: 'बातचीत ख़त्म हुई। फिर बात करने के लिए माइक दबाएँ।', endTalk: 'बातचीत ख़त्म करें',
    micOn: 'माइक चालू करें', type: 'लिखकर पूछें', label: 'आपका सवाल', listening: 'सुन रहा हूँ… हिंदी या अंग्रेज़ी', hearing: 'आपकी बात लिख रहा हूँ…',
    aiOff: 'एआई बंद', placeholder: 'पूछें, या माइक दबाएँ', send: 'पूछें', stopSend: 'रोकें और भेजें', speak: 'बोलकर पूछें',
    lat: (l: Lat) => `आवाज़: ${[l.stt !== undefined ? `सुनना ${sec(l.stt, true)}` : '', `जवाब ${sec(l.agent, true)}`, l.speak !== undefined ? `पहला शब्द ${sec(l.speak, true)}` : '', l.cut ? `बीच में बोलना ${l.cut.how === 'voice' ? 'सुना' : l.cut.how === 'tap' ? 'टैप से' : 'नहीं'}: सीमा ${l.cut.need}, सबसे ऊँचा ${l.cut.peak}` : ''].filter(Boolean).join(' · ')}`,
    helped: 'क्या इससे मदद मिली?', up: 'हाँ, मदद मिली', down: 'नहीं, मदद नहीं मिली', whatWrong: 'क्या गड़बड़ हुई?', thanks: 'धन्यवाद। इससे मुनीम बेहतर बनता है।',
    why: { wrong_number: 'कोई आँकड़ा गलत लगता है', not_answered: 'मेरे सवाल का जवाब नहीं मिला', hard_to_follow: 'समझना मुश्किल था' } as Record<Why, string>,
  },
};

const TOOL_LABEL: Record<string, string> = {
  portfolio_xray: 'your fund statement', emergency_fund: 'bank balance and essentials', money_overview: 'bank and card statements', spending_breakdown: 'bank and card statements',
  sunday_briefing: 'this week’s money', subscriptions_and_leaks: 'card and bank statements', unusual_spending: 'bank and card statements', upcoming_dues: 'bills and dues',
  loans_overview: 'loan papers', simulate_prepayment: 'loan papers', loan_negotiation: 'loan papers and offers', insurance_overview: 'insurance policies', claim_helper: 'insurance policies',
  credit_health: 'credit report', search_documents: 'your documents', advice_plan: 'all your documents',
  create_reminder: 'a reminder', draft_email: 'a draft email', create_savings_goal: 'a goal', save_prepayment_plan: 'a prepayment plan',
};

function ctxOf(): { ctx: Ctx; back: string } {
  const from = new URLSearchParams(location.search).get('from');
  let path = from ?? '';
  if (!path && document.referrer) { try { const u = new URL(document.referrer); if (u.origin === location.origin) path = u.pathname; } catch { /* ignore */ } }
  const ctx: Ctx = path.startsWith('/invest/xray') ? 'xray' : path.startsWith('/invest') ? 'invest' : path.startsWith('/spends') ? 'spends' : path.startsWith('/credit') ? 'credit' : 'today';
  return { ctx, back: path.startsWith('/') && !path.startsWith('//') ? path : '/' };
}

/** `local`: answer from your own statements on this phone (D-050) instead of the sample family on the server.
 *  `hi`: the sheet in Hindi; when not given it follows the profile language (lib/local/profile.ts). */
export default function AskLive({ local = false, hi: hiProp }: { local?: boolean; hi?: boolean }) {
  const [hiProfile, setHiProfile] = useState(false);
  useEffect(() => { if (hiProp === undefined) setHiProfile(getProfile()?.lang === 'hi'); }, [hiProp]);
  const hi = hiProp ?? hiProfile;
  const t = hi ? UI.hi : UI.en;
  const [{ ctx, back }, setCtx] = useState<{ ctx: Ctx; back: string }>({ ctx: 'today', back: '/' });
  const chips = (hi ? CHIPS_HI : CHIPS)[ctx];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // disclaimer comes from the server (it depends on the session's advice mode); the safe wording shows until it arrives
  const [disc, setDisc] = useState<{ en: string; hi: string; test: boolean }>({ ...DISCLAIMER.guided, test: false});
  // voice: idle → (consent once) → listening → hearing (speech to text) → the question is sent like a typed one
  const [voice, setVoice] = useState<'idle' | 'consent' | 'listening' | 'hearing'>('idle');
  const [level, setLevel] = useState(0);
  // hands-free conversation (D-082): one tap starts it; Munim listens again after each answer, you can talk over it, and
  // it ends on a tap or after 8 s with nobody speaking. No push-to-talk per question.
  const [talk, setTalk] = useState(false); const talkRef = useRef(false);
  const setTalkOn = (v: boolean) => { talkRef.current = v; setTalk(v); };
  const [heard, setHeard] = useState('');
  const [sttMode, setSttMode] = useState<'server' | 'browser'>('server');
  const [note, setNote] = useState<string | null>(null); // neutral info (not an error)
  const [speaking, setSpeaking] = useState<number | null>(null); // which answer is being read aloud
  // thumbs up or down per answer (D-057): only the vote, a reason from a fixed list and the answer's random id are sent
  const [votes, setVotes] = useState<Record<number, { vote: 'up' | 'down'; why?: Why }>>({});
  const [canVote, setCanVote] = useState(false);
  const [aiOff, setAiOff] = useState(false); // the no-model version (D-062): rules engine + browser voice
  useEffect(() => { fetch('/api/ai', { cache: 'no-store' }).then((r) => r.json()).then((j) => setAiOff(j.chat === 'rules' && j.stt === 'browser' && j.tts === 'browser')).catch(() => {}); }, []);
  useEffect(() => { setCanVote(!usageOff()); }, []);
  // the owner's turn log (D-089): only a browser marked with #owner=<key> sends whole turns; the server checks the cookie too
  // and not when usage counts are off, or the browser asks sites not to track (Global Privacy Control, Do Not Track)
  const ownerRef = useRef(false); const [ownerLog, setOwnerLog] = useState(false);
  useEffect(() => { if (usageOff()) return; fetch('/api/owner', { cache: 'no-store' }).then((r) => r.json()).then((j) => { ownerRef.current = j.owner === true; setOwnerLog(j.owner === true); }).catch(() => {}); }, []);
  const turnsRef = useRef(new Map<string, TurnRecord>());
  const tapCut = useRef(false); // the user tapped "Tap to talk" over the answer playing now
  const costOf = (t: TurnRecord) => turnCost({ model: t.model, llm: t.tokens, judgeModel: t.judge?.model, judge: t.judge, sttMs: t.stt === 'server' ? t.ms.audio : 0, ttsChars: t.ttsChars });
  function logTurn(t: TurnRecord) {
    t = { ...t, cost: costOf(t) }; turnsRef.current.set(t.id, t);
    if (ownerRef.current && !usageOff()) void fetch('/api/turns', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify(t) }).catch(() => {});
  }
  function vote(i: number, id: string | undefined, v: 'up' | 'down', why?: Why) {
    setVotes((cur) => ({ ...cur, [i]: { vote: v, why } }));
    if (id) send('feedback', { id, vote: v, ...(why ? { reason: why } : {}), data: local ? 'mine' : 'sample' });
    const prev = id ? turnsRef.current.get(id) : undefined; if (prev) logTurn({ ...prev, vote: v, reason: why });
  }
  const rec = useRef<RecorderHandle | { stop: () => void } | null>(null);
  const msgsRef = useRef(msgs); msgsRef.current = msgs;
  const busyRef = useRef(busy); busyRef.current = busy;
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { const c = ctxOf(); setCtx(c); track('ask_opened', { ctx: c.ctx }); }, []);
  // on your own data it's guided whatever the test switch says (no fund picks, the SEBI line): AGENTS.md rule 1, D-050
  useEffect(() => { if (local) { setDisc({ ...DISCLAIMER.guided, test: false }); fetch('/api/advice', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.advice === true) setDisc({ ...DISCLAIMER.private, test: false }); }).catch(() => {}); return; } // own data: advice mode only if the server says this browser is unlocked (D-066)
    fetch('/api/ask', { cache: 'no-store' }).then((r) => r.json()).then((j) => j.disclaimer && setDisc({ ...j.disclaimer, test: !!j.testMode })).catch(() => {}); }, [local]);
  const hiLast = [...msgs].reverse().find((m) => m.role === 'assistant' && /[\u0900-\u097F]/.test(m.content));
  useEffect(() => { fetch('/api/stt', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (!j.configured && browserSttAvailable()) setSttMode('browser'); }).catch(() => {}); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  const ttsOff = useRef(false); // after one 501 (no voice key) this visit uses the browser's voice
  const ackOk = useRef(false);
  async function ask(q: string, via: 'text' | 'voice' = 'text', stt?: SttTiming) {
    q = q.trim(); if (!q || busyRef.current) { ackOk.current = false; return; }
    if (via === 'text' && talkRef.current) setTalkOn(false); // typing ends a hands-free conversation
    const next: Msg[] = [...msgsRef.current, { role: 'user', content: q }];
    stopSpeaking(); setSpeaking(null);
    setMsgs(next); setText(''); setBusy(true); setErr(null);
    track('ask_sent', { ctx, turn: next.filter((m) => m.role === 'user').length, via });
    try {
      const t0 = performance.now();
      const turns = next.map(({ role, content, done }) => ({ role, content: done ? `${content}\n\n${done}` : content })); // what Munim already saved travels with its answer
      const j: { answer: string; spoken?: string; check?: { checked: number; ok: boolean; unverified?: string[] }; tools?: string[]; engine: string; trace?: string; model?: string; prompt?: string; ms?: number; lang?: string; where?: string; fallback?: boolean; repaired?: boolean; mode?: string; guard?: string; guardMs?: number; actions?: Action[]; llm?: TurnRecord['tokens']; judge?: TurnRecord['judge']; log?: { question: string; answer: string } } = local ? await askLocal(turns, via === 'voice' ? 'voice' : 'typed') : await (async () => {
        const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: turns, install: await usageInstall() ?? undefined, via: via === 'voice' ? 'voice' : 'typed', ...(/(?:^|;\s*)munim_prefetch=on(?:;|$)/.test(document.cookie) ? { prefetch: true } : {}) }) });
        const x = await r.json(); if (!r.ok) throw new Error(hi ? t.noAnswer : x.error ?? t.noAnswer); return x;
      })();
      const agentMs = Math.round(performance.now() - t0);
      if (local && j.mode) setDisc({ ...(j.mode === 'private' ? DISCLAIMER.private : DISCLAIMER.guided), test: false }); // the line matches the mode the answer was given in
      setMsgs([...next, { role: 'assistant', content: j.answer, spoken: j.spoken, done: doneNote(j.actions) || undefined, meta: { checked: j.check?.checked ?? 0, ok: !!j.check?.ok, tools: j.tools ?? [], engine: j.engine, id: j.trace }, ...(via === 'voice' ? { lat: { stt: stt?.ms, agent: agentMs } } : {}) }]);
      // metadata only: which tools ran, how long, whether the numbers checked out. Never the question or the answer.
      if (j.trace) send('answer', answerProps({ id: j.trace, engine: j.engine, model: j.model, prompt: j.prompt ?? 'unknown', tools: j.tools ?? [], ms: j.ms ?? 0,
        check: { ok: !!j.check?.ok, checked: j.check?.checked ?? 0, unverified: j.check?.unverified ?? [] }, lang: j.lang ?? (hi ? 'hi' : 'en'), data: local ? 'mine' : 'sample', where: j.where ?? 'server', fallback: j.fallback, repaired: j.repaired, guard: j.guard, guardMs: j.guardMs }));
      if (j.trace && (!local || j.log)) { // the turn as the owner's log keeps it; on your own data only askLocal's scrubbed text (D-089)
        logTurn({ id: j.trace, at: new Date().toISOString(), data: local ? 'mine' : 'sample', via: via === 'voice' ? 'voice' : 'typed', lang: j.lang === 'hi' || j.lang === 'en' ? j.lang : hi ? 'hi' : 'en',
          question: local ? j.log!.question : q, answer: local ? j.log!.answer : j.answer, engine: j.engine, ...(j.model ? { model: j.model } : {}), ...(j.prompt ? { prompt: j.prompt } : {}), tools: j.tools ?? [],
          check: { ok: !!j.check?.ok, checked: j.check?.checked ?? 0, unverified: j.check?.unverified?.length ?? 0 }, repaired: j.repaired, fallback: j.fallback, guard: j.guard,
          ms: { agent: agentMs, ...(stt?.ms !== undefined ? { stt: stt.ms } : {}), ...(stt?.audioMs ? { audio: stt.audioMs } : {}) }, ...(stt ? { stt: stt.mode } : {}), ...(j.llm ? { tokens: j.llm } : {}), ...(j.judge ? { judge: j.judge } : {}) });
      }
      if (via === 'voice') listen(j.spoken ?? j.answer, next.length, 'auto', { stt, agentMs, id: j.trace, lang: j.lang }); // asked by voice → answered by voice; typed → stays quiet
    } catch (e) { ackOk.current = false; setTalkOn(false); setErr(hi ? t.noAnswer : (e as Error).message); setMsgs(next); }
    finally { setBusy(false); input.current?.focus(); }
  }
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user')?.content;
  const startVoiceRef = useRef<() => Promise<void>>(async () => {});

  const consented = () => { try { return sessionStorage.getItem('munim_voice_ok') === '1'; } catch { return false; } };
  function endTalk(quiet: boolean) {
    setTalkOn(false);
    const h = rec.current as (RecorderHandle | { stop: () => void } | null); rec.current = null;
    if (h && 'cancel' in h) h.cancel(); else h?.stop();
    stopSpeaking(); setSpeaking(null); setVoice('idle'); setLevel(0); ackOk.current = false;
    setNote(quiet ? t.talkEnded : null);
  }
  /** One recorded turn (pushed, hands-free, or cut in over an answer): the acknowledgement plays, the audio becomes text, the text is asked. */
  async function heardRec(r: Recording | null, ackLang: 'hi' | 'en') {
    if (!r) { setVoice('idle'); return; }
    setVoice('hearing');
    ackOk.current = true; // the answer's own voice turns this off, so a late acknowledgement never talks over it
    void ackCache.get(ackLang)?.then((a) => { if (a && ackOk.current) void playBase64(a.audioBase64, a.mime); });
    const tEnd = performance.now(); // speech ended: hearing time runs from here to the transcript
    try {
      const form = new FormData(); form.append('file', r.blob, r.mime.includes('wav') ? 'speech.wav' : 'speech.webm'); form.append('lang', 'auto');
      const res = await fetch('/api/stt', { method: 'POST', body: form }); const j = await res.json();
      if (res.ok && j.transcript) { setVoice('idle'); ask(j.transcript, 'voice', { mode: 'server', ms: Math.round(performance.now() - tEnd), audioMs: r.ms }); return; }
      ackOk.current = false; // no transcript: nothing to acknowledge
      setTalkOn(false);
      if (j.fallback === 'browser' && browserSttAvailable()) { setSttMode('browser'); setVoice('idle'); setNote(t.sttBusy); return; }
      setVoice('idle'); setErr(hi ? t.notCaught : j.error ?? t.notCaught);
    } catch { ackOk.current = false; setTalkOn(false); setVoice('idle'); setErr(t.notCaught); }
  }
  async function startVoice() {
    if (voice === 'listening' && !talkRef.current) { rec.current?.stop(); return; }
    if (busyRef.current || voice === 'hearing') return;
    if (!consented()) { setVoice('consent'); return; }
    stopSpeaking(); setSpeaking(null); unlockAudio(); setErr(null); setNote(null); setHeard('');
    track('voice_started', { ctx, mode: sttMode, talk: talkRef.current });
    setTalkOn(true);
    const tt = t;
    if (sttMode === 'browser') {
      setVoice('listening');
      rec.current = browserListen(hiLast ? 'hi' : 'en', (t) => setHeard(t), (t) => { setVoice('idle'); rec.current = null; if (t) ask(t, 'voice', { mode: 'browser' }); else if (talkRef.current) endTalk(true); else setErr(tt.notCaught); },
        (e) => { setVoice('idle'); rec.current = null; if (e === 'no-speech' && talkRef.current) { endTalk(true); return; } setTalkOn(false);
          setErr(/not-allowed|service-not-allowed|audio-capture/.test(e) ? tt.noMic : e === 'no-speech' ? tt.notCaught : tt.noBrowserVoice); });
      return;
    }
    const ackLang: 'hi' | 'en' = hi ? 'hi' : 'en';
    if (!ackCache.has(ackLang)) ackCache.set(ackLang, tts(ACK[ackLang], ackLang).catch(() => null)); // voiced while you speak
    try {
      setVoice('listening');
      const h = await record({ onLevel: setLevel, silenceMs: 1000, noSpeechMs: 8000, onNoSpeech: () => endTalk(true), onDone: (r) => { rec.current = null; void heardRec(r, ackLang); } });
      if (!talkRef.current) { h.cancel(); setVoice('idle'); return; } // ended while the mic was starting: never record with nothing on screen
      rec.current = h;
    } catch { setTalkOn(false); setVoice('idle'); setErr(t.noMic); }
  }
  startVoiceRef.current = startVoice; // the newest one, for the hands-free loop
  const endTalkRef = useRef(endTalk); endTalkRef.current = endTalk;
  // the mic never stays on behind your back: leaving the sheet or switching away from the tab ends the conversation
  useEffect(() => {
    const away = () => { if (document.hidden && talkRef.current) endTalkRef.current(false); };
    document.addEventListener('visibilitychange', away);
    return () => { document.removeEventListener('visibilitychange', away); if (talkRef.current) endTalkRef.current(false); };
  }, []);
  async function tts(piece: string, lang: 'hi' | 'en'): Promise<Audio64 | null> {
    if (ttsOff.current) return null;
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: piece, lang }) });
    if (r.status === 501) { ttsOff.current = true; return null; }
    const j = await r.json().catch(() => ({}));
    return r.ok && j.audioBase64 ? { audioBase64: j.audioBase64, mime: j.mime } : null;
  }
  async function listen(textToSay: string, idx: number, how: 'tap' | 'auto' = 'tap', turn?: { stt?: SttTiming; agentMs: number; id?: string; lang?: string }) {
    ackOk.current = false;
    if (speaking === idx) { stopSpeaking(); setSpeaking(null); return; } // second tap stops it
    const lang = /[\u0900-\u097F]/.test(textToSay) ? 'hi' : 'en';
    stopSpeaking(); setSpeaking(idx);
    // hands-free: while Munim speaks, talking over it stops the answer and Munim listens (barge-in)
    const handsFree = how === 'auto' && talkRef.current;
    let barged = false;
    let watch: Promise<CutInWatch | null> | null = null; tapCut.current = false; // starts at Munim's first sound, so it learns the echo, not the silence before it
    const ackLang: 'hi' | 'en' = hi ? 'hi' : 'en';
    const startWatch = () => { if (handsFree && !watch) watch = watchForSpeech({
      onSpeech: () => { barged = true; stopSpeaking(); setVoice('listening'); setHeard(''); }, // you cut in: Munim stops and your words, from their start, are this turn
      onLevel: setLevel,
      onDone: (r) => { rec.current = null; if (!talkRef.current) { setVoice('idle'); return; } void heardRec(r, ackLang); },
    }).then((w) => { if (barged) rec.current = w; return w; }).catch(() => null); };
    let chars = 0; // characters Sarvam actually voiced for this answer: the cost (D-089)
    const voiced = async (p: string) => { const a = await tts(p, lang); if (a) chars += p.length; return a; };
    if (handsFree) setNote(t.interruptHint);
    try {
      // on your own data the text was already scrubbed by askLocal (names, payees, identifiers); this is a last safety net
      const spoken = local ? redact(textToSay) : textToSay;
      // piece by piece (D-058): the first sentence plays while the next is being made
      const run = await speakPieces(splitForSpeech(disclaimerLast(spoken), { firstMax: 90 }), lang, voiced, (p) => forSpeech(p, lang), startWatch);
      track('answer_listened', { ctx, how, pieces: run.pieces, voice: run.voice, ...(run.firstMs !== null ? { first_ms: run.firstMs } : {}) });
      const wp = watch as Promise<CutInWatch | null> | null; // set inside a callback, so TypeScript can't see it change
      const w = handsFree && wp ? await wp : null, d = w?.diag(); // what the cut-in listener heard (D-090)
      const cutHow: CutIn['how'] = barged ? 'voice' : tapCut.current ? 'tap' : 'none';
      const prev = turn?.id ? turnsRef.current.get(turn.id) : undefined;
      if (prev) logTurn({ ...prev, voice: run.voice, ttsChars: chars, ...(d ? { cutIn: { ...d, how: cutHow } } : {}),
        ms: { ...prev.ms, ...(run.firstMs !== null ? { firstWord: run.firstMs, total: (prev.ms.stt ?? 0) + prev.ms.agent + run.firstMs } : {}) } });
      if (turn && run.firstMs !== null) {
        const speak = run.firstMs, stt = turn.stt?.ms;
        setMsgs((cur) => cur.map((m, i) => (i === idx ? { ...m, lat: { stt, agent: turn.agentMs, speak, ...(d ? { cut: { need: d.need, peak: d.peak, how: cutHow } } : {}) } } : m)));
        if (turn.id) send('voice_turn', { id: turn.id, stt: turn.stt?.mode ?? 'none', ...(stt !== undefined ? { stt_ms: stt } : {}), agent_ms: turn.agentMs, speak_ms: speak,
          total_ms: (stt ?? 0) + turn.agentMs + speak, voice: run.voice, pieces: run.pieces, lang: turn.lang ?? lang, data: local ? 'mine' : 'sample',
          ...(turnsRef.current.get(turn.id)?.cost ? { cost_uinr: turnsRef.current.get(turn.id)!.cost!.total } : {}), ...(d ? { cut_in: cutHow, cut_need: d.need, cut_peak: d.peak } : {}) });
      }
    } catch { /* playback failed: the answer is still on screen */ }
    finally {
      setSpeaking((cur) => (cur === idx ? null : cur));
      if (!barged) void (watch as Promise<CutInWatch | null> | null)?.then((w) => w?.stop()); // cut in: it keeps recording your turn
      if (handsFree) { setNote(null); if (talkRef.current && !barged) setTimeout(() => { if (talkRef.current) void startVoiceRef.current(); }, 200); } // listen again for the next question
    }
  }

  return (
    <div style={S.page} lang={hi ? 'hi' : 'en'}>
      <style>{CSS}</style>
      <section role="dialog" aria-label={t.dialog} style={S.sheet}>
        <div aria-hidden="true" style={S.grab} />
        <header style={S.head}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>{t.asking(chips.label)}
            {disc.test && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--mari-ink)', background: 'var(--mari-tint)', borderRadius: 999, padding: '2px 8px' }}>{t.test}</span>}
            {ownerLog && <span title={t.ownerLogTip} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)', background: 'var(--tint)', borderRadius: 999, padding: '2px 8px' }}>{t.ownerLog}</span>}
            {disc.test && aiOff && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)', background: 'var(--tint)', borderRadius: 999, padding: '2px 8px' }}>{t.aiOff}</span>}</span>
          <a href={back} aria-label={t.close} style={S.close}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></a>
        </header>

        <div style={S.scroll} aria-live="polite">
          {!msgs.length && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <b className="serif" style={{ fontSize: 26, lineHeight: 1.15 }}>{t.title}</b>
                <span style={{ fontSize: 15, color: 'var(--ink2)' }}>{t.sub}</span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {chips.q.map((q) => <button key={q} type="button" className="chip" onClick={() => ask(q)}>{q}</button>)}
              </div>
            </div>
          )}
          {msgs.map((m, i) => m.role === 'user'
            ? <p key={i} style={S.you}>{m.content}</p>
            : (
              <div key={i} style={S.ans}>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                <button type="button" onClick={() => listen(m.spoken ?? m.content, i)} style={S.listen} aria-label={speaking === i ? t.stopAria : t.listenAria} aria-pressed={speaking === i}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>{speaking === i ? t.stop : t.listen}</button>
                {m.meta && (
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                    {m.meta.tools.length ? t.from([...new Set(m.meta.tools.map((k) => (hi ? TOOL_LABEL_HI : TOOL_LABEL)[k] ?? t.yourDocs))].join(', ')) : t.general}
                    {m.meta.checked ? t.checked(m.meta.checked, m.meta.ok) : ''}
                    {` · ${m.meta.engine === 'claude' ? t.byClaude : t.rules}`}{/* always shown: who answered, AI or rules (D-064) */}
                  </span>
                )}
                {disc.test && m.lat && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.lat(m.lat)}</span>}
                {canVote && m.meta?.id && (votes[i]
                  ? (votes[i].vote === 'down' && !votes[i].why
                      ? <div role="group" aria-label={t.whatWrong} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{t.whatWrong}</span>
                          {WHY.map((w) => <button key={w} type="button" className="chip chip-sm" onClick={() => vote(i, m.meta!.id, 'down', w)}>{t.why[w]}</button>)}
                        </div>
                      : <span role="status" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{t.thanks}</span>)
                  : <div role="group" aria-label={t.helped} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 12.5, color: 'var(--muted)', marginRight: 4 }}>{t.helped}</span>
                      <button type="button" aria-label={t.up} onClick={() => vote(i, m.meta!.id, 'up')} style={S.thumb}><Thumb /></button>
                      <button type="button" aria-label={t.down} onClick={() => vote(i, m.meta!.id, 'down')} style={S.thumb}><Thumb down /></button>
                    </div>)}
              </div>
            ))}
          {busy && (
            <div aria-busy="true" style={S.ans}>
              <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--muted)' }}>
                <span className="dot" /><span className="dot dot2" /><span className="dot dot3" />{t.busy}
              </span>
              <span className="skel" style={{ height: 14, width: '90%' }} /><span className="skel" style={{ height: 14, width: '62%' }} />
            </div>
          )}
          {note && <p role="status" style={{ margin: 0, fontSize: 13.5, color: 'var(--ink2)', background: 'var(--tint)', borderRadius: 14, padding: '10px 14px' }}>{note}</p>}
          {err && (
            <div role="alert" style={S.err}>
              <span style={{ flex: 1, fontSize: 14 }}>{err}</span>
              {lastUser && msgs.at(-1)?.role === 'user' && <button type="button" onClick={() => { setMsgs(msgs.slice(0, -1)); ask(lastUser); }} style={S.retry}>{t.retry}</button>}
            </div>
          )}
          {!!msgs.length && !busy && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{chips.q.filter((q) => !msgs.some((m) => m.content === q)).slice(0, 2).map((q) => <button key={q} type="button" className="chip chip-sm" onClick={() => ask(q)}>{q}</button>)}</div>}
          <div ref={end} />
        </div>

        {voice === 'consent' && (
          <div role="dialog" aria-label={t.consentAria} style={S.consent}>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>{t.consent}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={S.primary} onClick={() => { try { sessionStorage.setItem('munim_voice_ok', '1'); } catch { /* private mode: ask again next time */ } setVoice('idle'); setTimeout(startVoice, 0); }}>{t.micOn}</button>
              <button type="button" style={S.ghost} onClick={() => { setVoice('idle'); input.current?.focus(); }}>{t.type}</button>
            </div>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); ask(text); }} style={S.bar}>
          <label htmlFor="q" style={S.sr}>{t.label}</label>
          {voice === 'listening' || voice === 'hearing'
            ? <span role="status" style={{ ...S.input, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--link)', fontWeight: 600 }}>
                {voice === 'listening'
                  ? <><span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20 }}>{[0.5, 0.8, 1, 0.8, 0.5].map((k, i) => <span key={i} style={{ width: 3, borderRadius: 2, background: 'var(--link)', height: `${Math.max(4, Math.round(level * k * 20))}px` }} />)}</span>{heard || (talk ? t.talkHint : t.listening)}</>
                  : <><span className="dot" /><span className="dot dot2" /><span className="dot dot3" />{t.hearing}</>}
              </span>
            : talk && speaking !== null
            ? <button type="button" onClick={() => { tapCut.current = true; stopSpeaking(); }} style={{ ...S.input, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--link)', fontWeight: 600, cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>{t.cutInTap}</button>
            : <textarea id="q" ref={input} rows={1} value={text} placeholder={t.placeholder} maxLength={500} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }} style={S.input} />}
          {text.trim() && voice === 'idle'
            ? <button type="submit" disabled={busy} aria-label={t.send} className="orb-teal" style={{ ...S.send, opacity: busy ? 0.5 : 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            : <button type="button" onClick={talk ? () => endTalk(false) : startVoice} disabled={!talk && (busy || voice === 'hearing')} aria-label={talk ? t.endTalk : voice === 'listening' ? t.stopSend : t.speak} aria-pressed={talk || voice === 'listening'} className="orb-teal" style={{ ...S.send, opacity: !talk && (busy || voice === 'hearing') ? 0.5 : 1 }}>
                {talk || voice === 'listening'
                  ? <span style={{ width: 14, height: 14, borderRadius: 3, background: '#FFFFFF' }} />
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}
              </button>}
        </form>
        <span style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>{hiLast || hi ? disc.hi : disc.en}</span>
      </section>
    </div>
  );
}

function Thumb({ down = false }: { down?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={down ? { transform: 'rotate(180deg)' } : undefined}>
    <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zM7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.1 21H7" /></svg>;
}

const CSS = `.serif{font-family:'Noto Serif','Noto Serif Devanagari',serif;font-weight:700}
.chip{min-height:44px;padding:0 14px;border-radius:999px;border:0;box-shadow:inset 0 0 0 1px var(--hair2);background:transparent;color:var(--ink);font:inherit;font-size:14px;cursor:pointer;text-align:left}
.chip-sm{min-height:36px;font-size:13px;color:var(--ink2)}
.chip:focus-visible,textarea:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid var(--link);outline-offset:2px}
@keyframes dot{0%,80%,100%{opacity:.25}40%{opacity:1}}
.dot{width:7px;height:7px;border-radius:50%;background:var(--link);animation:dot 1.2s infinite}.dot2{animation-delay:.2s}.dot3{animation-delay:.4s}
@media (prefers-reduced-motion: reduce){.dot{animation:none}}`;

const S: Record<string, React.CSSProperties> = {
  page: { width: '100%', maxWidth: 480, height: 'var(--screen-h, 100dvh)', margin: '0 auto', position: 'relative', background: 'var(--scrim)', color: 'var(--ink)', fontSize: 15, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 48, background: 'var(--card)', borderRadius: '26px 26px 0 0', padding: '10px 20px 14px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 },
  grab: { width: 40, height: 4, borderRadius: 2, background: 'var(--hair2)', alignSelf: 'center' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  close: { width: 44, height: 44, marginRight: -10, display: 'grid', placeItems: 'center', borderRadius: '50%', textDecoration: 'none', color: 'var(--ink2)' },
  scroll: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 4 },
  you: { margin: 0, alignSelf: 'flex-end', maxWidth: '82%', background: 'var(--tint)', borderRadius: '16px 16px 4px 16px', padding: '10px 14px', fontSize: 14.5 },
  ans: { display: 'grid', gap: 8, borderLeft: '3px solid var(--link)', padding: '4px 0 4px 14px' },
  err: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--err-tint)', color: 'var(--err-ink)', borderRadius: 16, padding: '6px 6px 6px 14px' },
  retry: { minHeight: 40, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--card)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  bar: { display: 'flex', alignItems: 'flex-end', gap: 10, background: 'var(--bg)', borderRadius: 24, padding: '6px 6px 6px 16px', boxShadow: 'inset 0 0 0 1px var(--hair)' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, resize: 'none', border: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 15.5, padding: '11px 0', outline: 'none' },
  send: { position: 'relative', width: 44, height: 44, flex: '0 0 44px', borderRadius: '50%', border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' },
  listen: { justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 10px 0 8px', marginLeft: -8, border: 0, borderRadius: 999, background: 'transparent', color: 'var(--link)', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  consent: { display: 'grid', gap: 10, background: 'var(--tint)', borderRadius: 18, padding: '12px 14px' },
  primary: { minHeight: 40, padding: '0 16px', borderRadius: 999, border: 0, background: 'var(--btn)', color: 'var(--on-btn)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  ghost: { minHeight: 40, padding: '0 12px', borderRadius: 999, border: 0, background: 'transparent', color: 'var(--link)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  thumb: { width: 44, height: 44, display: 'grid', placeItems: 'center', border: 0, borderRadius: '50%', background: 'transparent', color: 'var(--ink2)', cursor: 'pointer' },
  sr: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' },
};
