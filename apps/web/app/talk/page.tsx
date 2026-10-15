'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp, downloadVia } from '../client';
import { BottomNav } from '../ui';
import { browserListen, browserSpeak, browserSttAvailable, playBase64, record, stopSpeaking, type RecorderHandle } from '../voice-client';

type Lang = 'hi' | 'en';
type LangPref = Lang | 'auto';
interface Trace { tool: string; input: Record<string, unknown>; result: Record<string, unknown>; ms: number }
interface ActionT { id: string; kind: 'reminder' | 'email' | 'goal' | 'prepayment_plan'; title: string; createdAt: string; reminder?: { date: string; time?: string; notes?: string }; email?: { to: string; subject: string; body: string }; goal?: { target: number; byDate: string; monthlyNeeded: number; avgSurplus: number | null; feasible: boolean | null }; plan?: { amount: number; date: string; interestSaved: number; monthsSaved: number }; gcal?: string | null }
interface Msg { role: 'user' | 'assistant'; content: string; lang?: Lang; trace?: Trace[]; check?: { ok: boolean; checked: number; unverified: string[] }; engine?: string; ms?: number; speech?: string; fallbackReason?: string; actions?: ActionT[] }
interface DataT { label: string; usingUploads: boolean; status: { claude: boolean; model: string | null; sarvam: boolean }; counts: Record<string, number | boolean>; log: { file: string; kind: string; parser: string; ok: boolean; summary: string; checks: { label: string; ok: boolean; detail: string }[] }[]; snapshot: Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any

type Phase = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';
const PHASE: Record<Phase, Record<Lang, string>> = {
  idle: { hi: 'बोलने के लिए टैप करें', en: 'Tap and ask about your money' },
  listening: { hi: 'सुन रहा हूँ… रुकते ही भेज दूँगा', en: 'Listening… I send when you pause' },
  transcribing: { hi: 'समझ रहा हूँ…', en: 'Transcribing…' },
  thinking: { hi: 'हिसाब लगा रहा हूँ…', en: 'Working it out…' },
  speaking: { hi: 'बोल रहा हूँ… रोकने के लिए टैप करें', en: 'Speaking… tap to interrupt' },
};
const SUGGEST: Record<Lang, string[]> = {
  hi: ['मुझे पहले क्या करना चाहिए?', 'मेरा पैसा कहाँ जा रहा है?', 'कौन से सब्सक्रिप्शन बेकार हैं?', 'क्या मैं कार लोन जल्दी चुका सकता हूँ? 50 हज़ार', 'मेरा क्रेडिट स्कोर क्यों गिरा?', 'पापा की मोतियाबिंद सर्जरी का क्लेम कैसे करें?'],
  en: ['What should I fix first?', 'Where is my money going?', 'Which subscriptions should I cut?', 'Can I prepay 50,000 on my car loan?', 'Can I get a better rate on my personal loan?', 'Why did my credit score drop?'],
};
const SUNDAY: Record<Lang, string> = { hi: 'मेरी संडे मनी कॉल शुरू करो: इस हफ़्ते क्या ध्यान देना है?', en: 'Start my Sunday money call: what needs my attention this week?' };


export default function Page() {
  const app = useApp(); const sid = app.ready ? app.sid : '';
  const [lang, setLang] = useState<LangPref>('auto');
  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [data, setData] = useState<DataT | null>(null);
  const [actions, setActions] = useState<ActionT[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [voiceOut, setVoiceOut] = useState(true);
  const [uploading, setUploading] = useState(false);
  const recRef = useRef<RecorderHandle | { stop: () => void } | null>(null);
  const msgsRef = useRef<Msg[]>([]); msgsRef.current = msgs;
  const endRef = useRef<HTMLDivElement>(null);
  const uiLang: Lang = lang === 'en' ? 'en' : lang === 'hi' ? 'hi' : (msgs.filter((m) => m.role === 'assistant').at(-1)?.lang ?? 'hi');
  const H = app.api;

  const refresh = useCallback(async () => {
    if (!sid) return;
    const [d, a] = await Promise.all([H('/api/data').then((r) => r.json()), H('/api/actions').then((r) => r.json())]);
    setData(d); setActions(a.actions ?? []);
  }, [sid, H]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, interim]);

  const speak = useCallback(async (t: string, l: Lang) => {
    if (!voiceOut) return;
    setPhase('speaking');
    try {
      if (data?.status.sarvam) {
        const r = await H('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: t, lang: l }) });
        if (r.ok) { const j = await r.json(); await playBase64(j.audioBase64, j.mime); return; }
      }
      await browserSpeak(t, l);
    } finally { setPhase((p) => (p === 'speaking' ? 'idle' : p)); }
  }, [voiceOut, data, H]);

  const ask = useCallback(async (q: string) => {
    const question = q.trim(); if (!question) return;
    setError(''); setInterim('');
    const history = [...msgsRef.current, { role: 'user' as const, content: question }];
    setMsgs(history); setPhase('thinking');
    try {
      const r = await H('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang, messages: history.map((m) => ({ role: m.role, content: m.content })) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || 'Agent error');
      const reply: Msg = { role: 'assistant', content: j.answer, lang: j.lang, trace: j.trace, check: j.check, engine: j.engine === 'claude' ? j.model : 'offline rules', ms: j.ms, speech: j.speech, fallbackReason: j.fallbackReason, actions: j.actions };
      setMsgs([...history, reply]);
      if (j.actions?.length) { setFresh(new Set(j.actions.map((a: ActionT) => a.id))); refresh(); }
      await speak(j.speech || j.answer, j.lang);
    } catch (e) { setError((e as Error).message); setPhase('idle'); }
    setPhase((p) => (p === 'thinking' ? 'idle' : p));
  }, [H, lang, refresh, speak]);

  const micTap = useCallback(async () => {
    setError('');
    if (phase === 'speaking') { stopSpeaking(); setPhase('idle'); return; }
    if (phase === 'listening') { recRef.current?.stop(); return; }
    if (phase !== 'idle') return;
    const sttLang: Lang = lang === 'en' ? 'en' : 'hi';
    if (data?.status.sarvam) {
      try {
        setPhase('listening');
        recRef.current = await record({
          onLevel: setLevel,
          onDone: async (rec) => {
            recRef.current = null;
            if (!rec) { setPhase('idle'); return; }
            setPhase('transcribing');
            const f = new FormData(); f.append('file', new File([rec.blob], `speech.${rec.mime.includes('mp4') ? 'm4a' : rec.mime.includes('ogg') ? 'ogg' : 'webm'}`, { type: rec.mime })); f.append('lang', lang);
            const r = await H('/api/stt', { method: 'POST', body: f });
            const j = await r.json();
            if (!r.ok || !j.transcript) { setError(j.error ? `Voice: ${j.error}` : (uiLang === 'hi' ? 'आवाज़ समझ नहीं आई, फिर से बोलिए।' : "Didn't catch that, try again.")); setPhase('idle'); return; }
            await ask(j.transcript);
          },
        });
        return;
      } catch (e) { setError(`Microphone: ${(e as Error).message}`); setPhase('idle'); return; }
    }
    if (!browserSttAvailable()) { setError('Voice input needs Chrome/Edge, or set SARVAM_API_KEY. You can type below.'); return; }
    setPhase('listening');
    recRef.current = browserListen(sttLang, setInterim, (t) => { recRef.current = null; setPhase('idle'); if (t) ask(t); else setInterim(''); }, (err) => { recRef.current = null; setPhase('idle'); setError(/not-allowed|service-not-allowed|audio-capture/.test(err) ? (uiLang === 'hi' ? 'माइक की इजाज़त नहीं मिली। सवाल नीचे लिखें, जवाब बोलकर सुनाया जाएगा।' : 'The microphone is blocked here. Type your question below; replies are still spoken.') : `Voice: ${err}`); });
  }, [phase, lang, data, H, ask, uiLang]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true); setError('');
    const f = new FormData(); for (const file of Array.from(files)) f.append('files', file);
    const r = await H('/api/upload', { method: 'POST', body: f }); const j = await r.json();
    setUploading(false);
    if (!r.ok) setError(j.error ?? 'Upload failed');
    setMsgs([]); await refresh();
  };
  const autoCall = useRef(false);
  useEffect(() => {
    if (autoCall.current || !data || !sid) return;
    if (new URLSearchParams(window.location.search).get('call') === '1') { autoCall.current = true; void ask(SUNDAY[uiLang]); }
  }, [data, sid, ask, uiLang]);
  const resetData = async () => { await H('/api/upload', { method: 'DELETE' }); setMsgs([]); refresh(); };
  const newChat = async () => { stopSpeaking(); setMsgs([]); setPhase('idle'); await H('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reset: true }) }); };
  const delAction = async (id: string) => { await H(`/api/actions?id=${id}`, { method: 'DELETE' }); refresh(); };

  const s = data?.snapshot ?? {};
  const checks = data?.log.flatMap((l) => l.checks) ?? [];
  const passing = checks.filter((c) => c.ok).length;

  return (
    <div className="app"><main className="screen wrap">
      <div className="topbar" style={{ gridColumn: '1 / -1' }}>
        <h1>{uiLang === 'hi' ? 'मुनीम से बात करें' : 'Talk to Munim'}</h1>
        <div className="pills">
          <span className={`pill ${data?.status.claude ? 'ok' : 'warn'}`}>{data?.status.claude ? 'Claude' : 'Offline rules'}</span>
          <span className={`pill ${data?.status.sarvam ? 'ok' : 'warn'}`}>{data?.status.sarvam ? 'Sarvam voice' : 'Browser voice'}</span>
        </div>
      </div>

      <section style={{ display: 'grid', gap: 14 }}>
        <div className="stage">
          <h1>{uiLang === 'hi' ? 'अपने पैसों के बारे में बोलकर पूछिए' : 'Ask about your money, out loud'}</h1>
          <p>{uiLang === 'hi' ? 'बैंक, कार्ड, SMS, ईमेल, लोन, बीमा और क्रेडिट रिपोर्ट — सब जोड़कर जवाब, और फिर काम भी।' : 'Bank, card, SMS, email, loan, insurance and credit report, connected. Then it acts.'}</p>
          <div className="seg" role="group" aria-label="Language">
            {(['auto', 'hi', 'en'] as LangPref[]).map((l) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l === 'auto' ? 'Auto' : l === 'hi' ? 'हिंदी' : 'English'}</button>)}
          </div>
          <button className={`mic ${phase === 'listening' ? 'listening' : phase === 'speaking' ? 'speaking' : phase === 'idle' ? '' : 'busy'}`} onClick={micTap} aria-label={PHASE[phase][uiLang]} disabled={!sid}>
            {phase === 'listening' ? <StopIcon /> : phase === 'speaking' ? <SpeakerIcon /> : <MicIcon />}
          </button>
          <div className="level" aria-hidden><i style={{ width: `${Math.round(level * 100)}%` }} /></div>
          <div className="state" aria-live="polite">{PHASE[phase][uiLang]}</div>
          <button className="sunday" onClick={() => ask(SUNDAY[uiLang])} disabled={phase !== 'idle'}>☀ {uiLang === 'hi' ? 'संडे मनी कॉल शुरू करें' : 'Start the Sunday Money Call'}</button>
          <div className="chips">{SUGGEST[uiLang].map((q) => <button key={q} className="chip" onClick={() => ask(q)} disabled={phase !== 'idle'}>{q}</button>)}</div>
          <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(text); setText(''); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={uiLang === 'hi' ? 'या यहाँ लिखें…' : 'Or type here…'} aria-label="Type a question" />
            <button className="btn small" type="submit" disabled={phase !== 'idle' || !text.trim()}>{uiLang === 'hi' ? 'भेजें' : 'Send'}</button>
          </form>
          <label style={{ fontSize: 13, color: 'var(--dark-muted)' }}><input type="checkbox" checked={voiceOut} onChange={(e) => setVoiceOut(e.target.checked)} /> {uiLang === 'hi' ? 'जवाब बोलकर सुनाएँ' : 'Speak replies'}</label>
        </div>

        {error && <div className="card" role="alert" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>}

        <div className="convo">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'bot'}`}>
              <div className="bubble">{m.content}</div>
              {m.role === 'assistant' && (
                <>
                  <div className="meta">
                    {m.check && m.check.checked > 0 && (m.check.ok ? <span className="badge ok">✓ {m.check.checked} {m.check.checked === 1 ? 'number' : 'numbers'} traced to your data</span> : <span className="badge warn">⚠ not found in data: {m.check.unverified.join(', ')}</span>)}
                    <span>{m.engine}{m.ms ? ` · ${(m.ms / 1000).toFixed(1)}s` : ''}</span>
                    {m.fallbackReason && <span title={m.fallbackReason}>· Claude unavailable, used rules</span>}
                    {m.trace?.some((t) => t.tool === 'advice_plan') && <span className="badge warn" title="Guidance from your documents and rules of thumb; not SEBI-registered investment advice">Guidance · not registered advice</span>}
                    <button className="btn ghost small" onClick={() => speak(m.speech || m.content, m.lang ?? 'hi')}>▶ {uiLang === 'hi' ? 'फिर सुनें' : 'Replay'}</button>
                  </div>
                  {!!m.trace?.length && (
                    <details className="math"><summary>{uiLang === 'hi' ? 'हिसाब देखें' : 'Show the math'} ({m.trace.map((t) => t.tool).join(', ')})</summary>
                      {m.trace.map((t, k) => <pre key={k}>{`${t.tool}(${JSON.stringify(t.input)})  ${t.ms}ms\n${JSON.stringify(t.result, null, 1)}`}</pre>)}
                    </details>
                  )}
                </>
              )}
            </div>
          ))}
          {phase === 'listening' && interim && <div className="msg user"><div className="bubble" style={{ opacity: 0.6 }}>{interim}</div></div>}
          <div ref={endRef} />
          {!!msgs.length && <button className="btn ghost small" style={{ justifySelf: 'start' }} onClick={newChat}>{uiLang === 'hi' ? 'नई बातचीत' : 'New conversation'}</button>}
        </div>
      </section>

      <aside className="side">
        <div className="card">
          <h2>{uiLang === 'hi' ? 'काम जो Munim ने किए' : 'Actions taken'} ({actions.length})</h2>
          {!actions.length && <div className="empty">{uiLang === 'hi' ? 'अभी कुछ नहीं। कहिए “रिमाइंडर लगा दो” या “ईमेल ड्राफ़्ट करो”।' : 'Nothing yet. Say “set a reminder” or “draft the email”.'}</div>}
          <div className="list">{actions.map((a) => <ActionCard key={a.id} a={a} fresh={fresh.has(a.id)} onDelete={() => delAction(a.id)} />)}</div>
        </div>

      </aside>
      {msgs.length > 0 && (
        <button className={`fab ${phase === 'listening' ? 'listening' : phase === 'speaking' ? 'speaking' : phase === 'idle' ? '' : 'busy'}`} onClick={micTap} aria-label={PHASE[phase][uiLang]}>
          {phase === 'listening' ? <StopIcon /> : phase === 'speaking' ? <SpeakerIcon /> : <MicIcon />}
        </button>
      )}
      <p className="sub" style={{ textAlign: 'center', fontSize: 12 }}>Guidance only, not SEBI-registered investment advice · Numbers come from code, never from the AI</p>
    </main><BottomNav /></div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value?: string | number | null; note?: string | null; tone?: 'neg' | 'pos' }) {
  return <div className="kpi"><small>{label}</small><b className={tone}>{value ?? '—'}</b><em>{note ?? ''}</em></div>;
}

function ActionCard({ a, fresh, onDelete }: { a: ActionT; fresh: boolean; onDelete: () => void }) {
  const app = useApp();
  const [copied, setCopied] = useState(false);
  const label = { reminder: 'Reminder', email: 'Email draft', goal: 'Savings goal', prepayment_plan: 'Prepayment plan' }[a.kind];
  const rupees = (p: number) => `₹${Math.round(p / 100).toLocaleString('en-IN')}`;
  return (
    <div className={`action ${fresh ? 'fresh' : ''}`}>
      <div className="kind">{label}</div>
      <div className="title">{a.title}</div>
      {a.reminder && <div style={{ fontSize: 13 }}>{a.reminder.date}{a.reminder.time ? ` ${a.reminder.time}` : ''}{a.reminder.notes ? ` · ${a.reminder.notes}` : ''}</div>}
      {a.goal && <div style={{ fontSize: 13 }}>{rupees(a.goal.target)} by {a.goal.byDate} · {rupees(a.goal.monthlyNeeded)}/month{a.goal.avgSurplus !== null ? ` · avg surplus ${rupees(a.goal.avgSurplus)}` : ''}</div>}
      {a.email && <><div style={{ fontSize: 13 }}>To: {a.email.to}</div><pre>{a.email.body}</pre></>}
      <div className="btns">
        {(a.reminder || a.plan) && <button className="btn small" onClick={() => void downloadVia(app.api, `/api/actions/${a.id}/ics`, `munim-${a.id}.ics`)}>Add to calendar (.ics)</button>}
        {a.gcal && <a className="btn small" href={a.gcal} target="_blank" rel="noreferrer">Google Calendar</a>}
        {a.email && <a className="btn small" href={`mailto:${encodeURIComponent(a.email.to)}?subject=${encodeURIComponent(a.email.subject)}&body=${encodeURIComponent(a.email.body)}`}>Open in mail</a>}
        {a.email && <button className="btn small" onClick={() => { navigator.clipboard?.writeText(`${a.email!.subject}\n\n${a.email!.body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy'}</button>}
        <button className="btn small ghost" onClick={onDelete}>Remove</button>
      </div>
    </div>
  );
}

const MicIcon = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v5" /></svg>;
const StopIcon = () => <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
const SpeakerIcon = () => <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></svg>;
