'use client';
// Ask Munim, live: typed questions answered by /api/ask from the engine's figures. Same sheet, tokens and type as designs/Voice.
// Context-aware: the screen you came from (?from= or the referrer) picks the suggested questions.
// Voice: mic → /api/stt (Sarvam) or the browser's speech recognition, after a one-time note on where the audio goes.
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { forSpeech } from '@core/agent/lang';
import { record, browserListen, browserSttAvailable, browserSpeak, playBase64, stopSpeaking, unlockAudio, type RecorderHandle } from '@/ui/voice';

type Msg = { role: 'user' | 'assistant'; content: string; meta?: { checked: number; ok: boolean; tools: string[]; engine: string } };
type Ctx = 'xray' | 'invest' | 'spends' | 'credit' | 'today';

const CHIPS: Record<Ctx, { label: string; q: string[] }> = {
  xray: { label: 'your funds', q: ['Should I switch to direct plans?', 'How much can I book tax-free this year?', 'Are my funds beating an FD?'] },
  invest: { label: 'your savings', q: ['How big is my safety net?', 'How are my funds doing?', 'Is my term cover enough?'] },
  spends: { label: 'your spending', q: ['Where is my money going?', 'Which subscriptions should I cut?', 'Anything unusual this month?'] },
  credit: { label: 'your credit', q: ['What changed in my credit score?', 'Can I get a better rate on my loan?', 'Should I prepay my car loan?'] },
  today: { label: 'your money', q: ['What should I fix first?', 'मेरा पैसा कहाँ जा रहा है?', 'What bills are due before salary?'] },
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

export default function AskLive() {
  const [{ ctx, back }, setCtx] = useState<{ ctx: Ctx; back: string }>({ ctx: 'today', back: '/' });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // disclaimer comes from the server (it depends on the session's advice mode); the safe wording shows until it arrives
  const [disc, setDisc] = useState<{ en: string; hi: string; test: boolean }>({ en: 'General guidance, not SEBI-registered investment advice.', hi: 'सामान्य जानकारी, SEBI-रजिस्टर्ड निवेश सलाह नहीं।', test: false });
  // voice: idle → (consent once) → listening → hearing (speech to text) → the question is sent like a typed one
  const [voice, setVoice] = useState<'idle' | 'consent' | 'listening' | 'hearing'>('idle');
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState('');
  const [sttMode, setSttMode] = useState<'server' | 'browser'>('server');
  const [note, setNote] = useState<string | null>(null); // neutral info (not an error)
  const [speaking, setSpeaking] = useState<number | null>(null); // which answer is being read aloud
  const rec = useRef<RecorderHandle | { stop: () => void } | null>(null);
  const msgsRef = useRef(msgs); msgsRef.current = msgs;
  const busyRef = useRef(busy); busyRef.current = busy;
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { const c = ctxOf(); setCtx(c); track('ask_opened', { ctx: c.ctx }); }, []);
  useEffect(() => { fetch('/api/ask', { cache: 'no-store' }).then((r) => r.json()).then((j) => j.disclaimer && setDisc({ ...j.disclaimer, test: !!j.testMode })).catch(() => {}); }, []);
  const hiLast = [...msgs].reverse().find((m) => m.role === 'assistant' && /[\u0900-\u097F]/.test(m.content));
  useEffect(() => { fetch('/api/stt', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (!j.configured && browserSttAvailable()) setSttMode('browser'); }).catch(() => {}); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  async function ask(q: string, via: 'text' | 'voice' = 'text') {
    q = q.trim(); if (!q || busyRef.current) return;
    const next: Msg[] = [...msgsRef.current, { role: 'user', content: q }];
    stopSpeaking(); setSpeaking(null);
    setMsgs(next); setText(''); setBusy(true); setErr(null);
    track('ask_sent', { ctx, turn: next.filter((m) => m.role === 'user').length, via });
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Munim could not answer just now.');
      setMsgs([...next, { role: 'assistant', content: j.answer, meta: { checked: j.check?.checked ?? 0, ok: !!j.check?.ok, tools: j.tools ?? [], engine: j.engine } }]);
      if (via === 'voice') listen(j.answer, next.length, 'auto'); // asked by voice → answered by voice; typed → stays quiet
    } catch (e) { setErr((e as Error).message); setMsgs(next); }
    finally { setBusy(false); input.current?.focus(); }
  }
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user')?.content;

  const consented = () => { try { return sessionStorage.getItem('munim_voice_ok') === '1'; } catch { return false; } };
  async function startVoice() {
    if (voice === 'listening') { rec.current?.stop(); return; }
    if (busy || voice === 'hearing') return;
    if (!consented()) { setVoice('consent'); return; }
    stopSpeaking(); setSpeaking(null); unlockAudio(); setErr(null); setNote(null); setHeard('');
    track('voice_started', { ctx, mode: sttMode });
    if (sttMode === 'browser') {
      setVoice('listening');
      rec.current = browserListen(hiLast ? 'hi' : 'en', (t) => setHeard(t), (t) => { setVoice('idle'); rec.current = null; if (t) ask(t, 'voice'); else setErr('Didn’t catch that. Try again or type.'); },
        (e) => { setVoice('idle'); rec.current = null;
          setErr(/not-allowed|service-not-allowed|audio-capture/.test(e) ? 'Couldn’t use the microphone. Allow it in the browser, or type.' : e === 'no-speech' ? 'Didn’t catch that. Try again or type.' : 'Voice typing isn’t working in this browser right now. Type instead.'); });
      return;
    }
    try {
      setVoice('listening');
      rec.current = await record({ onLevel: setLevel, onDone: async (r) => {
        rec.current = null;
        if (!r) { setVoice('idle'); return; }
        setVoice('hearing');
        try {
          const form = new FormData(); form.append('file', r.blob, 'speech.webm'); form.append('lang', 'auto');
          const res = await fetch('/api/stt', { method: 'POST', body: form }); const j = await res.json();
          if (res.ok && j.transcript) { setVoice('idle'); ask(j.transcript, 'voice'); return; }
          if (j.fallback === 'browser' && browserSttAvailable()) { setSttMode('browser'); setVoice('idle'); setNote('Voice service is busy, so your browser will listen instead. Tap the mic again.'); return; }
          setVoice('idle'); setErr(j.error ?? 'Didn’t catch that. Try again or type.');
        } catch { setVoice('idle'); setErr('Didn’t catch that. Try again or type.'); }
      } });
    } catch { setVoice('idle'); setErr('Couldn’t use the microphone. Allow it in the browser, or type.'); }
  }
  async function listen(textToSay: string, idx: number, how: 'tap' | 'auto' = 'tap') {
    if (speaking === idx) { stopSpeaking(); setSpeaking(null); return; } // second tap stops it
    const lang = /[\u0900-\u097F]/.test(textToSay) ? 'hi' : 'en';
    track('answer_listened', { ctx, how });
    stopSpeaking(); setSpeaking(idx);
    try {
      const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: textToSay, lang }) });
      const j = await r.json();
      if (r.ok && j.audioBase64) { await playBase64(j.audioBase64, j.mime); return; }
      await browserSpeak(forSpeech(textToSay, lang), lang);
    } catch { await browserSpeak(forSpeech(textToSay, lang), lang); }
    finally { setSpeaking((cur) => (cur === idx ? null : cur)); }
  }

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <section role="dialog" aria-label="Ask Munim" style={S.sheet}>
        <div aria-hidden="true" style={S.grab} />
        <header style={S.head}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>Asking about <b style={{ color: 'var(--ink2)', fontWeight: 600 }}>{CHIPS[ctx].label}</b>
            {disc.test && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--mari-ink)', background: 'var(--mari-tint)', borderRadius: 999, padding: '2px 8px' }}>Test mode</span>}</span>
          <a href={back} aria-label="Close" style={S.close}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></a>
        </header>

        <div style={S.scroll} aria-live="polite">
          {!msgs.length && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <b className="serif" style={{ fontSize: 26, lineHeight: 1.15 }}>Ask anything about your money</b>
                <span style={{ fontSize: 15, color: 'var(--ink2)' }}>Hindi or English. Every number comes from your own statements.</span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {CHIPS[ctx].q.map((q) => <button key={q} type="button" className="chip" onClick={() => ask(q)}>{q}</button>)}
              </div>
            </div>
          )}
          {msgs.map((m, i) => m.role === 'user'
            ? <p key={i} style={S.you}>{m.content}</p>
            : (
              <div key={i} style={S.ans}>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                <button type="button" onClick={() => listen(m.content, i)} style={S.listen} aria-label={speaking === i ? 'Stop reading this answer' : 'Listen to this answer'} aria-pressed={speaking === i}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>{speaking === i ? 'Stop' : 'Listen'}</button>
                {m.meta && (
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                    {m.meta.tools.length ? `From ${[...new Set(m.meta.tools.map((t) => TOOL_LABEL[t] ?? 'your documents'))].join(', ')}` : 'General help'}
                    {m.meta.checked ? ` · ${m.meta.checked} number${m.meta.checked > 1 ? 's' : ''} ${m.meta.ok ? 'checked' : 'could not be checked'}` : ''}
                    {disc.test ? ` · ${m.meta.engine === 'claude' ? 'Claude' : 'rules, no AI'}` : ''}
                  </span>
                )}
              </div>
            ))}
          {busy && (
            <div aria-busy="true" style={S.ans}>
              <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--muted)' }}>
                <span className="dot" /><span className="dot dot2" /><span className="dot dot3" />Checking your statements…
              </span>
              <span className="skel" style={{ height: 14, width: '90%' }} /><span className="skel" style={{ height: 14, width: '62%' }} />
            </div>
          )}
          {note && <p role="status" style={{ margin: 0, fontSize: 13.5, color: 'var(--ink2)', background: 'var(--tint)', borderRadius: 14, padding: '10px 14px' }}>{note}</p>}
          {err && (
            <div role="alert" style={S.err}>
              <span style={{ flex: 1, fontSize: 14 }}>{err}</span>
              {lastUser && msgs.at(-1)?.role === 'user' && <button type="button" onClick={() => { setMsgs(msgs.slice(0, -1)); ask(lastUser); }} style={S.retry}>Retry</button>}
            </div>
          )}
          {!!msgs.length && !busy && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{CHIPS[ctx].q.filter((q) => !msgs.some((m) => m.content === q)).slice(0, 2).map((q) => <button key={q} type="button" className="chip chip-sm" onClick={() => ask(q)}>{q}</button>)}</div>}
          <div ref={end} />
        </div>

        {voice === 'consent' && (
          <div role="dialog" aria-label="Turn on voice" style={S.consent}>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>Your voice is turned into text by a speech service (Sarvam, or your browser’s). Munim doesn’t keep the recording.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={S.primary} onClick={() => { try { sessionStorage.setItem('munim_voice_ok', '1'); } catch { /* private mode: ask again next time */ } setVoice('idle'); setTimeout(startVoice, 0); }}>Turn on mic</button>
              <button type="button" style={S.ghost} onClick={() => { setVoice('idle'); input.current?.focus(); }}>Type instead</button>
            </div>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); ask(text); }} style={S.bar}>
          <label htmlFor="q" style={S.sr}>Your question</label>
          {voice === 'listening' || voice === 'hearing'
            ? <span role="status" style={{ ...S.input, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--link)', fontWeight: 600 }}>
                {voice === 'listening'
                  ? <><span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20 }}>{[0.5, 0.8, 1, 0.8, 0.5].map((k, i) => <span key={i} style={{ width: 3, borderRadius: 2, background: 'var(--link)', height: `${Math.max(4, Math.round(level * k * 20))}px` }} />)}</span>{heard || 'Listening… Hindi or English'}</>
                  : <><span className="dot" /><span className="dot dot2" /><span className="dot dot3" />Turning it into text…</>}
              </span>
            : <textarea id="q" ref={input} rows={1} value={text} placeholder="Ask, or tap the mic" maxLength={500} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }} style={S.input} />}
          {text.trim() && voice === 'idle'
            ? <button type="submit" disabled={busy} aria-label="Ask" className="orb-teal" style={{ ...S.send, opacity: busy ? 0.5 : 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            : <button type="button" onClick={startVoice} disabled={busy || voice === 'hearing'} aria-label={voice === 'listening' ? 'Stop and send' : 'Speak your question'} aria-pressed={voice === 'listening'} className="orb-teal" style={{ ...S.send, opacity: busy || voice === 'hearing' ? 0.5 : 1 }}>
                {voice === 'listening'
                  ? <span style={{ width: 14, height: 14, borderRadius: 3, background: '#FFFFFF' }} />
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}
              </button>}
        </form>
        <span style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>{hiLast ? disc.hi : disc.en}</span>
      </section>
    </div>
  );
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
  sr: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' },
};
