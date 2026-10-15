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

  return (
    <Screen title="You" back={{ href: '/', label: 'Home' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        {signedIn ? <span><b>Signed in</b><small style={{ display: 'block', color: 'var(--muted)' }}>{me?.phone ?? ''}</small></span> : <span><b>Not signed in</b><small style={{ display: 'block', color: 'var(--muted)' }}>You're exploring the sample family</small></span>}
        {signedIn ? <button className="btn small" onClick={async () => { await signOut(); router.push('/welcome'); }}>Sign out</button> : <Link className="btn primary small" style={{ textDecoration: 'none' }} href="/signin">Sign in</Link>}
      </div>

      <div className="eyebrow">Actions · {actions.length}</div>
      {!actions.length && <span className="sub">Nothing yet. Ask Munim to "set a reminder" or "draft the email", or tap an action on any screen.</span>}
      {actions.map((a) => (
        <div key={a.id} className="card" style={{ display: 'grid', gap: 8, padding: '10px 12px' }}>
          <span><span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--green-ink)' }}>{KIND[a.kind] ?? a.kind}</span><b style={{ display: 'block', fontSize: 13.5 }}>{a.title}</b>{(a.reminder?.date || a.plan?.date) && <small className="sub">{a.reminder?.date ?? a.plan?.date}</small>}</span>
          {a.email && <details><summary style={{ fontSize: 13, cursor: 'pointer' }}>Read the draft</summary><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font)', fontSize: 13, background: 'var(--line-2)', borderRadius: 8, padding: 10 }}>{`To: ${a.email.to}\nSubject: ${a.email.subject}\n\n${a.email.body}`}</pre></details>}
          <div className="btns">
            {a.email && <a className="btn small" style={{ textDecoration: 'none' }} href={`mailto:${encodeURIComponent(a.email.to)}?subject=${encodeURIComponent(a.email.subject)}&body=${encodeURIComponent(a.email.body)}`}>Open in mail</a>}
            {(a.reminder || a.plan) && <button className="btn small" onClick={() => void downloadVia(api, `/api/actions/${a.id}/ics`, `munim-${a.id}.ics`)}>Calendar (.ics)</button>}
            {a.gcal && <a className="btn small" style={{ textDecoration: 'none' }} href={a.gcal} target="_blank" rel="noreferrer">Google Calendar</a>}
            <button className="btn ghost small" onClick={() => void delAction(a.id)}>Remove</button>
          </div>
        </div>
      ))}

      {signedIn && <>
        <div className="eyebrow">Family</div>
        <div className="chipsel">{members.map((m) => <button key={m.id} aria-pressed={summary?.member?.id === m.id} onClick={() => setMemberId(m.id)}>{m.label}{m.consent_attested_at ? ' · consent ✓' : ''}</button>)}</div>
        <details className="card"><summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--green-ink)' }}>+ Add a family member</summary>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <div className="field"><label htmlFor="ml">Name or label</label><input id="ml" value={newM.label} maxLength={40} onChange={(e) => setNewM({ ...newM, label: e.target.value })} placeholder="Papa" /></div>
            <div className="field"><label htmlFor="mr">Relation</label><select id="mr" value={newM.relation} onChange={(e) => setNewM({ ...newM, relation: e.target.value })}>{['parent', 'spouse', 'child', 'sibling', 'other'].map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            <label className="check"><input type="checkbox" checked={newM.attest} onChange={(e) => setNewM({ ...newM, attest: e.target.checked })} /><span>I have their permission to add their statements.</span></label>
            <button className="btn primary" onClick={addMember} disabled={!newM.label.trim() || !newM.attest}>Add member</button>
          </div>
        </details>
      </>}

      <div className="eyebrow" id="files">Your files{summary?.member && signedIn ? ` · ${summary.member.label}` : ''}</div>
      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <Link className="tile" href="/invest" style={{ padding: '10px 12px' }}><span><b style={{ fontSize: 13.5 }}>Mutual fund CAS</b><small>{summary?.casChecks ? `${summary.casChecks.source} · ${summary.casChecks.passed}/${summary.casChecks.total} checks ✓` : 'Read on your device; add from Invest'}</small></span><span aria-hidden="true">→</span></Link>
        {(summary?.files ?? []).filter((f: { file: string }) => f.file && f.file !== '(all documents)').slice(0, 30).map((f: { file: string; ok: boolean; summary: string; failed: number }, i: number) => (
          <div key={i} className="row" style={{ fontSize: 12.5 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.ok ? '✓' : '✗'} {f.file}</span><span style={{ fontFamily: 'var(--font)', color: f.failed ? 'var(--red)' : 'var(--muted)' }}>{f.failed ? `${f.failed} check(s) failed` : 'checks pass'}</span></div>
        ))}
        <label className="btn primary small" style={{ cursor: 'pointer', justifySelf: 'start' }}>{busy === 'upload' ? 'Reading…' : 'Add statements, SMS, emails, policies'}
          <input type="file" multiple className="sr" accept=".csv,.txt,.eml,.json,.pdf,.md" onChange={(e) => void upload(e.target.files)} disabled={busy === 'upload'} /></label>
        {summary && !summary.isSample && <button className="btn small" style={{ justifySelf: 'start' }} onClick={toSample}>Remove these files, show the sample family</button>}
        <span className="sub" style={{ fontSize: 12, lineHeight: 1.45 }}>Beta: use test or masked statements. Before anything reaches the AI, names, PAN, phone numbers, emails and account numbers are removed.</span>
      </div>

      <div className="eyebrow">Privacy</div>
      {signedIn && me?.consents && (
        <div className="card" style={{ display: 'grid', padding: '4px 14px' }}>
          {[['analyse', 'Analyse my statements'], ['ai', 'AI explanations'], ['voice', 'Voice (speech-to-text)']].map(([p, label]) => (
            <label key={p} className="row" style={{ alignItems: 'center' }}>{label}<input type="checkbox" checked={consent(p)} onChange={(e) => void setConsent(p, e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--green)' }} /></label>
          ))}
        </div>
      )}
      {signedIn ? (confirmDel
        ? <div className="note red"><b>Delete everything?</b><span>Statements, holdings, actions, family members and consents are removed for good.</span><div className="btns"><button className="btn danger small" onClick={deleteAll} disabled={busy === 'delete'}>{busy === 'delete' ? 'Deleting…' : 'Yes, delete all my data'}</button><button className="btn small" onClick={() => setConfirmDel(false)}>Cancel</button></div></div>
        : <button className="btn danger block" onClick={() => setConfirmDel(true)}>Delete all my data</button>)
        : <span className="sub">{authConfigured ? 'Sign in to save your data and actions.' : 'Sign-in is not set up on this server yet.'}</span>}
      {msg && <div className="note green" role="status"><span>{msg}</span></div>}
      <div className="pills" style={{ justifyContent: 'center' }}>
        <span className={`pill ${summary?.status?.claude ? 'ok' : 'warn'}`}>{summary?.status?.claude ? 'Claude' : 'Offline rules'}</span>
        <span className={`pill ${summary?.status?.sarvam ? 'ok' : 'warn'}`}>{summary?.status?.sarvam ? 'Sarvam voice' : 'Browser voice'}</span>
        <span className={`pill ${summary?.status?.auth ? 'ok' : 'warn'}`}>{summary?.status?.auth ? 'Sign-in on' : 'Sign-in off'}</span>
      </div>
      <p className="sub" style={{ textAlign: 'center', fontSize: 11.5 }}>Invite-only beta · Guidance is not SEBI-registered investment advice</p>
    </Screen>
  );
}
