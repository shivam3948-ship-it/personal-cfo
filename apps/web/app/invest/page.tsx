'use client';
import { useState } from 'react';
import { useApp } from '../client';
import { Screen, ShowMath, WithSummary } from '../ui';
import { parseCas, type CasResult } from '@/lib/portfolio/cas';
import { CasPasswordError, pdfLines } from '@/lib/portfolio/pdf-lines';

const COLORS: Record<string, string> = { equity: '#136F4B', debt: '#9A5B0B', hybrid: '#2C6E8C', gold: '#B08A2E', other: '#5D6862' };

function CasUpload({ onDone }: { onDone: () => void }) {
  const { api } = useApp();
  const [file, setFile] = useState<File | null>(null); const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [res, setRes] = useState<CasResult | null>(null);
  const isPdf = !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));

  const read = async () => {
    if (!file) return; setBusy(true); setErr(''); setRes(null);
    try {
      const text = isPdf ? await pdfLines(new Uint8Array(await file.arrayBuffer()), pw || undefined) : await file.text();
      const r = parseCas(text);
      if (r.kind === 'summary') throw new Error('This is a summary statement. Request a *detailed* CAS (from your first investment) so we can work out your real returns.');
      if (!r.holdings.length) throw new Error("We couldn't find any funds in this file. Is it a CAMS/KFintech detailed CAS?");
      setRes(r);
    } catch (e) {
      setErr(e instanceof CasPasswordError ? (e.wrong ? 'That password didn’t open it. CAMS/KFintech: the password you set when requesting it.' : 'This PDF is locked. Enter the password you set when you requested the CAS.') : (e as Error).message);
    } finally { setBusy(false); }
  };
  const save = async () => {
    if (!res) return; setBusy(true); setErr('');
    const failed = res.checks.filter((c) => !c.ok);
    if (failed.length) { setErr(`${failed.length} check(s) failed, so we won't show these numbers. ${failed[0].label}: ${failed[0].detail}`); setBusy(false); return; }
    const r = await api('/api/portfolio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ asOf: res.asOf, holdings: res.holdings, checks: res.checks, source: 'Your CAS' }) });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? 'Could not save'); return; }
    setPw(''); setFile(null); setRes(null); onDone();
  };

  return (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      <b>Add your mutual fund statement (CAS)</b>
      <span className="sub" style={{ lineHeight: 1.5 }}>Get a <b>detailed</b> CAS from CAMS, KFintech or MF Central, from your first investment. It is opened here on your device; the PDF and its password are never uploaded. Only fund names, units and values are saved.</span>
      <input type="file" accept=".pdf,.txt,application/pdf,text/plain" aria-label="CAS file" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRes(null); setErr(''); }} />
      {isPdf && <div className="field"><label htmlFor="pw">PDF password</label><input id="pw" type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} /></div>}
      {!res ? <button className="btn primary" onClick={read} disabled={!file || busy}>{busy ? 'Reading on your device…' : 'Read statement'}</button> : (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="note green"><b>Read {res.holdings.length} funds · as of {res.asOf}</b><span>{res.checks.filter((c) => c.ok).length}/{res.checks.length} checks pass{res.printedTotal !== null ? '; fund values add up to the statement total' : ''}.</span></div>
          <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save to Munim'}</button>
        </div>
      )}
      {err && <span className="err" role="alert">{err}</span>}
    </div>
  );
}

export default function Invest() {
  const { refresh, signedIn } = useApp();
  const [adding, setAdding] = useState(false);
  return (
    <Screen title="Investments" right={<button className="btn small" onClick={() => setAdding((x) => !x)}>{adding ? 'Close' : 'Update CAS'}</button>}>
      {adding && <CasUpload onDone={() => { setAdding(false); void refresh(); }} />}
      <WithSummary>{(s) => {
        const p = s.portfolio_overview ?? {};
        if (p.available === false) return !adding ? <div className="card" style={{ display: 'grid', gap: 8 }}><b>No mutual funds yet</b><span className="sub">Add your CAS to see value, returns, mix and what regular plans cost you.</span><button className="btn primary small" style={{ justifySelf: 'start' }} onClick={() => setAdding(true)}>Add CAS</button></div> : null;
        const rp = p.regular_plans ?? {};
        return (<>
          {!signedIn && s.isSample && <span className="sub">Sample portfolio from a synthetic CAS. Sign in to add yours.</span>}
          <div className="card" style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ display: 'grid', gap: 2 }}><span className="sub">Current value</span><span className="big" style={{ fontSize: 28 }}>{p.current_value}</span></div>
              <div style={{ display: 'grid', gap: 2, justifyItems: 'end' }}><span className="sub">Your return</span><span className="mono pos" style={{ fontSize: 20 }}>{p.return_per_year ?? '—'} a year</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: 13, color: 'var(--ink-2)' }}><span>Invested {p.invested}</span><span>Gain {p.gain}</span>{p.sip_per_month && <span>SIP {p.sip_per_month}/mo</span>}</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div className="bar">{(p.mix ?? []).map((m: { asset: string; share: string }) => <i key={m.asset} style={{ width: m.share, background: COLORS[m.asset] ?? '#5D6862' }} />)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: 12.5, color: 'var(--ink-2)' }}>{(p.mix ?? []).map((m: { asset: string; share: string }) => <span key={m.asset} style={{ textTransform: 'capitalize' }}>{m.asset} {m.share}</span>)}</div>
            </div>
          </div>
          {rp.funds > 0 && (
            <div className="note amber">
              <b>{rp.share} of your money is in regular plans</b>
              <span>{rp.funds} {rp.funds === 1 ? 'fund pays' : 'funds pay'} distributor commission. Direct plans of the same funds would cost about <b>{rp.estimated_extra_cost_per_year} a year</b> less at today's value.</span>
              <span className="est">Estimate. {rp.basis}</span>
            </div>
          )}
          <div className="eyebrow">{p.funds?.length} funds</div>
          {(p.funds ?? []).map((f: { fund: string; plan: string; category: string; value: string; return_per_year: string | null; share: string }) => (
            <div key={f.fund + f.plan} className="tile">
              <span style={{ minWidth: 0 }}><b style={{ fontSize: 13.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fund}</b><small>{f.category} · <span className={f.plan === 'Regular' ? 'neg' : 'pos'} style={{ fontWeight: 600 }}>{f.plan}</span> · {f.share}</small></span>
              <span style={{ display: 'grid', justifyItems: 'end', gap: 2, flex: 'none' }}><span className="mono" style={{ fontSize: 13.5 }}>{f.value}</span><small style={{ fontSize: 12, color: 'var(--ink-2)' }}>{f.return_per_year ?? '—'} a year</small></span>
            </div>
          ))}
          <span className="sub" style={{ textAlign: 'center', fontSize: 12 }}>{p.source} · {p.checks} · as of {p.as_of}</span>
          <ShowMath data={p} />
        </>);
      }}</WithSummary>
    </Screen>
  );
}
