'use client';
// Ask Munim, live: typed questions answered by /api/ask from the engine's figures. Same sheet, tokens and type as designs/Voice.
// Context-aware: the screen you came from (?from= or the referrer) picks the suggested questions.
// Voice input comes next (port of apps/voice-cfo STT); v1 is typed so no audio leaves the phone yet.
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';

type Msg = { role: 'user' | 'assistant'; content: string; meta?: { checked: number; ok: boolean; tools: string[]; engine: string } };
type Ctx = 'xray' | 'invest' | 'spends' | 'today';

const CHIPS: Record<Ctx, { label: string; q: string[] }> = {
  xray: { label: 'your funds', q: ['Should I switch to direct plans?', 'How much can I book tax-free this year?', 'Are my funds beating an FD?'] },
  invest: { label: 'your savings', q: ['How big is my safety net?', 'How are my funds doing?', 'Is my term cover enough?'] },
  spends: { label: 'your spending', q: ['Where is my money going?', 'Which subscriptions should I cut?', 'Anything unusual this month?'] },
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
  const ctx: Ctx = path.startsWith('/invest/xray') ? 'xray' : path.startsWith('/invest') ? 'invest' : path.startsWith('/spends') ? 'spends' : 'today';
  return { ctx, back: path.startsWith('/') && !path.startsWith('//') ? path : '/' };
}

export default function AskLive() {
  const [{ ctx, back }, setCtx] = useState<{ ctx: Ctx; back: string }>({ ctx: 'today', back: '/' });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { const c = ctxOf(); setCtx(c); track('ask_opened', { ctx: c.ctx }); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  async function ask(q: string) {
    q = q.trim(); if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs(next); setText(''); setBusy(true); setErr(null);
    track('ask_sent', { ctx, turn: next.filter((m) => m.role === 'user').length });
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Munim could not answer just now.');
      setMsgs([...next, { role: 'assistant', content: j.answer, meta: { checked: j.check?.checked ?? 0, ok: !!j.check?.ok, tools: j.tools ?? [], engine: j.engine } }]);
    } catch (e) { setErr((e as Error).message); setMsgs(next); }
    finally { setBusy(false); input.current?.focus(); }
  }
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user')?.content;

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <section role="dialog" aria-label="Ask Munim" style={S.sheet}>
        <div aria-hidden="true" style={S.grab} />
        <header style={S.head}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Asking about <b style={{ color: 'var(--ink2)', fontWeight: 600 }}>{CHIPS[ctx].label}</b></span>
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
                {m.meta && (
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                    {m.meta.tools.length ? `From ${[...new Set(m.meta.tools.map((t) => TOOL_LABEL[t] ?? 'your documents'))].join(', ')}` : 'General help'}
                    {m.meta.checked ? ` · ${m.meta.checked} number${m.meta.checked > 1 ? 's' : ''} ${m.meta.ok ? 'checked' : 'could not be checked'}` : ''}
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
          {err && (
            <div role="alert" style={S.err}>
              <span style={{ flex: 1, fontSize: 14 }}>{err}</span>
              {lastUser && <button type="button" onClick={() => { setMsgs(msgs.slice(0, -1)); ask(lastUser); }} style={S.retry}>Retry</button>}
            </div>
          )}
          {!!msgs.length && !busy && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{CHIPS[ctx].q.filter((q) => !msgs.some((m) => m.content === q)).slice(0, 2).map((q) => <button key={q} type="button" className="chip chip-sm" onClick={() => ask(q)}>{q}</button>)}</div>}
          <div ref={end} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); ask(text); }} style={S.bar}>
          <label htmlFor="q" style={S.sr}>Your question</label>
          <textarea id="q" ref={input} rows={1} value={text} placeholder="Type your question" maxLength={500} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }} style={S.input} />
          <button type="submit" disabled={!text.trim() || busy} aria-label="Ask" className="orb-teal" style={{ ...S.send, opacity: !text.trim() || busy ? 0.5 : 1 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
        <span style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>General guidance, not SEBI-registered investment advice.</span>
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
  page: { width: '100%', maxWidth: 480, height: '100dvh', margin: '0 auto', position: 'relative', background: 'var(--scrim)', color: 'var(--ink)', fontSize: 15, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' },
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
  sr: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' },
};
