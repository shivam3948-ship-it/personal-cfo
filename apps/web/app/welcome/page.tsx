'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '../client';

export default function Welcome() {
  const router = useRouter();
  const [c, setC] = useState({ analyse: true, ai: true, voice: false });
  const sample = () => { store.set('munim-welcomed', '1'); router.push('/'); };
  const own = () => { store.set('munim-welcomed', '1'); store.set('munim-consents', JSON.stringify(c)); router.push('/signin'); };
  return (
    <div className="app">
      <div className="welcome-hero">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><b style={{ fontSize: 30, letterSpacing: '-0.02em' }}>Munim</b><span style={{ fontSize: 20, color: 'var(--dark-muted)' }}>मुनीम</span></div>
        <h1>Your money in one place. Explained in Hindi or English.</h1>
        <p>Mutual funds, bank, cards, loans, insurance and credit score. Ask out loud; every number is traced to your documents.</p>
        <button className="btn light block" onClick={sample}>Try the sample family</button>
        <a className="btn outline-dark block" href="#consent">Use my own data</a>
      </div>
      <main className="screen nonav" id="consent">
        <div className="eyebrow">Before you add your data</div>
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <label className="check"><input type="checkbox" checked={c.analyse} onChange={(e) => setC({ ...c, analyse: e.target.checked })} /><span><b>Analyse my statements</b> to show my money picture. Required.</span></label>
          <label className="check"><input type="checkbox" checked={c.ai} onChange={(e) => setC({ ...c, ai: e.target.checked })} /><span><b>Use AI to explain</b> it. Names, PAN and account numbers are removed first.</span></label>
          <label className="check"><input type="checkbox" checked={c.voice} onChange={(e) => setC({ ...c, voice: e.target.checked })} /><span><b>Voice</b>: send my recordings for speech-to-text. Optional.</span></label>
        </div>
        <div className="note green" style={{ flexDirection: 'row', gap: 10 }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flex: 'none', marginTop: 1 }}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <span>Your CAS PDF and its password never leave this phone. Delete everything any time from the You screen.</span>
        </div>
        <button className="btn primary block" disabled={!c.analyse} onClick={own}>Continue</button>
        {!c.analyse && <span className="err">Analysing your statements is needed to use your own data. You can still try the sample family.</span>}
        <p className="sub" style={{ textAlign: 'center', fontSize: 12, lineHeight: 1.5 }}>Invite-only beta. Guidance shown here is not SEBI-registered investment advice. AI is used to explain numbers that are computed in code.</p>
      </main>
    </div>
  );
}
