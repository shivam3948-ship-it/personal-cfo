'use client';
// A FICTIONAL host savings app with Munim embedded as its voice layer. Shows the three growth levers:
// discovery (in-task hints, proactive offer on hesitation), adoption (example prompts, fast first answer),
// usage (voice that does things, confirmed with "haan"). The host owns state; Munim only proposes.
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { browserListen, browserSpeak, browserSttAvailable, playBase64, record, stopSpeaking, type RecorderHandle } from '../voice-client';

type Lang = 'hi' | 'en';
type Screen = 'home' | 'save' | 'withdraw';
interface Withdrawal { id: string; amountPaise: number; requestedOn: string; expectedBy: string; status: 'processing' | 'paid' | 'failed'; paidOn?: string; bankRef?: string }
interface Debit { date: string; amountPaise: number; ref: string }
interface HostState { savedPaise: number; valuePaise: number; dailyPaise: number; pausedUntil: string | null; streakDays: number; nextDebit: string; monthSavedPaise: number; asOf: string; withdrawals: Withdrawal[]; debits: Debit[] }
type Proposal = { type: 'set_daily'; amountPaise: number } | { type: 'pause'; days: number; until: string } | { type: 'resume' }
  | { type: 'handoff'; reason: string; summary: string } | { type: 'refund_request'; date: string; extraPaise: number; refs: string[] };
interface Reply { answer: string; speech: string; lang: Lang; proposal: Proposal | null; executed: Proposal | null; intent: string; check: { ok: boolean; checked: number }; engine: string; ms: number }
type Source = 'hint' | 'fab' | 'proactive';

const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10); // IST date
const plus = (iso: string, d: number) => new Date(Date.parse(iso + 'T00:00:00Z') + d * 86400000).toISOString().slice(0, 10);
const rs = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: p % 100 ? 2 : 0, minimumFractionDigits: p % 100 ? 2 : 0 })}`;

// Demo scenarios = the top complaint themes in 15,532 Play Store reviews of savings/investing apps (docs/26).
type Scenario = 'ontime' | 'late' | 'paid' | 'double';
const SCENARIOS: Record<Scenario, string> = { ontime: 'Withdrawal on time', late: 'Withdrawal 3 days late', paid: 'Paid, "not in my bank"', double: 'Charged twice today' };
function scenarioState(sc: Scenario): HostState {
  const t = today();
  const debits: Debit[] = Array.from({ length: 7 }, (_, i) => ({ date: plus(t, -i), amountPaise: 5000, ref: `D-${7 - i}` }));
  if (sc === 'double') debits.unshift({ date: t, amountPaise: 5000, ref: 'D-8' });
  const w: Withdrawal = sc === 'late' ? { id: 'W-118', amountPaise: 50000, requestedOn: plus(t, -4), expectedBy: plus(t, -3), status: 'processing' }
    : sc === 'paid' ? { id: 'W-118', amountPaise: 50000, requestedOn: plus(t, -1), expectedBy: t, status: 'paid', paidOn: t, bankRef: 'UTR4417820963' }
    : { id: 'W-118', amountPaise: 50000, requestedOn: plus(t, -1), expectedBy: plus(t, 1), status: 'processing' };
  return { savedPaise: 1245000, valuePaise: 1302650, dailyPaise: 5000, pausedUntil: null, streakDays: 41, nextDebit: plus(t, 1), monthSavedPaise: 75000, asOf: t, withdrawals: [w], debits };
}

const HINT: Record<Screen, Record<Lang, string>> = {
  home: { hi: 'बोलकर पूछिए: “कितना बचा?”', en: 'Ask: “How much have I saved?”' },
  save: { hi: 'बोलिए: “रोज़ 30 रुपये कर दो”', en: 'Say: “Make it ₹30 a day”' },
  withdraw: { hi: 'पूछिए: “मेरे पैसे कहाँ हैं?”', en: 'Ask: “Where is my money?”' },
};
const CHIPS: Record<Screen, Record<Lang, string[]>> = {
  home: { hi: ['कितना बचा?', 'आज दो बार पैसे कटे?', 'कम क्यों दिख रहा है?', 'इंसान से बात कराओ'], en: ['How much have I saved?', 'Was I charged twice today?', 'Why is it showing less?', 'Connect me to a person'] },
  save: { hi: ['रोज़ 30 रुपये कर दो', 'इस हफ़्ते पैसे नहीं हैं, 7 दिन रोक दो', 'रोज़ 100 कर दो'], en: ['Make it ₹30 a day', 'Pause for 7 days', 'Make it ₹100 a day'] },
  withdraw: { hi: ['मेरे पैसे अभी तक नहीं आए', 'कोई चार्ज लगेगा?', 'ये ऐप फ्रॉड तो नहीं?', 'इंसान से बात कराओ'], en: ["My money hasn't arrived yet", 'Is there a charge?', 'Is this app a fraud?', 'Connect me to a person'] },
};

function useFunnel() {
  const [f, setF] = useState<Record<string, number>>({});
  useEffect(() => { try { setF(JSON.parse(localStorage.getItem('munim-host-funnel') ?? '{}')); } catch { /* ignore */ } }, []);
  const bump = useCallback((k: string) => setF((x) => { const n = { ...x, [k]: (x[k] ?? 0) + 1 }; try { localStorage.setItem('munim-host-funnel', JSON.stringify(n)); } catch { /* ignore */ } return n; }), []);
  const reset = () => { setF({}); try { localStorage.removeItem('munim-host-funnel'); } catch { /* ignore */ } };
  return { f, bump, reset };
}

const Mic = ({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) => <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;

export default function HostDemo() {
  const [sc, setSc] = useState<Scenario>('ontime');
  const [s, setS] = useState<HostState>(() => scenarioState('ontime'));
  const [kase, setKase] = useState<{ id: string; summary: string } | null>(null);
  const pickScenario = (x: Scenario) => { setSc(x); setS(scenarioState(x)); setKase(null); };
  useEffect(() => { const q = new URLSearchParams(window.location.search).get('s'); if (q && q in SCENARIOS) { const x = q as Scenario; setSc(x); setS(scenarioState(x)); setScreen(x === 'double' ? 'home' : 'withdraw'); } }, []);
  const [screen, setScreen] = useState<Screen>('home');
  const [lang, setLang] = useState<Lang>('hi');
  const [open, setOpen] = useState<Source | null>(null);
  const [toast, setToast] = useState('');
  const [offer, setOffer] = useState(false); const offered = useRef(false);
  const [wAmt, setWAmt] = useState(''); const edits = useRef(0);
  const { f, bump, reset } = useFunnel();

  useEffect(() => { bump(`hint_view_${screen}`); }, [screen, bump]);
  // Proactive offer: on the withdraw screen, 8 s without acting or 3+ edits of the amount = hesitation.
  useEffect(() => {
    if (screen !== 'withdraw' || offered.current) return;
    const t = setTimeout(() => { if (!offered.current) { offered.current = true; setOffer(true); bump('proactive_shown'); } }, 8000);
    return () => clearTimeout(t);
  }, [screen, bump]);
  const onAmt = (v: string) => { setWAmt(v.replace(/\D/g, '')); edits.current++; if (edits.current >= 3 && !offered.current) { offered.current = true; setOffer(true); bump('proactive_shown'); } };

  const openMunim = (src: Source) => { setOffer(false); setOpen(src); bump(`entry_${src}`); };
  const apply = (p: Proposal) => {
    if (p.type === 'handoff') { setKase({ id: `C-${s.asOf.replace(/-/g, '').slice(2)}-${(p.summary.length % 90) + 10}`, summary: p.summary }); setToast('Case created · a person will call back'); bump('handoff'); setTimeout(() => setToast(''), 3500); return; }
    if (p.type === 'refund_request') { setToast(`Refund request raised for ${rs(p.extraPaise)}`); bump('refund_request'); bump('action_confirmed'); setTimeout(() => setToast(''), 3500); return; }
    setS((x) => p.type === 'set_daily' ? { ...x, dailyPaise: p.amountPaise, pausedUntil: null } : p.type === 'pause' ? { ...x, pausedUntil: p.until } : { ...x, pausedUntil: null });
    setToast(p.type === 'set_daily' ? `Daily saving set to ${rs(p.amountPaise)}` : p.type === 'pause' ? `Paused until ${p.until}` : 'Daily saving restarted');
    bump('action_confirmed'); setTimeout(() => setToast(''), 3500);
  };
  const w = s.withdrawals[0];
  const todayDebits = s.debits.filter((d) => d.date === s.asOf);

  const tab = (k: Screen, label: string) => <button key={k} onClick={() => setScreen(k)} aria-pressed={screen === k} style={{ flex: 1, border: 0, background: 'transparent', padding: '10px 0', fontWeight: screen === k ? 700 : 500, color: screen === k ? '#5B3BC4' : '#4B4B5C', borderTop: screen === k ? '3px solid #5B3BC4' : '3px solid transparent', cursor: 'pointer', fontSize: 14 }}>{label}</button>;
  const hint = <button onClick={() => openMunim('hint')} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px dashed #5B3BC4', background: '#F2EEFF', color: '#3E2A8C', borderRadius: 999, padding: '9px 14px', fontSize: 14, cursor: 'pointer', alignSelf: 'flex-start' }}><Mic color="#5B3BC4" />{HINT[screen][lang]}</button>;
  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(20,20,40,.08)', display: 'grid', gap: 8 };

  return (
    <div style={{ minHeight: '100dvh', background: '#E9E7F1', display: 'grid', placeItems: 'start center', padding: '16px 0 40px', fontFamily: 'var(--font)' }}>
      <div style={{ width: 'min(400px, 100vw)', display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#4B4B5C', textAlign: 'center', padding: '0 16px' }}>Fictional host app (not a real brand) · <b>Munim embedded as its voice layer</b></div>
        <div style={{ background: '#F7F6FB', borderRadius: 24, overflow: 'hidden', minHeight: 720, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 8px 30px rgba(20,20,40,.15)' }}>
          <header style={{ background: '#5B3BC4', color: '#fff', padding: '18px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 18 }}>◎ Daily Saver</b>
            <div role="group" aria-label="Language" style={{ display: 'flex', background: 'rgba(255,255,255,.18)', borderRadius: 999, padding: 2 }}>
              {(['hi', 'en'] as Lang[]).map((l) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} style={{ border: 0, borderRadius: 999, padding: '4px 10px', background: lang === l ? '#fff' : 'transparent', color: lang === l ? '#5B3BC4' : '#fff', fontWeight: 600, cursor: 'pointer' }}>{l === 'hi' ? 'हिं' : 'EN'}</button>)}
            </div>
          </header>

          <main style={{ flex: 1, padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>
            {screen === 'home' && <>
              <div style={card}>
                <span style={{ fontSize: 13, color: '#6B6B7B' }}>{lang === 'hi' ? 'कुल बचत की कीमत' : 'Your savings are worth'}</span>
                <b style={{ fontSize: 30, fontFamily: 'var(--mono)' }}>{rs(s.valuePaise)}</b>
                <span style={{ fontSize: 13, color: '#2F7D55' }}>+{rs(s.valuePaise - s.savedPaise)} {lang === 'hi' ? 'कमाई' : 'earned'} · {lang === 'hi' ? 'जमा' : 'put in'} {rs(s.savedPaise)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={card}><span style={{ fontSize: 12, color: '#6B6B7B' }}>{lang === 'hi' ? 'रोज़ की बचत' : 'Daily saving'}</span><b style={{ fontFamily: 'var(--mono)' }}>{s.pausedUntil ? (lang === 'hi' ? 'रुकी है' : 'Paused') : rs(s.dailyPaise)}</b></div>
                <div style={card}><span style={{ fontSize: 12, color: '#6B6B7B' }}>{lang === 'hi' ? 'लगातार' : 'Streak'}</span><b>🔥 {s.streakDays} {lang === 'hi' ? 'दिन' : 'days'}</b></div>
              </div>
              <div style={{ ...card, gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6B6B7B' }}>{lang === 'hi' ? 'आज की कटौती' : "Today's debits"}</span>
                {todayDebits.map((d) => <span key={d.ref} style={{ fontSize: 14, display: 'flex', justifyContent: 'space-between' }}><span>{d.ref}</span><b style={{ fontFamily: 'var(--mono)' }}>−{rs(d.amountPaise)}</b></span>)}
              </div>
              {hint}
            </>}
            {screen === 'save' && <>
              <div style={card}>
                <b>{lang === 'hi' ? 'रोज़ की बचत' : 'Daily saving'}</b>
                <span style={{ fontSize: 28, fontFamily: 'var(--mono)' }}>{rs(s.dailyPaise)}</span>
                <span style={{ fontSize: 13, color: '#6B6B7B' }}>{s.pausedUntil ? `${lang === 'hi' ? 'रुकी है' : 'Paused until'} ${s.pausedUntil}` : `${lang === 'hi' ? 'अगली बचत' : 'Next'}: ${s.nextDebit}`}</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[1000, 3000, 5000, 10000].map((p) => <button key={p} onClick={() => setS((x) => ({ ...x, dailyPaise: p }))} style={{ border: '1px solid #D9D6E6', background: s.dailyPaise === p ? '#5B3BC4' : '#fff', color: s.dailyPaise === p ? '#fff' : '#222', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}>{rs(p)}</button>)}</div>
              </div>
              {hint}
            </>}
            {screen === 'withdraw' && <>
              <div style={card}>
                <b>{lang === 'hi' ? 'पैसे निकालें' : 'Withdraw'}</b>
                <span style={{ fontSize: 13, color: '#6B6B7B' }}>{lang === 'hi' ? 'उपलब्ध' : 'Available'}: {rs(s.valuePaise)}</span>
                <label style={{ fontSize: 13 }}>{lang === 'hi' ? 'रकम (₹)' : 'Amount (₹)'}<input inputMode="numeric" value={wAmt} onChange={(e) => onAmt(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, height: 46, borderRadius: 10, border: '1px solid #D9D6E6', padding: '0 12px', fontSize: 18 }} /></label>
                <button disabled style={{ height: 46, borderRadius: 12, border: 0, background: '#C9C2EA', color: '#fff', fontWeight: 700 }}>{lang === 'hi' ? 'निकालें (डेमो)' : 'Withdraw (demo)'}</button>
              </div>
              {w && <div style={{ ...card, gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6B6B7B' }}>{lang === 'hi' ? 'पिछली निकासी' : 'Last withdrawal'} · {w.id}</span>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontFamily: 'var(--mono)' }}>{rs(w.amountPaise)}</b><span style={{ fontSize: 13, fontWeight: 600, color: w.status === 'paid' ? '#1F7A4D' : w.status === 'failed' ? '#B3261E' : '#8A5A00' }}>{w.status === 'paid' ? (lang === 'hi' ? 'सफल' : 'Successful') : w.status === 'failed' ? (lang === 'hi' ? 'फेल' : 'Failed') : (lang === 'hi' ? 'प्रोसेस हो रही है' : 'Processing')}</span></span>
                <span style={{ fontSize: 12, color: '#6B6B7B' }}>{lang === 'hi' ? 'माँगी' : 'Requested'} {w.requestedOn} · {lang === 'hi' ? 'आनी थी' : 'expected by'} {w.expectedBy}</span>
              </div>}
              {hint}
              {offer && (
                <div role="dialog" aria-label="Munim offer" style={{ ...card, border: '1px solid #5B3BC4' }}>
                  <b style={{ fontSize: 14 }}>{lang === 'hi' ? 'पैसे निकालने से पहले कुछ पूछना है?' : 'Any question before you withdraw?'}</b>
                  <span style={{ fontSize: 13, color: '#4B4B5C' }}>{lang === 'hi' ? 'मुनीम से बोलकर पूछिए: कब मिलेंगे, कोई चार्ज, या बचत कुछ दिन रोकनी है।' : 'Ask Munim: when it arrives, any charge, or pause saving for a few days instead.'}</span>
                  <div style={{ display: 'flex', gap: 8 }}><button onClick={() => openMunim('proactive')} style={{ border: 0, background: '#5B3BC4', color: '#fff', borderRadius: 10, padding: '9px 14px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}><Mic color="#fff" />{lang === 'hi' ? 'बोलकर पूछें' : 'Ask by voice'}</button><button onClick={() => { setOffer(false); bump('proactive_dismissed'); }} style={{ border: '1px solid #D9D6E6', background: '#fff', borderRadius: 10, padding: '9px 14px', cursor: 'pointer' }}>{lang === 'hi' ? 'अभी नहीं' : 'Not now'}</button></div>
                </div>
              )}
            </>}
          </main>

          {toast && <div role="status" style={{ position: 'absolute', left: 16, right: 16, bottom: 140, background: '#1F7A4D', color: '#fff', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontWeight: 600 }}>✓ {toast}</div>}
          <button aria-label="Ask Munim by voice" onClick={() => openMunim('fab')} style={{ position: 'absolute', right: 16, bottom: 72, width: 56, height: 56, borderRadius: '50%', border: 0, background: '#16201B', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 6px 18px rgba(0,0,0,.25)', cursor: 'pointer' }}><Mic size={24} color="#fff" /></button>
          <nav style={{ display: 'flex', background: '#fff', borderTop: '1px solid #E4E2EE' }}>{tab('home', lang === 'hi' ? 'होम' : 'Home')}{tab('save', lang === 'hi' ? 'बचत' : 'Save')}{tab('withdraw', lang === 'hi' ? 'निकालें' : 'Withdraw')}</nav>
          {kase && !open && <div role="status" style={{ position: 'absolute', left: 16, right: 16, top: 70, background: '#fff', border: '1px solid #5B3BC4', borderRadius: 14, padding: 12, fontSize: 12.5, display: 'grid', gap: 4, boxShadow: '0 4px 14px rgba(20,20,40,.12)' }}>
            <b style={{ fontSize: 13 }}>{lang === 'hi' ? 'केस' : 'Case'} {kase.id} · {lang === 'hi' ? 'टीम को भेजा गया' : 'sent to the team'}</b>
            <span style={{ color: '#4B4B5C' }}>{lang === 'hi' ? 'टीम का व्यक्ति यही नोट पढ़ेगा, आपको दोबारा कुछ नहीं बताना:' : 'What the person on the team reads first, so you never repeat yourself:'}</span>
            <code style={{ fontSize: 11.5, whiteSpace: 'pre-wrap', background: '#F2EEFF', padding: 8, borderRadius: 8 }}>{kase.summary.split('; ').join('\n')}</code>
            <button onClick={() => setKase(null)} style={{ justifySelf: 'end', border: 0, background: 'transparent', color: '#5B3BC4', cursor: 'pointer' }}>{lang === 'hi' ? 'ठीक है' : 'OK'}</button>
          </div>}
          {open && <MunimSheet source={open} screen={screen} lang={lang} setLang={setLang} state={s} onClose={() => setOpen(null)} onExecuted={(p) => { apply(p); if (p.type === 'handoff') setOpen(null); }} onSuccess={() => bump('voice_success')} onFeedback={(ok) => bump(ok ? 'feedback_solved' : 'feedback_not_solved')} />}
        </div>

        <div style={{ fontSize: 12, color: '#4B4B5C', padding: '0 16px', display: 'grid', gap: 6 }}>
          <span>Demo scenario (presenter): based on the top Play Store complaint themes · <a href="/research" style={{ color: '#5B3BC4' }}>see the research</a></span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(Object.keys(SCENARIOS) as Scenario[]).map((k) => <button key={k} aria-pressed={sc === k} onClick={() => pickScenario(k)} style={{ border: '1px solid #C9C2EA', background: sc === k ? '#5B3BC4' : '#fff', color: sc === k ? '#fff' : '#3E2A8C', borderRadius: 999, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>{SCENARIOS[k]}</button>)}</div>
        </div>
        <details style={{ fontSize: 12, color: '#4B4B5C', padding: '0 16px' }}>
          <summary style={{ cursor: 'pointer' }}>Pitch stats (this browser): discovery → adoption → usage</summary>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, marginTop: 6 }}>
            {[['Hint views', ['hint_view_home', 'hint_view_save', 'hint_view_withdraw']], ['Opened from in-task hint', ['entry_hint']], ['Opened from mic button', ['entry_fab']], ['Proactive offers shown', ['proactive_shown']], ['Opened from proactive offer', ['entry_proactive']], ['Successful voice answers', ['voice_success']], ['Actions confirmed by voice', ['action_confirmed']], ['"Solved it" (thumbs up)', ['feedback_solved']], ['"Didn\'t solve it" (thumbs down)', ['feedback_not_solved']], ['Handed to a person', ['handoff']], ['Refund requests raised', ['refund_request']]].map(([label, keys]) => <Fragment key={String(label)}><span>{label}</span><b>{(keys as string[]).reduce((a, k) => a + (f[k] ?? 0), 0)}</b></Fragment>)}
          </div>
          <button onClick={reset} style={{ marginTop: 6, fontSize: 12 }}>Reset</button>
        </details>
      </div>
    </div>
  );
}

function MunimSheet({ source, screen, lang, setLang, state, onClose, onExecuted, onSuccess, onFeedback }: { source: Source; screen: Screen; lang: Lang; setLang: (l: Lang) => void; state: HostState; onClose: () => void; onExecuted: (p: Proposal) => void; onSuccess: () => void; onFeedback: (solved: boolean) => void }) {
  const misses = useRef(0); const [rated, setRated] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [heard, setHeard] = useState(''); const [reply, setReply] = useState<Reply | null>(null);
  const [pending, setPending] = useState<Proposal | null>(null); const [err, setErr] = useState('');
  const recRef = useRef<RecorderHandle | null>(null);
  const sid = useRef(''); useEffect(() => { try { sid.current = localStorage.getItem('munim-sid') ?? ''; } catch { /* ignore */ } }, []);
  const L = reply?.lang ?? lang;

  const speak = async (text: string, l: Lang) => {
    setPhase('speaking');
    try {
      const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang: l }) });
      if (r.ok) { const j = await r.json(); await playBase64(j.audioBase64, j.mime); } else await browserSpeak(text, l);
    } catch { await browserSpeak(text, l); }
    setPhase('idle');
  };
  const ask = async (q: string) => {
    if (!q.trim()) return; setErr(''); setHeard(q); setPhase('thinking');
    try {
      const r = await fetch('/api/host/agent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sid': sid.current }, body: JSON.stringify({ text: q, lang: 'auto', screen, state, pending, misses: misses.current }) });
      const j = (await r.json()) as Reply;
      if (!r.ok) throw new Error((j as unknown as { error?: string }).error ?? 'Failed');
      setReply(j); setRated(false);
      misses.current = j.intent === 'help' || j.intent === 'offer_handoff' ? misses.current + 1 : 0;
      if (j.executed) { onExecuted(j.executed); setPending(null); } else setPending(j.proposal ?? (j.intent === 'cancel' ? null : pending));
      if (j.intent !== 'help') onSuccess();
      await speak(j.speech, j.lang);
    } catch (e) { setErr((e as Error).message); setPhase('idle'); }
  };
  const mic = async () => {
    if (phase === 'speaking') { stopSpeaking(); setPhase('idle'); return; }
    if (phase === 'listening') { recRef.current?.stop(); return; }
    setErr(''); setPhase('listening'); setHeard('');
    try {
      recRef.current = await record({ onDone: async (rec) => {
        recRef.current = null;
        if (!rec) { setPhase('idle'); return; }
        setPhase('thinking');
        const fd = new FormData(); fd.append('file', rec.blob, 'speech.webm'); fd.append('lang', lang);
        const r = await fetch('/api/stt', { method: 'POST', body: fd, headers: { 'x-sid': sid.current } }).catch(() => null);
        const j = r && r.ok ? await r.json() : null;
        if (j?.transcript) { if (j.languageCode?.startsWith('en')) setLang('en'); return ask(j.transcript); }
        if (browserSttAvailable()) { setPhase('listening'); browserListen(lang, setHeard, (t) => (t ? ask(t) : setPhase('idle')), (e) => { setErr(e); setPhase('idle'); }); return; }
        setErr(lang === 'hi' ? 'आवाज़ समझ नहीं आई। नीचे से कोई सवाल चुनिए।' : "Couldn't catch that. Pick a question below."); setPhase('idle');
      } });
    } catch { setErr(lang === 'hi' ? 'माइक की अनुमति दीजिए, या नीचे से सवाल चुनिए।' : 'Allow the microphone, or pick a question below.'); setPhase('idle'); }
  };
  useEffect(() => () => { stopSpeaking(); recRef.current?.cancel(); }, []);

  return (
    <div role="dialog" aria-label="Munim voice helper" style={{ position: 'absolute', inset: 0, background: 'rgba(15,15,30,.35)', display: 'flex', alignItems: 'flex-end' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', background: '#16201B', color: '#F3F4EF', borderRadius: '22px 22px 0 0', padding: '16px 16px 20px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>Munim <span style={{ fontWeight: 400, color: '#B9C4BC', fontSize: 13 }}>{source === 'proactive' ? '· offered to help' : '· voice helper'}</span></b>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: 'transparent', color: '#B9C4BC', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
          <button onClick={mic} aria-label={phase === 'listening' ? 'Stop' : 'Speak'} style={{ width: 84, height: 84, borderRadius: '50%', border: 0, background: phase === 'listening' ? '#C0412B' : phase === 'speaking' ? '#2C6E8C' : phase === 'thinking' ? '#4A564F' : '#2C8C62', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Mic size={34} color="#fff" /></button>
          <span aria-live="polite" style={{ fontSize: 14, color: '#B9C4BC' }}>{phase === 'listening' ? (L === 'hi' ? 'सुन रहा हूँ…' : 'Listening…') : phase === 'thinking' ? (L === 'hi' ? 'देख रहा हूँ…' : 'Checking…') : phase === 'speaking' ? (L === 'hi' ? 'बोल रहा हूँ… टैप करके रोकें' : 'Speaking… tap to stop') : (L === 'hi' ? 'टैप करके बोलिए' : 'Tap and speak')}</span>
        </div>
        {heard && <div style={{ justifySelf: 'end', background: '#2A3A31', borderRadius: '14px 14px 4px 14px', padding: '8px 12px', fontSize: 15, maxWidth: '85%' }}>{heard}</div>}
        {reply && <div style={{ background: '#F3F4EF', color: '#16201B', borderRadius: '14px 14px 14px 4px', padding: '10px 12px', fontSize: 15, lineHeight: 1.5, maxWidth: '92%' }}>
          {reply.answer}
          <div style={{ fontSize: 11.5, color: '#5D6862', marginTop: 4 }}>{reply.check.checked > 0 && reply.check.ok ? '✓ numbers from your account · ' : ''}{reply.engine === 'claude' ? 'Claude' : 'rules'} · {(reply.ms / 1000).toFixed(1)}s</div>
          {!pending && phase === 'idle' && !['help', 'handoff', 'confirm', 'cancel'].includes(reply.intent) && (rated
            ? <div style={{ fontSize: 12, color: '#5D6862', marginTop: 6 }}>{L === 'hi' ? 'धन्यवाद' : 'Thanks'}</div>
            : <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 12.5 }}>
              <span>{L === 'hi' ? 'काम बना?' : 'Did this solve it?'}</span>
              <button onClick={() => { setRated(true); onFeedback(true); }} style={{ border: '1px solid #C9D3CC', background: '#fff', borderRadius: 8, padding: '3px 10px', cursor: 'pointer' }}>{L === 'hi' ? 'हाँ' : 'Yes'}</button>
              <button onClick={() => { setRated(true); onFeedback(false); void ask(L === 'hi' ? 'इंसान से बात कराओ' : 'connect me to a person'); }} style={{ border: '1px solid #C9D3CC', background: '#fff', borderRadius: 8, padding: '3px 10px', cursor: 'pointer' }}>{L === 'hi' ? 'नहीं, इंसान से बात' : 'No, talk to a person'}</button>
            </div>)}
        </div>}
        {pending && <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => ask(L === 'hi' ? 'हाँ' : 'yes')} style={{ flex: 1, border: 0, borderRadius: 12, padding: 12, background: '#6CC79C', color: '#0B0F0D', fontWeight: 700, cursor: 'pointer' }}>{L === 'hi' ? 'हाँ, कर दो' : 'Yes, do it'}</button>
          <button onClick={() => ask(L === 'hi' ? 'नहीं' : 'no')} style={{ flex: 1, border: '1px solid #3B4A42', borderRadius: 12, padding: 12, background: 'transparent', color: '#F3F4EF', cursor: 'pointer' }}>{L === 'hi' ? 'नहीं' : 'No'}</button>
        </div>}
        {err && <span style={{ color: '#E58B7A', fontSize: 13 }}>{err}</span>}
        {!pending && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{CHIPS[screen][lang].map((c) => <button key={c} disabled={phase !== 'idle'} onClick={() => ask(c)} style={{ border: '1px solid #3B4A42', background: 'transparent', color: '#F3F4EF', borderRadius: 999, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>{c}</button>)}</div>}
        <span style={{ fontSize: 11, color: '#9AA59D' }}>{lang === 'hi' ? 'मुनीम सिर्फ़ सुझाव देता है; बदलाव आपकी “हाँ” के बाद ही होता है।' : 'Munim only suggests; nothing changes until you say yes.'}</span>
      </div>
    </div>
  );
}
