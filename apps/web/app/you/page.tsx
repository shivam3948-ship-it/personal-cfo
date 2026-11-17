'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authConfigured, downloadVia, useApp } from '../client';
import { Screen } from '../ui';

interface ActionT { id: string; kind: string; title: string; createdAt: string; reminder?: { date: string; time?: string; notes?: string }; email?: { to: string; subject: string; body: string }; goal?: { monthlyNeeded: number; byDate: string }; plan?: { date: string }; gcal?: string | null }
const KIND: Record<string, string> = { reminder: 'Reminder', email: 'Draft · not sent', goal: 'Savings goal', prepayment_plan: 'Prepayment plan' };

export default function You() {
  const router = useRouter();
  const { api, summary, refresh, signedIn, signOut, setMemberId } = useApp();
  const [actions, setActions] = useState<ActionT[]>([]);
  const [me, setMe] = useState<{ phone?: string | null; consents?: { purpose: string; granted: boolean }[] } | null>(null);
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [confirmDel, setConfirmDel] = useState(false);
  const [newM, setNewM] = useState({ label: '', relation: 'parent', attest: false });

  const load = useCallback(async () => {
    const a = await api('/api/actions').then((r) => r.json()).catch(() => ({ actions: [] }));
    setActions(a.actions ?? []);
    if (signedIn) setMe(await api('/api/me').then((r) => r.json()).catch(() => null)); else setMe(null);
  }, [api, signedIn]);
  useEffect(() => { void load(); }, [load, summary?.member?.id]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setBusy('upload'); setMsg('');
    const fd = new FormData(); Array.from(files).forEach((f) => fd.append('files', f));
    const r = await api('/api/upload', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}));
    setBusy(''); setMsg(r.ok ? `Read ${files.length} file(s): ${j.counts?.transactions ?? 0} transactions, ${j.counts?.loans ?? 0} loans, ${j.counts?.policies ?? 0} policies.` : (j.error ?? 'Upload failed'));
    await refresh();
  };
  const toSample = async () => { await api('/api/upload', { method: 'DELETE' }); await refresh(); };
  const delAction = async (id: string) => { await api(`/api/actions?id=${id}`, { method: 'DELETE' }); await load(); };
  const setConsent = async (purpose: string, granted: boolean) => { await api('/api/me', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consents: { [purpose]: granted } }) }); await load(); };
  const addMember = async () => {
    setMsg('');
    const r = await api('/api/me', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ addMember: newM }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error ?? 'Could not add'); return; }
    setNewM({ label: '', relation: 'parent', attest: false }); setMemberId(j.member.id); await refresh();
  };
  const deleteAll = async () => {
    setBusy('delete'); const r = await api('/api/me?account=1', { method: 'DELETE' }); const j = await r.json().catch(() => ({}));
    setBusy(''); setConfirmDel(false);
    if (!r.ok) { setMsg(j.error ?? 'Could not delete'); return; }
    setMsg(j.accountDeleted ? 'All your data and your account are deleted.' : 'All your data is deleted. Your sign-in (phone number) remains until you ask us to remove it.');
    await signOut(); await refresh();
  };
  const consent = (p: string) => me?.consents?.find((c) => c.purpose === p)?.granted ?? false;
  const members = (summary?.members ?? []) as { id: string; label: string; relation: string; consent_attested_at: string | null }[];

  const files = ((summary?.files ?? []) as { file: string; ok: boolean; failed: number }[]).filter((f) => f.file && f.file !== '(all documents)');
  const okFiles = files.filter((f) => f.ok && !f.failed).length;
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, padding: '9px 0', borderBottom: '1px solid var(--line-2)' };

  return (
    <Screen title="You" back={{ href: '/', label: 'Home' }}>
      {/* Design S12: actions, family, files, privacy, then delete / sign out. */}
      <div className="eyebrow">Actions · {actions.length}</div>
      {!actions.length && <span className="sub">Nothing yet. Ask Munim to "set a reminder" or "draft the email", or tap an action on any screen.</span>}
      {actions.map((a) => (
        <div key={a.id} className="card" style={{ display: 'grid', gap: 6, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ minWidth: 0 }}><span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--green-ink)' }}>{KIND[a.kind] ?? a.kind}</span><b style={{ display: 'block', fontSize: 13.5 }}>{a.title}{(a.reminder?.date || a.plan?.date) ? ` · ${a.reminder?.date ?? a.plan?.date}` : ''}</b></span>
            {a.email ? <a className="btn small" style={{ textDecoration: 'none', flex: 'none' }} href={`mailto:${encodeURIComponent(a.email.to)}?subject=${encodeURIComponent(a.email.subject)}&body=${encodeURIComponent(a.email.body)}`}>Open in mail</a>
              : (a.reminder || a.plan) ? <button className="btn small" style={{ flex: 'none' }} onClick={() => void downloadVia(api, `/api/actions/${a.id}/ics`, `munim-${a.id}.ics`)}>Calendar</button> : null}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12.5 }}>
            {a.email && <details><summary style={{ cursor: 'pointer', color: 'var(--green-ink)' }}>Read the draft</summary><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font)', fontSize: 13, background: 'var(--line-2)', borderRadius: 8, padding: 10 }}>{`To: ${a.email.to}\nSubject: ${a.email.subject}\n\n${a.email.body}`}</pre></details>}
            {a.gcal && <a style={{ color: 'var(--green-ink)' }} href={a.gcal} target="_blank" rel="noreferrer">Google Calendar</a>}
            <button onClick={() => void delAction(a.id)} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: 12.5 }}>Remove</button>
          </div>
        </div>
      ))}

      <div className="eyebrow">Family</div>
      <div className="chipsel">
        {signedIn && members.length
          ? members.map((m) => <button key={m.id} aria-pressed={summary?.member?.id === m.id} onClick={() => setMemberId(m.id)}>{m.label}{m.consent_attested_at ? ' · consent ✓' : ''}</button>)
          : <button aria-pressed="true">Me</button>}
        {!signedIn && <Link href="/signin">+ Add member</Link>}
      </div>
      {signedIn && (
        <details className="card"><summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--green-ink)' }}>+ Add member</summary>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <div className="field"><label htmlFor="ml">Name or label</label><input id="ml" value={newM.label} maxLength={40} onChange={(e) => setNewM({ ...newM, label: e.target.value })} placeholder="Papa" /></div>
            <div className="field"><label htmlFor="mr">Relation</label><select id="mr" value={newM.relation} onChange={(e) => setNewM({ ...newM, relation: e.target.value })}>{['parent', 'spouse', 'child', 'sibling', 'other'].map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            <label className="check"><input type="checkbox" checked={newM.attest} onChange={(e) => setNewM({ ...newM, attest: e.target.checked })} /><span>I have their permission to add their statements.</span></label>
            <button className="btn primary" onClick={addMember} disabled={!newM.label.trim() || !newM.attest}>Add member</button>
          </div>
        </details>
      )}

      <div className="eyebrow" id="files">Your files{summary?.member && signedIn ? ` · ${summary.member.label}` : ''}</div>
      <div className="card" style={{ display: 'grid', padding: '4px 14px 12px' }}>
        <Link href="/invest" style={{ ...rowStyle, textDecoration: 'none', color: 'var(--ink)' }}><span>Mutual fund CAS · read on phone</span><span style={{ color: 'var(--green-ink)', whiteSpace: 'nowrap' }}>{summary?.casChecks ? `✓ ${summary.casChecks.passed}/${summary.casChecks.total} checks` : 'Add from Invest →'}</span></Link>
        <div style={rowStyle}><span>Bank, card, SMS, emails, loans, policies, credit report</span><span style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{files.length} files</span></div>
        <div style={{ ...rowStyle, borderBottom: 0 }}><span>Checks on every file</span><span style={{ whiteSpace: 'nowrap', color: okFiles === files.length ? 'var(--green-ink)' : 'var(--red)' }}>{okFiles}/{files.length} ✓</span></div>
        {!!files.length && <details style={{ fontSize: 12.5, marginBottom: 8 }}><summary style={{ cursor: 'pointer', color: 'var(--green-ink)' }}>See each file</summary>
          {files.slice(0, 40).map((f, i) => <div key={i} className="row" style={{ fontSize: 12.5 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.ok ? '✓' : '✗'} {f.file}</span><span style={{ fontFamily: 'var(--font)', color: f.failed ? 'var(--red)' : 'var(--muted)' }}>{f.failed ? `${f.failed} check(s) failed` : 'checks pass'}</span></div>)}
        </details>}
        <label className="btn small" style={{ cursor: 'pointer', justifySelf: 'start' }}>{busy === 'upload' ? 'Reading…' : 'Add files'}
          <input type="file" multiple className="sr" accept=".csv,.txt,.eml,.json,.pdf,.md" onChange={(e) => void upload(e.target.files)} disabled={busy === 'upload'} /></label>
        {summary && !summary.isSample && <button className="btn small" style={{ justifySelf: 'start', marginTop: 8 }} onClick={toSample}>Remove these files, show the sample family</button>}
        <span className="sub" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 8 }}>Beta: use test or masked statements. Names, PAN, phone numbers, emails and account numbers are removed before anything reaches the AI.</span>
      </div>

      <div className="eyebrow">Privacy</div>
      {signedIn && me?.consents ? (
        <div className="card" style={{ display: 'grid', padding: '4px 14px' }}>
          {[['ai', 'AI explanations'], ['voice', 'Voice (speech-to-text)'], ['analyse', 'Analyse my statements']].map(([p, label]) => (
            <label key={p} className="row" style={{ alignItems: 'center' }}>{label}<input type="checkbox" checked={consent(p)} onChange={(e) => void setConsent(p, e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--green)' }} /></label>
          ))}
        </div>
      ) : <span className="sub">{authConfigured ? 'Sign in to choose what Munim may use.' : 'Sign-in is not set up on this server yet; the sample family needs no consent.'}</span>}

      {signedIn ? (confirmDel
        ? <div className="note red"><b>Delete everything?</b><span>Statements, holdings, actions, family members and consents are removed for good.</span><div className="btns"><button className="btn danger small" onClick={deleteAll} disabled={busy === 'delete'}>{busy === 'delete' ? 'Deleting…' : 'Yes, delete all my data'}</button><button className="btn small" onClick={() => setConfirmDel(false)}>Cancel</button></div></div>
        : <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><button className="btn danger" style={{ flex: 1 }} onClick={() => setConfirmDel(true)}>Delete all my data</button><button className="btn" onClick={async () => { await signOut(); router.push('/welcome'); }}>Sign out</button></div>)
        : <Link className="btn primary block" style={{ textDecoration: 'none', textAlign: 'center' }} href="/signin">Sign in to use your own data</Link>}
      {msg && <div className="note green" role="status"><span>{msg}</span></div>}

      <Link className="tile" href="/host"><span><b>Munim inside another app</b><small>Demo: a fictional savings app with Munim as its voice layer</small></span><span aria-hidden="true">→</span></Link>
      <details style={{ fontSize: 12, color: 'var(--muted)' }}><summary style={{ cursor: 'pointer' }}>System status</summary>
        <div className="pills" style={{ marginTop: 6 }}>
          <span className={`pill ${summary?.status?.claude ? 'ok' : 'warn'}`}>{summary?.status?.claude ? 'Claude' : 'Offline rules'}</span>
          <span className={`pill ${summary?.status?.sarvam ? 'ok' : 'warn'}`}>{summary?.status?.sarvam ? 'Sarvam voice' : 'Browser voice'}</span>
          <span className={`pill ${summary?.status?.auth ? 'ok' : 'warn'}`}>{summary?.status?.auth ? 'Sign-in on' : 'Sign-in off'}</span>
        </div>
      </details>
      <p className="sub" style={{ textAlign: 'center', fontSize: 11.5 }}>Invite-only beta · Guidance is not SEBI-registered investment advice</p>
    </Screen>
  );
}
