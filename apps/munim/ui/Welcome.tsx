'use client';
// Onboarding (D-049): language → how to start → first name → add a statement. No sign-up: the answers stay on this phone
// (lib/local/profile.ts). "Look around first" goes straight to the sample family; "Use my statements" never shows it
// unless asked. Opening it again (the "You" button on Today) edits the same answers.
import { useEffect, useState, type CSSProperties } from 'react';
import { getProfile, saveProfile, cleanName, type Lang, type Profile } from '@/lib/local/profile';
import { track } from '@/lib/analytics';
import { noticeShown, privacySignal, setUsage, usageOff } from '@/lib/telemetry';

type Step = 'lang' | 'start' | 'name' | 'add';
const T = {
  en: {
    startQ: 'How would you like to start?', mine: 'Use my statements', mineD: 'Bank, card and mutual fund statements. Munim reads them on this phone; nothing is uploaded.',
    sample: 'Look around first', sampleD: 'See Munim with a made-up family’s money. Add yours any time.', privacy: 'No sign-up. Your statements stay on this phone and you can delete them any time.', usage: 'Munim sends counts of which screens and answers get used, never your numbers. Questions asked about the sample family are kept for 90 days to improve answers.', usageOffBtn: 'Turn off', usageOnBtn: 'Turn on', usageOff: 'Usage counts are off.', usageSignal: 'Your browser asks sites not to track, so Munim sends nothing.',
    nameQ: 'What should Munim call you?', namePh: 'First name', nameNote: 'Only your first name. It stays on this phone.', preview: 'Munim will greet you like this', hello: (n: string) => `Welcome, ${n}`, helloNone: 'Welcome',
    previewSub: 'Here’s your money today.', addQ: 'Add a statement', addSub: 'Start with one. More months make the comparisons better.',
    bank: 'Bank and card statements', bankD: 'HDFC, SBI and Canara savings · HDFC and Axis credit cards', bankBtn: 'Choose statement PDF',
    cas: 'Mutual funds (CAS)', casD: 'CAMS or MF Central, detailed, full history', casBtn: 'Choose CAS PDF', checked: '✓ Each file is checked against its own totals before Munim uses it.',
    later: 'I’ll do this later', cont: 'Continue', skip: 'Skip', back: 'Back',
  },
  hi: {
    startQ: 'कैसे शुरू करना चाहेंगे?', mine: 'मेरे स्टेटमेंट से', mineD: 'बैंक, कार्ड और म्यूचुअल फ़ंड के स्टेटमेंट। मुनीम इन्हें इसी फ़ोन पर पढ़ता है; कुछ भी अपलोड नहीं होता।',
    sample: 'पहले देख लूँ', sampleD: 'एक काल्पनिक परिवार के पैसों के साथ मुनीम देखें। अपना कभी भी जोड़ें।', privacy: 'कोई साइन-अप नहीं। आपके स्टेटमेंट इसी फ़ोन पर रहते हैं, कभी भी मिटा सकते हैं।', usage: 'मुनीम यह गिनती भेजता है कि कौन सी स्क्रीन और जवाब इस्तेमाल हुए, आपके आँकड़े कभी नहीं। सैंपल परिवार के बारे में पूछे गए सवाल 90 दिन तक रखे जाते हैं, ताकि जवाब बेहतर हों।', usageOffBtn: 'बंद करें', usageOnBtn: 'चालू करें', usageOff: 'इस्तेमाल की गिनती बंद है।', usageSignal: 'आपका ब्राउज़र साइटों से ट्रैक न करने को कहता है, इसलिए मुनीम कुछ नहीं भेजता।',
    nameQ: 'मुनीम आपको किस नाम से बुलाए?', namePh: 'पहला नाम', nameNote: 'सिर्फ़ पहला नाम। यह इसी फ़ोन पर रहता है।', preview: 'मुनीम ऐसे बात करेगा', hello: (n: string) => `नमस्ते, ${n}`, helloNone: 'नमस्ते',
    previewSub: 'यह रहा आज आपका पैसा।', addQ: 'एक स्टेटमेंट जोड़ें', addSub: 'एक से शुरू करें। ज़्यादा महीने, बेहतर तुलना।',
    bank: 'बैंक और कार्ड स्टेटमेंट', bankD: 'HDFC, SBI और केनरा बचत खाता · HDFC और एक्सिस क्रेडिट कार्ड', bankBtn: 'स्टेटमेंट PDF चुनें',
    cas: 'म्यूचुअल फ़ंड (CAS)', casD: 'CAMS या MF Central, डिटेल्ड, पूरी हिस्ट्री', casBtn: 'CAS PDF चुनें', checked: '✓ हर फ़ाइल उसके अपने टोटल से मिलाई जाती है, तभी मुनीम उसे इस्तेमाल करता है।',
    later: 'बाद में करूँगा', cont: 'आगे बढ़ें', skip: 'छोड़ें', back: 'पीछे',
  },
};

export default function Welcome() {
  const [step, setStep] = useState<Step>('lang');
  const [usage, setUsageOn] = useState(true); const [signal, setSignal] = useState(false); // usage counts (D-057)
  useEffect(() => { setUsageOn(!usageOff()); setSignal(privacySignal()); }, []);
  useEffect(() => { if (step === 'start') noticeShown(); }, [step]); // events only leave the phone once this line has been on screen
  const [lang, setLang] = useState<Lang>('en');
  const [start, setStart] = useState<Profile['start']>('mine');
  const [name, setName] = useState('');
  const [had, setHad] = useState<Profile | null>(null);
  useEffect(() => {
    const p = getProfile(); setHad(p);
    if (p) { setLang(p.lang); setStart(p.start); setName(p.name ?? ''); }
    track('onboarding_opened', { again: !!p });
  }, []);
  const t = T[lang];
  const save = (patch: Partial<Profile>) => {
    const p: Profile = { lang, start, name: cleanName(name), doneAt: had?.doneAt ?? new Date().toISOString(), ...patch };
    saveProfile(p); return p;
  };
  const next = () => {
    if (step === 'lang') { setStep('start'); track('onboarding_lang', { lang }); return; }
    if (step === 'start') {
      track('onboarding_start', { start });
      if (start === 'sample') { save({ start: 'sample' }); location.assign('/'); return; }
      setStep('name'); return;
    }
    if (step === 'name') { save({}); track('onboarding_name', { given: !!cleanName(name) }); setStep('add'); }
  };
  const dots = { lang: 1, start: 2, name: 3, add: 4 }[step];
  const shown = cleanName(name);

  return (
    <main lang={lang === 'hi' ? 'hi' : 'en'} style={S.page}>
      <div style={S.col}>
        {step !== 'lang' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" aria-label={t.back} onClick={() => setStep(step === 'add' ? 'name' : step === 'name' ? 'start' : 'lang')} style={S.back}>‹</button>
            <div aria-hidden="true" style={{ display: 'flex', gap: 6 }}>{[1, 2, 3, 4].map((i) => <i key={i} style={{ width: 22, height: 4, borderRadius: 2, background: i <= dots ? 'var(--btn)' : 'var(--hair2)' }} />)}</div>
          </div>
        )}

        {step === 'lang' && (<>
          <div style={{ display: 'grid', gap: 6, marginTop: 'auto' }}>
            <span className="serif" style={{ fontSize: 34, color: 'var(--link)' }}>Munim</span>
            <h1 className="serif" style={{ margin: 0, fontSize: 26, lineHeight: 1.25 }}>अपनी भाषा चुनें<br />Choose your language</h1>
          </div>
          <div role="radiogroup" aria-label="Language" style={{ display: 'grid', gap: 12 }}>
            <Pick on={lang === 'hi'} onPick={() => setLang('hi')} icon="अ" title="हिंदी" sub="सरल हिंदी में बात और जवाब" lang="hi" />
            <Pick on={lang === 'en'} onPick={() => setLang('en')} icon="A" title="English" sub="Plain English, Hindi words where they help" lang="en" />
          </div>
          <span style={{ ...S.muted, textAlign: 'center' }}>बाद में भी बदल सकते हैं · You can change this later</span>
        </>)}

        {step === 'start' && (<>
          <h1 className="serif" style={S.h1}>{t.startQ}</h1>
          <div role="radiogroup" aria-label={t.startQ} style={{ display: 'grid', gap: 12 }}>
            <Pick on={start === 'mine'} onPick={() => setStart('mine')} icon="₹" title={t.mine} sub={t.mineD} />
            <Pick on={start === 'sample'} onPick={() => setStart('sample')} icon="◎" title={t.sample} sub={t.sampleD} />
          </div>
          <div style={{ ...S.card, background: 'var(--tint)', boxShadow: 'none', display: 'flex', gap: 10, padding: '14px 16px' }}>
            <span aria-hidden="true">🔒</span>
            <span style={{ display: 'grid', gap: 6, fontSize: 13.5, color: 'var(--ink2)' }}>{t.privacy}
              <span>{signal ? t.usageSignal : usage ? t.usage : t.usageOff}{' '}
                {!signal && <button type="button" onClick={() => { const on = !usage; setUsageOn(on); void setUsage(on); }} aria-pressed={!usage} style={{ minHeight: 44, padding: '0 4px', border: 0, background: 'transparent', color: 'var(--link)', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>{usage ? t.usageOffBtn : t.usageOnBtn}</button>}
              </span>
            </span>
          </div>
        </>)}

        {step === 'name' && (<>
          <h1 className="serif" style={S.h1}>{t.nameQ}</h1>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder={t.namePh} aria-label={t.namePh} autoComplete="given-name" autoCapitalize="words" enterKeyHint="next"
            onKeyDown={(e) => { if (e.key === 'Enter') next(); }} style={S.input} />
          <span style={S.muted}>{t.nameNote}</span>
          <div style={{ ...S.card, display: 'grid', gap: 6, marginTop: 8 }}>
            <span style={S.muted}>{t.preview}</span>
            <b style={{ fontSize: 17 }}>{shown ? t.hello(shown) : t.helloNone}</b>
            <span style={{ fontSize: 15, color: 'var(--ink2)' }}>{t.previewSub}</span>
          </div>
        </>)}

        {step === 'add' && (<>
          <h1 className="serif" style={S.h1}>{t.addQ}</h1>
          <span style={{ fontSize: 15, color: 'var(--ink2)' }}>{t.addSub}</span>
          <div style={{ ...S.card, display: 'grid', gap: 10 }}>
            <b style={{ fontSize: 16 }}>{t.bank}</b><span style={S.muted}>{t.bankD}</span>
            <a href="/invest/add" onClick={() => track('onboarding_add', { kind: 'statement' })} style={S.btn}>{t.bankBtn}</a>
          </div>
          <div style={{ ...S.card, display: 'grid', gap: 10 }}>
            <b style={{ fontSize: 16 }}>{t.cas}</b><span style={S.muted}>{t.casD}</span>
            <a href="/invest/add" onClick={() => track('onboarding_add', { kind: 'cas' })} style={{ ...S.btn, background: 'var(--card)', color: 'var(--link)', boxShadow: 'inset 0 0 0 1.5px var(--btn)' }}>{t.casBtn}</a>
          </div>
          <span style={S.muted}>{t.checked}</span>
        </>)}

        <div style={{ marginTop: step === 'lang' ? 0 : 'auto', display: 'grid', gap: 4 }}>
          {step !== 'add' && <button type="button" onClick={next} style={{ ...S.btn, border: 0, cursor: 'pointer' }}>{step === 'lang' ? (lang === 'hi' ? 'आगे बढ़ें' : 'Continue') : t.cont}</button>}
          {step === 'name' && <button type="button" onClick={() => { setName(''); save({ name: null }); setStep('add'); }} style={S.ghost}>{t.skip}</button>}
          {step === 'add' && <a href="/" onClick={() => track('onboarding_later')} style={{ ...S.ghost, textDecoration: 'none', display: 'grid', placeItems: 'center' }}>{t.later}</a>}
        </div>
      </div>
    </main>
  );
}

function Pick({ on, onPick, icon, title, sub, lang }: { on: boolean; onPick: () => void; icon: string; title: string; sub: string; lang?: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} lang={lang}
      style={{ display: 'flex', gap: 14, alignItems: 'center', minHeight: 84, padding: '16px 18px', borderRadius: 20, border: 0, textAlign: 'left', cursor: 'pointer', width: '100%',
        background: on ? 'var(--tint)' : 'var(--card)', boxShadow: on ? '0 0 0 2px var(--btn)' : '0 0 0 1px var(--hair2)', color: 'var(--ink)' }}>
      <span aria-hidden="true" style={{ flex: 'none', width: 44, height: 44, borderRadius: 14, background: on ? 'var(--card)' : 'var(--tint)', color: 'var(--link)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18 }}>{icon}</span>
      <span style={{ display: 'grid', gap: 3, flex: 1 }}><b style={{ fontSize: 17 }}>{title}</b><span style={{ fontSize: 14, color: 'var(--ink2)' }}>{sub}</span></span>
      {on && <span aria-hidden="true" style={{ color: 'var(--link)', fontWeight: 700 }}>✓</span>}
    </button>
  );
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Devanagari', system-ui, sans-serif", lineHeight: 1.4 },
  col: { maxWidth: 480, minHeight: '100dvh', margin: '0 auto', padding: '24px 20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 },
  h1: { margin: '8px 0 0', fontSize: 27, lineHeight: 1.2 },
  card: { background: 'var(--card)', borderRadius: 22, boxShadow: '0 0 0 1px var(--hair)', padding: 18 },
  muted: { fontSize: 13.5, color: 'var(--muted)' },
  btn: { minHeight: 52, borderRadius: 999, background: 'var(--btn)', color: 'var(--on-btn)', fontSize: 16, fontWeight: 600, display: 'grid', placeItems: 'center', textDecoration: 'none', fontFamily: 'inherit' },
  ghost: { minHeight: 44, border: 0, background: 'transparent', color: 'var(--link)', fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' },
  back: { width: 40, height: 40, marginLeft: -10, border: 0, background: 'transparent', fontSize: 28, color: 'var(--ink)', cursor: 'pointer' },
  input: { font: "500 20px 'IBM Plex Sans', 'IBM Plex Sans Devanagari', system-ui, sans-serif", border: 0, borderBottom: '2px solid var(--btn)', background: 'transparent', padding: '10px 2px', color: 'var(--ink)', outline: 'none' },
};
