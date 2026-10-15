'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authConfigured, emailLoginEnabled, store, supabase, useApp } from '../client';

export default function SignIn() {
  const router = useRouter();
  const { api, refresh } = useApp();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState(''); const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(''); const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [info, setInfo] = useState('');
  const digits = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const e164 = `+91${digits}`;

  const send = async () => {
    setErr(''); setInfo(''); setBusy(true);
    try {
      const c = supabase(); if (!c) throw new Error('Sign-in is not set up on this server yet.');
      if (mode === 'phone') {
        if (!/^[6-9]\d{9}$/.test(digits)) throw new Error('Enter a 10-digit Indian mobile number.');
        const { error } = await c.auth.signInWithOtp({ phone: e164 });
        if (error) throw error;
        setSent(true); setInfo('Code sent. It can take up to a minute.');
      } else {
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email.');
        const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setSent(true); setInfo('Check your email for the sign-in link or code.');
      }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const verify = async () => {
    setErr(''); setBusy(true);
    try {
      const c = supabase(); if (!c) throw new Error('Sign-in is not set up.');
      const { error } = mode === 'phone'
        ? await c.auth.verifyOtp({ phone: e164, token: otp.trim(), type: 'sms' })
        : await c.auth.verifyOtp({ email, token: otp.trim(), type: 'email' });
      if (error) throw error;
      const consents = store.get('munim-consents');
      await new Promise((r) => setTimeout(r, 50)); // let the session reach the API helper
      if (consents) await api('/api/me', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consents: JSON.parse(consents) }) });
      store.set('munim-welcomed', '1');
      await refresh();
      router.push('/you#files');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="app"><main className="screen nonav" style={{ gap: 20 }}>
      <Link className="back" href="/welcome">← Back</Link>
      <div style={{ display: 'grid', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '-0.02em' }}>Sign in</h1>
        <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink-2)' }}>{mode === 'phone' ? "We'll text a 6-digit code. Your number is only used to sign you in." : "We'll email you a sign-in code."}</span>
      </div>
      {!authConfigured && <div className="note amber"><b>Sign-in isn't set up on this server yet.</b><span>Add the Supabase URL and anon key to the hosting settings. Meanwhile you can explore with the sample family.</span><Link href="/">Explore the sample family →</Link></div>}

      {mode === 'phone' ? (
        <div className="field">
          <label htmlFor="phone">Mobile number</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 14px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 16 }}>+91</span>
            <input id="phone" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)' }} disabled={sent} />
          </div>
        </div>
      ) : (
        <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sent} /></div>
      )}

      {!sent ? <button className="btn primary block" onClick={send} disabled={busy || !authConfigured}>{busy ? 'Sending…' : 'Send code'}</button> : (
        <>
          <div className="field">
            <label htmlFor="otp">Enter the code</label>
            <input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} style={{ fontFamily: 'var(--mono)', fontSize: 24, letterSpacing: '.3em' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><button className="btn ghost small" onClick={send} disabled={busy}>Resend</button><button className="btn ghost small" onClick={() => { setSent(false); setOtp(''); }}>Change {mode === 'phone' ? 'number' : 'email'}</button></div>
          </div>
          <button className="btn primary block" onClick={verify} disabled={busy || otp.length < 6}>{busy ? 'Checking…' : 'Verify and continue'}</button>
        </>
      )}
      {info && <span className="sub">{info}</span>}
      {err && <span className="err" role="alert">{err}</span>}

      <div style={{ marginTop: 'auto', display: 'grid', gap: 12 }}>
        <div className="card" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}><b style={{ color: 'var(--ink)' }}>What happens next</b><br />Add your CAS and statements on the next screen, or look around with the sample family first.</div>
        {emailLoginEnabled && <div className="sub" style={{ textAlign: 'center' }}>{mode === 'phone' ? <>Trouble with SMS? <button className="btn ghost small" onClick={() => { setMode('email'); setSent(false); setErr(''); }}>Use email instead</button></> : <button className="btn ghost small" onClick={() => { setMode('phone'); setSent(false); setErr(''); }}>Use phone instead</button>}</div>}
      </div>
    </main></div>
  );
}
