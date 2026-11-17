'use client';
// The owner's turn log (D-089): every Ask turn from a browser marked with #owner=<key>, newest first. What was asked, what
// Munim said, each stage's time, tokens, the estimated cost, and what the cut-in listener heard (D-090). The bad turns
// are flagged; "Copy draft tests" turns them into draft eval cases (the self-improving loop: a person rewrites each for
// the sample family, and any fix ships only after the evals pass). Not linked from the app; the API refuses other browsers.
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/ui/Screen';
import { rupees, PRICES_AS_OF } from '@/lib/cost';
import { draftCase, flagsOf, type LogSummary, type TurnRecord } from '@/lib/turnLog';

const sec = (ms?: number | null) => (ms === null || ms === undefined ? '–' : `${(ms / 1000).toFixed(1)} s`);
const FLAG: Record<string, string> = { thumbs_down: 'thumbs down', unverified_numbers: 'number not from a tool', number_repair: 'number repaired', advice_check: 'advice check fired',
  fell_back: 'fell back to rules', slow: 'slow', tapped_to_cut_in: 'you tapped to cut in', cut_in_missed: 'cut-in nearly heard you' };

export default function Owner() {
  useTheme();
  const [state, setState] = useState<{ turns: TurnRecord[]; summary: LogSummary } | { error: string } | null>(null);
  const [only, setOnly] = useState<'all' | 'flagged' | 'voice'>('all');
  const [note, setNote] = useState<string | null>(null);
  const load = () => fetch('/api/turns', { cache: 'no-store' }).then(async (r) => { const j = await r.json(); setState(r.ok ? j : { error: j.error ?? 'Could not load the log.' }); }).catch(() => setState({ error: 'Offline.' }));
  useEffect(() => { void load(); }, []);
  const turns = useMemo(() => (state && 'turns' in state ? state.turns.filter((t) => only === 'all' || (only === 'voice' ? t.via === 'voice' : flagsOf(t).length > 0)) : []), [state, only]);

  if (!state) return <main style={S.page}><p style={S.muted}>Loading…</p></main>;
  if ('error' in state) return <main style={S.page}><h1 style={S.h1}>Turn log</h1><p style={S.muted}>{state.error}</p>
    <p style={S.muted}>To mark this browser as yours, open the app once with <code>#owner=&lt;your key&gt;</code> at the end of the address.</p></main>;
  const s = state.summary;
  const flagged = state.turns.filter((t) => flagsOf(t).length);
  const copy = async () => {
    const text = flagged.map((t, i) => draftCase(t, i + 1)).join('\n');
    try { await navigator.clipboard.writeText(text); setNote(`Copied ${flagged.length} draft test${flagged.length === 1 ? '' : 's'} for evals/cases.ts.`); } catch { setNote('Copy failed: use Download instead.'); }
  };
  const download = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state.turns, null, 1)], { type: 'application/json' }));
    a.download = `munim-turns-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  const clear = async () => { if (!confirm('Delete every turn in the log? This cannot be undone.')) return; await fetch('/api/turns', { method: 'DELETE' }); void load(); };

  return (
    <main style={S.page}>
      <h1 style={S.h1}>Turn log</h1>
      <p style={S.muted}>Your browsers only. Kept 90 days. Costs are estimates at list prices of {PRICES_AS_OF}, before GST.</p>
      <section style={S.grid} aria-label="Summary">
        <Stat k="Turns" v={`${s.turns}`} sub={`${s.voice} voice · ${s.typed} typed`} />
        <Stat k="Question end → first word" v={sec(s.totalMs.p50)} sub={`median · 90% within ${sec(s.totalMs.p90)}`} />
        <Stat k="Hearing · answer · first word" v={`${sec(s.sttMs.p50)} · ${sec(s.agentMs.p50)} · ${sec(s.firstWordMs.p50)}`} sub="medians, voice" />
        <Stat k="Cost" v={rupees(s.cost.total)} sub={`${s.cost.perTurn === null ? '–' : rupees(s.cost.perTurn)} a turn · model ${rupees(s.cost.llm)} · check ${rupees(s.cost.judge)} · hearing ${rupees(s.cost.stt)} · voice ${rupees(s.cost.tts)}`} />
        <Stat k="Needs a look" v={`${s.flagged}`} sub={`${s.down} thumbs down · ${s.up} up`} />
        <Stat k="Cutting in" v={`${s.cutIn.heard} by voice · ${s.cutIn.tapped} by tap`} sub={`${s.cutIn.missed} nearly heard`} />
      </section>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        {(['all', 'flagged', 'voice'] as const).map((k) => <button key={k} type="button" onClick={() => setOnly(k)} aria-pressed={only === k} style={{ ...S.chip, ...(only === k ? { background: 'var(--tint)', fontWeight: 600 } : {}) }}>{k === 'all' ? 'All' : k === 'flagged' ? `Needs a look (${flagged.length})` : 'Voice'}</button>)}
        <button type="button" style={{ ...S.chip, opacity: flagged.length ? 1 : 0.5 }} onClick={copy} disabled={!flagged.length}>Copy draft tests</button>
        <button type="button" style={S.chip} onClick={download}>Download JSON</button>
        <button type="button" style={S.chip} onClick={clear}>Delete all</button>
      </div>
      {note && <p role="status" style={S.muted}>{note}</p>}
      {!turns.length && <p style={S.muted}>Nothing yet. Ask Munim something from this browser.</p>}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {turns.map((t) => <Turn key={t.id} t={t} />)}
      </ol>
    </main>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub: string }) {
  return <div style={S.card}><div style={S.k}>{k}</div><div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{v}</div><div style={S.sub}>{sub}</div></div>;
}

function Turn({ t }: { t: TurnRecord }) {
  const f = flagsOf(t);
  return (
    <li style={{ ...S.card, display: 'grid', gap: 6 }}>
      <div style={S.sub}>{new Date(t.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {t.via} · {t.lang} · {t.data === 'mine' ? 'your data' : 'sample'} · {t.model ?? t.engine}{t.vote ? ` · ${t.vote === 'up' ? '👍' : '👎'}${t.reason ? ` ${t.reason.replace(/_/g, ' ')}` : ''}` : ''}</div>
      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.question || '(no text)'}</div>
      <details><summary style={{ cursor: 'pointer', color: 'var(--ink2)' }}>{t.answer.slice(0, 140)}{t.answer.length > 140 ? '…' : ''}</summary><p style={{ whiteSpace: 'pre-wrap', color: 'var(--ink2)', margin: '6px 0 0' }}>{t.answer}</p></details>
      <div style={S.sub}>
        {t.via === 'voice' ? `hearing ${sec(t.ms.stt)} · answer ${sec(t.ms.agent)} · first word ${sec(t.ms.firstWord)} · total ${sec(t.ms.total)}` : `answer ${sec(t.ms.agent)}`}
        {t.cost ? ` · ${rupees(t.cost.total)}` : ''}{t.tokens ? ` · ${t.tokens.calls} model call${t.tokens.calls === 1 ? '' : 's'}, ${t.tokens.input + t.tokens.cacheRead + t.tokens.cacheWrite} in (${t.tokens.cacheRead} cached) / ${t.tokens.output} out` : ''}
      </div>
      <div style={S.sub}>tools: {t.tools.length ? [...new Set(t.tools)].join(', ') : 'none'} · numbers {t.check.ok ? 'checked' : `${t.check.unverified} unverified`}{t.guard && t.guard !== 'none' ? ` · advice check: ${t.guard}` : ''}</div>
      {t.cutIn && t.cutIn.how !== undefined && <div style={S.sub}>cut-in: {t.cutIn.how === 'voice' ? `heard you at ${sec(t.cutIn.atMs)}` : t.cutIn.how === 'tap' ? 'you tapped' : 'not used'} · bar {t.cutIn.need} (echo {t.cutIn.floor}) · loudest {t.cutIn.peak}, 90% under {t.cutIn.p90}{t.cutIn.ctx && t.cutIn.ctx !== 'running' ? ` · audio ${t.cutIn.ctx}` : ''}</div>}
      {!!f.length && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{f.map((x) => <span key={x} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'var(--mari-tint)', color: 'var(--mari-ink)' }}>{FLAG[x] ?? x}</span>)}</div>}
    </li>
  );
}

const S = {
  page: { maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px', background: 'var(--bg)', minHeight: '100dvh', fontFamily: 'IBM Plex Sans, system-ui, sans-serif' } as React.CSSProperties,
  h1: { fontFamily: 'Noto Serif, serif', fontSize: 26, margin: '0 0 4px', color: 'var(--ink)' } as React.CSSProperties,
  muted: { color: 'var(--muted)', fontSize: 14, margin: '4px 0' } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 16 } as React.CSSProperties,
  card: { background: 'var(--card)', border: '1px solid var(--hair)', borderRadius: 12, padding: '12px 14px' } as React.CSSProperties,
  k: { fontSize: 12, color: 'var(--muted)', marginBottom: 2 } as React.CSSProperties,
  chip: { font: 'inherit', fontSize: 13, color: 'var(--ink)', background: 'var(--card)', border: '1px solid var(--hair2)', borderRadius: 999, padding: '6px 12px', minHeight: 36, cursor: 'pointer' } as React.CSSProperties,
  sub: { fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 } as React.CSSProperties,
};
