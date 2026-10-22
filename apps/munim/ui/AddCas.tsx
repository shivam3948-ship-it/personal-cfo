'use client';
// Add your CAS (mock: Upload.dc.html, confirmed 22 Oct). Everything here runs on the phone: the PDF is read in the browser,
// the password is used once and dropped, and only scheme/units/NAV/value/dated flows are saved in this browser.
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { saveCas, loadCas, deleteCas, PdfPasswordError, type LocalCas, type ReadResult } from '@/lib/local/cas';
import { readAny, loadStatements, deleteStatement, type SavedStatement } from '@/lib/local/statements';
import type { BankRead } from '@core/ingest/banks';

type Step = 'intro' | 'password' | 'reading' | 'done' | 'summary' | 'partial' | 'mismatch' | 'unknown' | 'bank';
const R = (p: number) => '₹' + Math.round(p / 100).toLocaleString('en-IN');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso: string) => (iso ? `${+iso.slice(8, 10)} ${MON[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : '');
const fund = (scheme: string) => scheme.replace(/\s*-\s*(Direct|Regular)\b.*$/i, '').replace(/ Fund$/, '');

export default function AddCas() {
  const [step, setStep] = useState<Step>('intro');
  const [file, setFile] = useState<File | null>(null);
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [how, setHow] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [res, setRes] = useState<ReadResult | null>(null);
  const [saved, setSaved] = useState<LocalCas | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bank, setBank] = useState<{ read: BankRead; ok: boolean } | null>(null);
  const [stmts, setStmts] = useState<SavedStatement[]>([]);
  const [diag, setDiag] = useState('');
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => { loadCas().then((c) => { if (c) { setSaved(c); setStep('done'); } }); loadStatements().then(setStmts); track('cas_add_opened'); }, []);

  const choose = () => { setErr(null); picker.current?.click(); };
  async function read(f: File, password?: string) {
    setStep('reading'); setProgress(1); setErr(null); setWrong(false);
    const tick = setInterval(() => setProgress((p) => Math.min(3, p + 1)), 600);
    try {
      const any = await readAny(f, password);
      setPw(''); // used once, never kept
      if (any.type === 'bank') {
        setBank({ read: any.read, ok: any.ok }); setDiag(''); setStmts(await loadStatements());
        track('statement_read', { format: any.read.format, ok: any.ok, rows: any.read.txns.length });
        setStep('bank'); return;
      }
      if (any.type === 'unknown') { setDiag(any.diagnostics); setRes(null); setStep('unknown'); track('cas_read', { result: 'unrecognised' }); return; }
      const r = any.cas;
      setRes(r);
      if (r.cas) { await saveCas(r.cas); setSaved(r.cas); }
      setPw(''); // used once, never kept
      const next: Step = r.kind === 'summary' ? 'summary' : r.kind === 'partial' ? 'partial' : !r.cas ? 'unknown' : r.cas.skipped.length ? 'mismatch' : 'done';
      track('cas_read', { result: next, funds: r.cas?.holdings.length ?? 0 });
      setStep(next);
    } catch (e) {
      if (e instanceof PdfPasswordError) { setWrong(e.reason === 'wrong'); setStep('password'); track('cas_read', { result: e.reason === 'wrong' ? 'wrong_password' : 'needs_password' }); }
      else { setErr('Couldn’t read this file. Is it a CAS, or an HDFC or SBI statement PDF?'); setStep('intro'); track('cas_read', { result: 'unreadable' }); }
    } finally { clearInterval(tick); }
  }
  const onPick = (f?: File) => { if (!f) return; setFile(f); setPw(''); setWrong(false); read(f); }; // try without a password first
  const del = async () => { await deleteCas(); setSaved(null); setRes(null); setFile(null); setStep('intro'); track('cas_deleted'); };
  const copyDiag = async () => { const t = res?.diagnostics || diag; if (!t) return; try { await navigator.clipboard.writeText(t); setCopied(true); } catch { setCopied(false); } };
  const delStmt = async (key: string) => { await deleteStatement(key); setStmts(await loadStatements()); track('statement_deleted'); };

  const cas = saved;
  const funds = cas?.holdings.length ?? 0, flows = cas ? cas.holdings.reduce((a, h) => a + h.flows.length, 0) : 0;
  const value = cas ? cas.holdings.reduce((a, h) => a + h.value, 0) : 0;
  const checks = (cas?.checks ?? []).filter((c) => c.id.startsWith('units:') || c.id === 'total').map((c) => ({
    ok: c.ok, t: c.id === 'total' ? 'Fund values add up to the statement total' : `${fund(c.label.split(':')[0])}: ${c.ok ? c.detail.replace(/ to [\d.]+ units$/, '') : 'doesn’t add up'}` }));

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <input ref={picker} type="file" accept="application/pdf,.pdf,.txt" hidden onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
      <div style={S.scroll}>
        <header style={S.head}>
          <a href="/invest" aria-label="Back" style={S.back}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></a>
          <h1 className="serif" style={{ margin: 0, fontSize: 26 }}>{step === 'done' ? 'Your statements' : 'Add your statements'}</h1>
        </header>

        {err && <p role="alert" style={S.err}>{err}</p>}

        {step === 'intro' && <>
          <section style={S.card}>
            <span style={S.kicker}>Mutual funds</span>
            <b className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>Add your CAS to see your own X-ray</b>
            <span style={S.sub}>The detailed CAS from CAMS or KFintech lists every fund and transaction. Munim reads it and checks every number against the statement itself.</span>
            <button type="button" onClick={choose} style={S.primary}>Choose CAS PDF</button>
            <button type="button" onClick={() => setHow(!how)} aria-expanded={how} style={S.link}>{how ? 'Hide' : 'How do I get my CAS?'}</button>
            {how && <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, fontSize: 14, color: 'var(--ink2)' }}>
              <li>On the CAMS website, open the consolidated account statement (CAS) request for CAMS and KFintech funds.</li>
              <li>Choose <b>Detailed</b> (with transactions), a period from your first investment to today, and set a password.</li>
              <li>The PDF arrives by email in a few minutes. Save it to your phone.</li>
            </ol>}
          </section>
          <section style={S.card}>
            <span style={S.kicker}>Bank and card statements</span>
            <b className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>See where your own money went</b>
            <span style={S.sub}>HDFC and SBI savings accounts, HDFC credit cards. Each statement is checked against its own totals to the paisa before Munim uses it.</span>
            <button type="button" onClick={choose} style={S.primary}>Choose statement PDF</button>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>ICICI and other banks: coming next.</span>
          </section>
          <StatementList list={stmts} onDelete={delStmt} />
        </>}

        {step === 'bank' && bank && <>
          <section role={bank.ok ? undefined : 'alert'} style={S.card}>
            <span style={bank.ok ? S.okTag : S.warnTag}>{bank.ok ? '✓ Balances to the paisa' : 'Didn’t add up'}</span>
            <b className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>{bank.read.account.label}</b>
            <span style={S.sub}>{bank.read.period ? `${day(bank.read.period.from)} – ${day(bank.read.period.to)} · ` : ''}{bank.read.txns.length} transactions{bank.read.stmt ? ` · total due ${R(bank.read.stmt.totalDue)}` : ''}</span>
            <div style={{ display: 'grid', gap: 6 }}>{bank.read.checks.map((c) => <span key={c.id} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: 'var(--ink2)' }}><span style={{ color: c.ok ? 'var(--link)' : 'var(--err-ink)', fontWeight: 700 }}>{c.ok ? '✓' : '✕'}</span>{c.label}</span>)}</div>
            {bank.ok ? <a href="/spends" style={{ ...S.primary, display: 'grid', placeItems: 'center', textDecoration: 'none' }}>See your spends</a>
              : <span style={S.sub}>Munim didn’t save it: a statement is only used when it reconciles. Try the PDF straight from your bank’s site.</span>}
            <button type="button" onClick={choose} style={S.link}>Add another statement</button>
          </section>
          <StatementList list={stmts} onDelete={delStmt} />
        </>}

        {step === 'password' && file && <section style={S.card}>
          <div style={S.fileChip}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--link)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
            <button type="button" onClick={choose} style={S.inlineLink}>Change</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (pw) read(file, pw); }} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}><span style={{ fontSize: 14, fontWeight: 600 }}>PDF password</span>
              <span style={{ ...S.field, boxShadow: `inset 0 0 0 ${wrong ? '2px var(--err-ink)' : '1.5px var(--hair2)'}` }}>
                <input type={show ? 'text' : 'password'} value={pw} onChange={(e) => { setPw(e.target.value); setWrong(false); }} autoComplete="off" autoCapitalize="off" spellCheck={false} autoFocus aria-invalid={wrong} placeholder="Your CAS password" style={S.input} />
                <button type="button" onClick={() => setShow(!show)} style={S.inlineLink}>{show ? 'Hide' : 'Show'}</button>
              </span>
            </label>
            {wrong && <span role="alert" style={{ fontSize: 13.5, color: 'var(--err-ink)' }}>That password didn’t open the file. Check caps lock, or ask CAMS for a new copy.</span>}
            <button type="submit" disabled={!pw} style={{ ...S.primary, opacity: pw ? 1 : 0.55 }}>Read statement</button>
          </form>
          <span style={S.lock}><Lock />Opened on this phone. The password is used once and never saved; the PDF never leaves your phone.</span>
        </section>}

        {step === 'reading' && <section aria-busy="true" style={S.card}>
          <b className="serif" style={{ fontSize: 22 }}>Reading your statement…</b>
          {['Opening the file', 'Finding your funds', 'Checking every fund’s units add up', 'Matching the statement’s total'].map((t, i) => {
            const done = i < progress, now = i === progress;
            return <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, color: done || now ? 'var(--ink)' : 'var(--muted)' }}>
              <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', background: done ? 'var(--btn)' : now ? 'var(--link)' : 'var(--hair2)', color: 'var(--on-btn)', fontSize: 12, fontWeight: 700 }}>{done ? '✓' : now ? '…' : ''}</span>{t}</div>;
          })}
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Usually under 10 seconds. Nothing is uploaded.</span>
        </section>}

        {step === 'done' && cas && <>
          <section style={S.card}>
            <span style={S.okTag}>{cas.checks.every((c) => c.ok) ? '✓ Checks out to the rupee' : '✓ Checked'}</span>
            <b className="serif" style={{ fontSize: 30, lineHeight: 1.1 }}>{R(value)}</b>
            <span style={S.sub}>{funds} fund{funds === 1 ? '' : 's'} · {flows} transactions · CAS of {day(cas.asOf)}</span>
            <button type="button" onClick={() => setChecksOpen(!checksOpen)} aria-expanded={checksOpen} style={{ ...S.inlineLink, justifySelf: 'start', padding: 0 }}>{checksOpen ? 'Hide the checks' : `See the ${checks.length} checks`}</button>
            {checksOpen && <div style={{ display: 'grid', gap: 6 }}>{checks.map((c) => <span key={c.t} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: 'var(--ink2)' }}><span style={{ color: c.ok ? 'var(--link)' : 'var(--err-ink)', fontWeight: 700 }}>{c.ok ? '✓' : '✕'}</span>{c.t}</span>)}</div>}
            <a href="/invest/xray" style={{ ...S.primary, display: 'grid', placeItems: 'center', textDecoration: 'none' }}>See your X-ray</a>
          </section>
          <section style={{ ...S.card, gap: 8, padding: '14px 16px' }}>
            <span style={S.lock}><Lock />Saved on this phone only, without your name, PAN or folio numbers. Ask Munim uses sample data until bank statements arrive.</span>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button type="button" onClick={choose} style={{ ...S.inlineLink, padding: 0 }}>Add a newer CAS</button>
              <button type="button" onClick={del} style={{ ...S.inlineLink, padding: 0, color: 'var(--err-ink)' }}>Delete from this phone</button>
            </div>
          </section>
          <section style={{ ...S.card, gap: 8, padding: '14px 16px' }}>
            <b style={{ fontSize: 15, fontWeight: 600 }}>Bank and card statements</b>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>HDFC and SBI savings, HDFC credit cards</span>
            <button type="button" onClick={choose} style={{ ...S.inlineLink, padding: 0, justifySelf: 'start' }}>Add a statement</button>
          </section>
          <StatementList list={stmts} onDelete={delStmt} />
        </>}

        {(step === 'summary' || step === 'partial' || step === 'mismatch' || step === 'unknown') && <section role="alert" style={S.card}>
          <span style={S.warnTag}>{step === 'summary' ? 'Summary statement' : step === 'partial' ? 'Starts mid-way' : step === 'mismatch' ? `${res?.cas?.skipped.length ?? 0} fund${(res?.cas?.skipped.length ?? 0) === 1 ? '' : 's'} didn’t add up` : 'Couldn’t find funds'}</span>
          <b className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>{step === 'summary' ? 'This CAS has no transactions' : step === 'partial' ? 'This CAS starts after your first investment' : step === 'mismatch' ? `${fund(res?.cas?.skipped[0] ?? '')} needs a look` : 'This doesn’t look like a detailed CAS'}</b>
          <span style={S.sub}>{step === 'summary'
            ? 'It’s the summary version, so Munim can’t work out your returns, tax or fees. Ask CAMS for the Detailed one; it’s free and takes a few minutes.'
            : step === 'partial'
              ? 'It covers only part of your history (for example this financial year), so Munim can’t work out what you paid, your returns or your tax. Ask for a Detailed CAS from your first investment to today.'
            : step === 'mismatch'
              ? `Its transactions don’t add up to the units the statement shows. Munim shows your other ${funds} fund${funds === 1 ? '' : 's'} and leaves ${(res?.cas?.skipped.length ?? 0) === 1 ? 'this one' : 'these'} out until it’s fixed, rather than guessing.`
              : 'Munim couldn’t find any funds in it. If it is a CAMS or KFintech detailed CAS, copy the diagnostics below and send them to us: they have no amounts, names or account numbers.'}</span>
          {step === 'mismatch' ? <button type="button" onClick={() => setStep('done')} style={S.primary}>Continue with {funds} fund{funds === 1 ? '' : 's'}</button>
            : <button type="button" onClick={() => { setStep('intro'); setHow(true); }} style={S.primary}>{step === 'summary' || step === 'partial' ? 'How to get the right CAS' : 'Try another file'}</button>}
          {(step === 'mismatch' || step === 'unknown') && (res || diag) && <button type="button" onClick={copyDiag} style={S.link}>{copied ? '✓ Copied (no amounts or names)' : 'Copy diagnostics'}</button>}
          {(step === 'summary' || step === 'partial') && <button type="button" onClick={choose} style={S.link}>Choose another file</button>}
        </section>}
      </div>
    </div>
  );
}

function StatementList({ list, onDelete }: { list: SavedStatement[]; onDelete: (key: string) => void }) {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a.account.label.localeCompare(b.account.label) || (a.period?.from ?? '').localeCompare(b.period?.from ?? ''));
  return (
    <section style={{ ...S.card, gap: 0, padding: '6px 16px' }}>
      {sorted.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--hair)' : 0 }}>
          <span style={{ color: 'var(--link)', fontWeight: 700 }} aria-hidden="true">✓</span>
          <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}><b style={{ fontSize: 14.5, fontWeight: 600 }}>{s.account.label}</b>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{s.period ? `${day(s.period.from)} – ${day(s.period.to)} · ` : ''}{s.txns.length} transactions</span></span>
          <button type="button" onClick={() => onDelete(s.key)} aria-label={`Delete ${s.account.label} statement`} style={{ ...S.inlineLink, color: 'var(--err-ink)' }}>Delete</button>
        </div>))}
      <a href="/spends" style={{ ...S.inlineLink, display: 'block', padding: '10px 0', textDecoration: 'none' }}>See your spends ›</a>
    </section>
  );
}

const Lock = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;

const CSS = `.serif{font-family:'Noto Serif','Noto Serif Devanagari',serif;font-weight:700}
button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--link);outline-offset:2px}`;

const S: Record<string, React.CSSProperties> = {
  page: { width: '100%', maxWidth: 480, minHeight: '100dvh', margin: '0 auto', background: 'var(--bg)', color: 'var(--ink)', fontSize: 16, lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' },
  scroll: { padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' },
  head: { display: 'flex', alignItems: 'center', gap: 4 },
  back: { width: 44, height: 44, marginLeft: -10, display: 'grid', placeItems: 'center', borderRadius: '50%', textDecoration: 'none', color: 'var(--ink)' },
  card: { background: 'var(--card)', borderRadius: 22, padding: '18px 16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, boxShadow: '0 0 0 1px var(--hair)' },
  kicker: { fontSize: 12.5, fontWeight: 600, color: 'var(--link)' },
  sub: { fontSize: 14.5, color: 'var(--ink2)' },
  primary: { minHeight: 50, borderRadius: 999, border: 0, background: 'var(--btn)', color: 'var(--on-btn)', fontSize: 15.5, fontWeight: 600, cursor: 'pointer' },
  link: { justifySelf: 'center', minHeight: 40, border: 0, background: 'transparent', fontSize: 14, fontWeight: 600, color: 'var(--link)', cursor: 'pointer' },
  inlineLink: { minHeight: 40, padding: '0 10px', border: 0, background: 'transparent', fontSize: 13.5, fontWeight: 600, color: 'var(--link)', cursor: 'pointer' },
  soon: { fontSize: 12, fontWeight: 600, color: 'var(--mari-ink)', background: 'var(--mari-tint)', borderRadius: 999, padding: '3px 10px' },
  fileChip: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--tint)', borderRadius: 14, padding: '6px 4px 6px 12px' },
  field: { display: 'flex', alignItems: 'center', minHeight: 52, padding: '0 6px 0 14px', borderRadius: 14, background: 'var(--card)' },
  input: { flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 15.5 },
  lock: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--muted)' },
  okTag: { justifySelf: 'start', fontSize: 12, fontWeight: 600, color: 'var(--link)', background: 'var(--tint2)', borderRadius: 999, padding: '3px 10px' },
  warnTag: { justifySelf: 'start', fontSize: 12, fontWeight: 600, color: 'var(--mari-ink)', background: 'var(--mari-tint)', borderRadius: 999, padding: '3px 10px' },
  err: { margin: 0, background: 'var(--err-tint)', color: 'var(--err-ink)', borderRadius: 14, padding: '10px 14px', fontSize: 14 },
};
