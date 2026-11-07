'use client';
// Add your statements (mock: Upload.dc.html, confirmed 22 Oct). Everything here runs on the phone: the PDF is read in the
// browser, the password is used once and dropped, and only what reconciles is saved in this browser.
// One button for every kind of file (D-068): bank and card statements, and the mutual fund CAS. Munim works out
// which is which (lib/local/statements.ts readAny), so the user never has to sort them. Several files at once: each is read
// in turn, a locked one asks for its own password (or can be skipped), and every file gets its own result line.
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { saveCas, loadCas, deleteCas, PdfPasswordError, type LocalCas, type ReadResult } from '@/lib/local/cas';
import { readAny, loadStatements, deleteStatement, type SavedStatement } from '@/lib/local/statements';
import type { BankRead } from '@core/ingest/banks';
import { deleteAllSms } from '@/lib/local/sms';
import { getProfile } from '@/lib/local/profile';


// a file Munim can't read yet: say what it can read (D-068)
const CANT = { en: 'Can’t read this one yet. Munim reads HDFC, SBI, Canara and Federal Bank savings, HDFC and Axis cards, and the CAMS or KFintech CAS.', hi: 'इसे अभी नहीं पढ़ सकते। मुनीम HDFC, SBI, Canara और Federal Bank सेविंग्स, HDFC और Axis कार्ड, और CAMS या KFintech का CAS पढ़ता है।' };
type Step = 'intro' | 'password' | 'reading' | 'done' | 'summary' | 'partial' | 'mismatch' | 'unknown' | 'bank' | 'batch';
/** One file's result when several were chosen together. */
interface Item { name: string; kind: 'bank' | 'cas' | 'unknown' | 'skipped'; ok: boolean; title: string; detail: string }
const R = (p: number) => '₹' + Math.round(p / 100).toLocaleString('en-IN');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso: string) => (iso ? `${+iso.slice(8, 10)} ${MON[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : '');
// check names in Hindi, by check id (the English labels come from the readers in packages/core)
const CHECK_HI: Record<string, string> = { walk: 'हर लाइन पर बैलेंस मिलता है', counts: 'डेबिट और क्रेडिट की गिनती समरी से मिलती है', totals: 'डेबिट और क्रेडिट का टोटल समरी से मिलता है',
  closing: 'शुरुआती बैलेंस + क्रेडिट − डेबिट = आख़िरी बैलेंस', equation: 'पिछला बकाया − पेमेंट + ख़रीद + चार्ज = कुल बकाया', debits: 'ख़रीद की लाइनें छपे टोटल से मिलती हैं',
  credits: 'पेमेंट और क्रेडिट की लाइनें छपे टोटल से मिलती हैं', dates: 'हर लाइन की तारीख़ सही है', in_period: 'हर लाइन स्टेटमेंट की अवधि में है', order: 'लाइनें तारीख़ के क्रम में हैं', summary: 'स्टेटमेंट की समरी मिली' };
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
  const queue = useRef<File[]>([]); // several files chosen together, read one after another
  const [batch, setBatch] = useState<Item[] | null>(null);
  const done = useRef<Item[]>([]); // the batch's results so far (state for the screen, this for the count)
  // a batch is running: state, so the screen never flickers back to the single-file password step between files (review)
  const [batchOn, setBatchOn] = useState(false);
  const run = useRef(0); // each new pick (or leaving the screen) starts a new run; an older run stops where it is
  const batchHead = useRef<HTMLElement>(null);
  useEffect(() => () => { run.current++; }, []); // leaving the screen stops a batch that is still reading
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const L = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  // bank SMS paste was removed (29 Oct, owner's call; native SMS reading stays parked): clear any SMS rows an earlier version saved
  useEffect(() => { setLang(getProfile()?.lang === 'hi' ? 'hi' : 'en'); void deleteAllSms(); }, []);

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
      else { setErr(getProfile()?.lang === 'hi' ? 'यह फ़ाइल नहीं पढ़ी जा सकी। क्या यह CAS है, या HDFC, SBI, Canara, Federal या Axis का स्टेटमेंट?' : 'Couldn’t read this file. Is it a CAS, or a statement from HDFC, SBI, Canara, Federal Bank or Axis?'); setStep('intro'); track('cas_read', { result: 'unreadable' }); }
    } finally { clearInterval(tick); }
  }
  /** Read one file of a batch: save what reconciles (as the single-file path does) and describe the result in one line. */
  async function readOne(f: File, password?: string): Promise<Item> {
    const any = await readAny(f, password);
    if (any.type === 'bank') {
      const a = any.read, period = a.period ? `${day(a.period.from)} – ${day(a.period.to)} · ` : '';
      track('statement_read', { format: a.format, ok: any.ok, rows: a.txns.length });
      return { name: f.name, kind: 'bank', ok: any.ok, title: a.account.label, detail: any.ok ? `${period}${a.txns.length} ${L('transactions, balances to the paisa', 'लेन-देन, पैसे-पैसे तक मिलता है')}` : L('Didn’t add up, so not saved. Try the PDF straight from your bank’s site.', 'हिसाब नहीं मिला, इसलिए सेव नहीं किया। बैंक की वेबसाइट से सीधे PDF लेकर आज़माएँ।') };
    }
    if (any.type === 'cas') {
      const r = any.cas;
      // two CAS in one batch (or an older one than saved): keep the newest, never let an older one replace it (review)
      const have = await loadCas().catch(() => null);
      if (r.cas && have && have.asOf > r.cas.asOf) {
        track('cas_read', { result: 'older', funds: r.cas.holdings.length });
        return { name: f.name, kind: 'cas', ok: false, title: L('Mutual fund CAS (older)', 'म्यूचुअल फ़ंड CAS (पुराना)'), detail: lang === 'hi' ? `${day(have.asOf)} का नया CAS पहले से है, इसलिए यह पुराना वाला नहीं लिया।` : `A newer CAS (${day(have.asOf)}) is already here, so this older one wasn't used.` };
      }
      if (r.cas) { await saveCas(r.cas); setSaved(r.cas); }
      track('cas_read', { result: r.kind === 'summary' ? 'summary' : r.kind === 'partial' ? 'partial' : !r.cas ? 'unknown' : r.cas.skipped.length ? 'mismatch' : 'done', funds: r.cas?.holdings.length ?? 0 });
      const n = r.cas?.holdings.length ?? 0;
      return r.kind === 'summary' ? { name: f.name, kind: 'cas', ok: false, title: L('Mutual fund CAS (summary)', 'म्यूचुअल फ़ंड CAS (समरी)'), detail: L('No transactions in it. Ask CAMS for the Detailed CAS.', 'इसमें लेन-देन नहीं हैं। CAMS से Detailed CAS माँगें।') }
        : r.kind === 'partial' ? { name: f.name, kind: 'cas', ok: false, title: L('Mutual fund CAS (part of your history)', 'म्यूचुअल फ़ंड CAS (आधा इतिहास)'), detail: L('Ask for a Detailed CAS from your first investment to today.', 'पहले निवेश से आज तक का Detailed CAS माँगें।') }
        : r.cas ? { name: f.name, kind: 'cas', ok: true, title: L('Mutual fund CAS', 'म्यूचुअल फ़ंड CAS'), detail: (lang === 'hi' ? `${n} फ़ंड, हर आँकड़ा जाँचा गया` : `${n} fund${n === 1 ? '' : 's'}, every number checked`) + (r.cas.skipped.length ? L(` (${r.cas.skipped.length} left out: didn’t add up)`, ` (${r.cas.skipped.length} बाहर रखे: हिसाब नहीं मिला)`) : '') }
        : { name: f.name, kind: 'unknown', ok: false, title: f.name, detail: L('No funds found in it.', 'इसमें कोई फ़ंड नहीं मिला।') };
    }
    track('cas_read', { result: 'unrecognised' });
    return { name: f.name, kind: 'unknown', ok: false, title: f.name, detail: CANT[lang] };
  }
  /** Work through the chosen files one by one; a locked file stops here for its password (or a skip). */
  async function nextInBatch(id: number, password?: string) {
    if (id !== run.current) return; // a newer pick, or the screen was left
    const f = queue.current[0];
    if (!f) {
      setStep('reading'); // never sit on the password step while the batch is closing
      const all = done.current, n = (k: Item['kind']) => all.filter((x) => x.kind === k).length;
      const list = await loadStatements();
      if (id !== run.current) return;
      track('files_added', { files: all.length, bank: n('bank'), cas: n('cas'), unknown: n('unknown'), skipped: n('skipped') });
      setStmts(list); setBatch([...all]); setBatchOn(false); setStep('batch'); setTimeout(() => batchHead.current?.focus(), 0); return;
    }
    setFile(f); setStep('reading'); setProgress(1); setErr(null); setWrong(false);
    let item: Item;
    try { item = await readOne(f, password); }
    catch (e) {
      if (id !== run.current) return;
      if (e instanceof PdfPasswordError) { // wait for this file's password, with the same events as one file
        track('cas_read', { result: e.reason === 'wrong' && password ? 'wrong_password' : 'needs_password' });
        setWrong(e.reason === 'wrong' && !!password); setPw(''); setStep('password'); return;
      }
      track('cas_read', { result: 'unreadable' });
      item = { name: f.name, kind: 'unknown', ok: false, title: f.name, detail: L('Couldn’t read this file. If it is from a bank Munim reads, try the PDF straight from the bank’s site.', 'यह फ़ाइल नहीं पढ़ी जा सकी। अगर यह उन बैंकों में से है जिन्हें मुनीम पढ़ता है, तो बैंक की वेबसाइट से सीधे PDF लेकर आज़माएँ।') };
    }
    if (id !== run.current) return;
    setPw(''); // used once, never kept
    queue.current.shift(); done.current.push(item); setBatch([...done.current]);
    await nextInBatch(id);
  }
  const skipping = useRef(false);
  const skipFile = async () => {
    if (skipping.current) return; skipping.current = true; // a double tap skips one file, not two
    try { const f = queue.current.shift(); if (f) { done.current.push({ name: f.name, kind: 'skipped', ok: false, title: f.name, detail: L('Skipped: it needs a password.', 'छोड़ा: इसके लिए पासवर्ड चाहिए।') }); setBatch([...done.current]); } setPw(''); await nextInBatch(run.current); }
    finally { skipping.current = false; }
  };
  const inBatch = () => batchOn;
  const onPick = (list?: FileList | null) => {
    const files = [...(list ?? [])]; if (!files.length) return;
    setPw(''); setWrong(false); const id = ++run.current;
    if (files.length === 1) { queue.current = []; setBatch(null); setBatchOn(false); setFile(files[0]); read(files[0]); return; } // one file: the detailed result screens
    queue.current = files; done.current = []; setBatch([]); setBatchOn(true); void nextInBatch(id); // try each without a password first
  };
  const del = async () => { await deleteCas(); setSaved(null); setRes(null); setFile(null); setStep('intro'); track('cas_deleted'); };
  const copyDiag = async () => { const t = res?.diagnostics || diag; if (!t) return; try { await navigator.clipboard.writeText(t); setCopied(true); } catch { setCopied(false); } };
  const delStmt = async (key: string) => { await deleteStatement(key); setStmts(await loadStatements()); track('statement_deleted'); };

  const cas = saved;
  const funds = cas?.holdings.length ?? 0, flows = cas ? cas.holdings.reduce((a, h) => a + h.flows.length, 0) : 0;
  const value = cas ? cas.holdings.reduce((a, h) => a + h.value, 0) : 0;
  const checks = (cas?.checks ?? []).filter((c) => c.id.startsWith('units:') || c.id === 'total').map((c) => ({
    ok: c.ok, t: c.id === 'total' ? (lang === 'hi' ? 'फ़ंड की वैल्यू स्टेटमेंट के टोटल से मिलती है' : 'Fund values add up to the statement total') : `${fund(c.label.split(':')[0])}: ${c.ok ? c.detail.replace(/ to [\d.]+ units$/, '') : 'doesn’t add up'}` }));

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <input ref={picker} type="file" multiple accept="application/pdf,.pdf,.txt,.xml,text/plain,text/xml" hidden onChange={(e) => { onPick(e.target.files); e.target.value = ''; }} />
      <div style={S.scroll}>
        <header style={S.head}>
          <a href="/invest" aria-label={L('Back', 'वापस')} style={S.back}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></a>
          <h1 className="serif" style={{ margin: 0, fontSize: 26 }}>{step === 'done' ? L('Your statements', 'आपके स्टेटमेंट') : L('Add your statements', 'अपने स्टेटमेंट जोड़ें')}</h1>
        </header>

        {err && <p role="alert" style={S.err}>{err}</p>}

        {step === 'intro' && <>
          <section style={S.card}>
            <span style={S.kicker}>{L('Statements', 'स्टेटमेंट')}</span>
            <b className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>{L('Bank, card and mutual fund statements, all at once', 'बैंक, कार्ड और म्यूचुअल फ़ंड स्टेटमेंट, सब एक साथ')}</b>
            <span style={S.sub}>{L('Bank and card statements, and your mutual fund CAS. Choose one or several PDFs together: Munim works out which is which, and checks each against its own totals before using it.', 'बैंक और कार्ड के स्टेटमेंट, और आपका म्यूचुअल फ़ंड CAS। एक या कई PDF एक साथ चुनें: मुनीम ख़ुद पहचान लेता है कि कौन क्या है, और हर एक को इस्तेमाल करने से पहले उसके अपने टोटल से मिलाता है।')}</span>
            <button type="button" onClick={choose} style={S.primary}>{L('Choose files', 'फ़ाइलें चुनें')}</button>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{L('Reads today: HDFC, SBI, Canara and Federal Bank savings · HDFC and Axis credit cards · the detailed CAS from CAMS or KFintech. ICICI and other banks: coming next.', 'अभी पढ़ता है: HDFC, SBI, Canara और Federal Bank सेविंग्स · HDFC और Axis क्रेडिट कार्ड · CAMS या KFintech का डिटेल्ड CAS। ICICI और दूसरे बैंक: जल्द आ रहे हैं।')}</span>
            <button type="button" onClick={() => setHow(!how)} aria-expanded={how} style={S.link}>{how ? L('Hide', 'छिपाएँ') : L('How do I get my CAS?', 'CAS कैसे मिलेगा?')}</button>
            {how && <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, fontSize: 14, color: 'var(--ink2)' }}>
              <li>{L('On the CAMS website, open the consolidated account statement (CAS) request for CAMS and KFintech funds.', 'CAMS की वेबसाइट पर CAMS और KFintech फ़ंड का CAS (कंसॉलिडेटेड अकाउंट स्टेटमेंट) माँगने वाला पेज खोलें।')}</li>
              <li>{lang === 'hi' ? <><b>Detailed</b> (लेन-देन के साथ) चुनें, पहले निवेश से आज तक का समय चुनें, और एक पासवर्ड रखें।</> : <>Choose <b>Detailed</b> (with transactions), a period from your first investment to today, and set a password.</>}</li>
              <li>{L('The PDF arrives by email in a few minutes. Save it to your phone.', 'कुछ मिनट में PDF ईमेल पर आ जाएगी। उसे अपने फ़ोन में सेव करें।')}</li>
            </ol>}
          </section>
          <StatementList list={stmts} onDelete={delStmt} hi={lang === 'hi'} />
        </>}

        {step === 'bank' && bank && <>
          <section role={bank.ok ? undefined : 'alert'} style={S.card}>
            <span style={bank.ok ? S.okTag : S.warnTag}>{bank.ok ? L('✓ Balances to the paisa', '✓ पैसे-पैसे तक मिलता है') : L('Didn’t add up', 'हिसाब नहीं मिला')}</span>
            <b className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>{bank.read.account.label}</b>
            <span style={S.sub}>{bank.read.period ? `${day(bank.read.period.from)} – ${day(bank.read.period.to)} · ` : ''}{bank.read.txns.length} {L('transactions', 'लेन-देन')}{bank.read.stmt ? ` · ${L('total due', 'कुल बकाया')} ${R(bank.read.stmt.totalDue)}` : ''}</span>
            <div style={{ display: 'grid', gap: 6 }}>{bank.read.checks.map((c) => <span key={c.id} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: 'var(--ink2)' }}><span style={{ color: c.ok ? 'var(--link)' : 'var(--err-ink)', fontWeight: 700 }}>{c.ok ? '✓' : '✕'}</span>{lang === 'hi' ? CHECK_HI[c.id] ?? c.label : c.label}</span>)}</div>
            {bank.ok ? <a href="/spends" style={{ ...S.primary, display: 'grid', placeItems: 'center', textDecoration: 'none' }}>{L('See your spends', 'अपना खर्च देखें')}</a>
              : <span style={S.sub}>{L('Munim didn’t save it: a statement is only used when it reconciles. Try the PDF straight from your bank’s site.', 'मुनीम ने इसे सेव नहीं किया: स्टेटमेंट तभी इस्तेमाल होता है जब उसका हिसाब मिले। बैंक की वेबसाइट से सीधे PDF लेकर फिर कोशिश करें।')}</span>}
            <button type="button" onClick={choose} style={S.link}>{L('Add another statement', 'दूसरा स्टेटमेंट जोड़ें')}</button>
          </section>
          <StatementList list={stmts} onDelete={delStmt} hi={lang === 'hi'} />
        </>}

        {step === 'password' && file && <section style={S.card}>
          <div style={S.fileChip}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--link)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
            {!inBatch() && <button type="button" onClick={choose} style={S.inlineLink}>{L('Change', 'बदलें')}</button>}
          </div>
          {inBatch() && <span style={S.sub}>{lang === 'hi' ? `फ़ाइल ${done.current.length + 1} / ${done.current.length + queue.current.length} पासवर्ड से बंद है।` : `File ${done.current.length + 1} of ${done.current.length + queue.current.length} is locked with a password.`}</span>}
          <form onSubmit={(e) => { e.preventDefault(); if (!pw) return; if (inBatch()) void nextInBatch(run.current, pw); else read(file, pw); }} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}><span style={{ fontSize: 14, fontWeight: 600 }}>{L('PDF password', 'PDF पासवर्ड')}</span>
              <span style={{ ...S.field, boxShadow: `inset 0 0 0 ${wrong ? '2px var(--err-ink)' : '1.5px var(--hair2)'}` }}>
                <input type={show ? 'text' : 'password'} value={pw} onChange={(e) => { setPw(e.target.value); setWrong(false); }} autoComplete="off" autoCapitalize="off" spellCheck={false} autoFocus aria-invalid={wrong} placeholder={L('The file’s password', 'फ़ाइल का पासवर्ड')} style={S.input} />
                <button type="button" onClick={() => setShow(!show)} style={S.inlineLink}>{show ? L('Hide', 'छिपाएँ') : L('Show', 'दिखाएँ')}</button>
              </span>
            </label>
            {wrong && <span role="alert" style={{ fontSize: 13.5, color: 'var(--err-ink)' }}>{L('That password didn’t open the file. Check caps lock. A CAS uses the password you set; a bank statement usually uses one your bank chose (often part of your name and date of birth, as the bank’s email says).', 'इस पासवर्ड से फ़ाइल नहीं खुली। Caps Lock देखें। CAS में वही पासवर्ड लगता है जो आपने रखा था; बैंक स्टेटमेंट में आम तौर पर बैंक का तय किया हुआ (अक्सर नाम और जन्मतिथि का हिस्सा, जैसा बैंक के ईमेल में लिखा हो)।')}</span>}
            <button type="submit" disabled={!pw} style={{ ...S.primary, opacity: pw ? 1 : 0.55 }}>{L('Read statement', 'स्टेटमेंट पढ़ें')}</button>
          </form>
          {inBatch() && <button type="button" onClick={() => void skipFile()} style={S.link}>{L('Skip this file', 'यह फ़ाइल छोड़ें')}</button>}
          <span style={S.lock}><Lock />{L('Opened on this phone. The password is used once and never saved; the PDF never leaves your phone.', 'इसी फ़ोन पर खुलता है। पासवर्ड एक बार इस्तेमाल होता है और कभी सेव नहीं होता; PDF आपके फ़ोन से बाहर नहीं जाती।')}</span>
        </section>}

        {step === 'reading' && <section aria-busy="true" style={S.card}>
          <b className="serif" style={{ fontSize: 22 }}>{L('Reading your statement…', 'आपका स्टेटमेंट पढ़ा जा रहा है…')}</b>
          {inBatch() && <span aria-live="polite" style={S.sub}>{lang === 'hi' ? `फ़ाइल ${done.current.length + 1} / ${done.current.length + queue.current.length}` : `File ${done.current.length + 1} of ${done.current.length + queue.current.length}`}</span>}
          {(lang === 'hi' ? ['फ़ाइल खुल रही है', 'आपके फ़ंड ढूँढे जा रहे हैं', 'हर फ़ंड की यूनिट मिलाई जा रही हैं', 'स्टेटमेंट का टोटल मिलाया जा रहा है'] : ['Opening the file', 'Finding your funds', 'Checking every fund’s units add up', 'Matching the statement’s total']).map((t, i) => {
            const done = i < progress, now = i === progress;
            return <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, color: done || now ? 'var(--ink)' : 'var(--muted)' }}>
              <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', background: done ? 'var(--btn)' : now ? 'var(--link)' : 'var(--hair2)', color: 'var(--on-btn)', fontSize: 12, fontWeight: 700 }}>{done ? '✓' : now ? '…' : ''}</span>{t}</div>;
          })}
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{L('Usually under 10 seconds. Nothing is uploaded.', 'आम तौर पर 10 सेकंड से कम। कुछ भी अपलोड नहीं होता।')}</span>
        </section>}

        {step === 'done' && cas && <>
          <section style={S.card}>
            <span style={S.okTag}>{cas.checks.every((c) => c.ok) ? L('✓ Checks out to the rupee', '✓ रुपये-रुपये तक सही') : L('✓ Checked', '✓ जाँचा गया')}</span>
            <b className="serif" style={{ fontSize: 30, lineHeight: 1.1 }}>{R(value)}</b>
            <span style={S.sub}>{lang === 'hi' ? `${funds} फ़ंड · ${flows} लेन-देन · ${day(cas.asOf)} का CAS` : `${funds} fund${funds === 1 ? '' : 's'} · ${flows} transactions · CAS of ${day(cas.asOf)}`}</span>
            {!!cas.midway?.length && <span style={{ fontSize: 13.5, color: 'var(--ink2)', background: 'var(--mari-tint)', borderRadius: 10, padding: '8px 10px' }}>{L(
              `Not included: ${cas.midway.length} more fund${cas.midway.length === 1 ? '' : 's'} (${cas.midway.join(', ')}). This CAS starts after you first bought ${cas.midway.length === 1 ? 'it' : 'them'}, so the cost and returns can’t be worked out. To add ${cas.midway.length === 1 ? 'it' : 'them'}, download a detailed CAS from your first investment (CAMS or MF Central, all transactions).`,
              `शामिल नहीं: ${cas.midway.length} और फ़ंड (${cas.midway.join(', ')})। यह CAS आपकी पहली ख़रीद के बाद से शुरू होता है, इसलिए लागत और रिटर्न नहीं निकल सकते। ${cas.midway.length === 1 ? 'इसे' : 'इन्हें'} जोड़ने के लिए पहले निवेश से सारे लेन-देन वाला डिटेल्ड CAS (CAMS या MF Central) डाउनलोड करें।`)}</span>}
            <button type="button" onClick={() => setChecksOpen(!checksOpen)} aria-expanded={checksOpen} style={{ ...S.inlineLink, justifySelf: 'start', padding: 0 }}>{checksOpen ? L('Hide the checks', 'जाँच छिपाएँ') : L(`See the ${checks.length} checks`, `${checks.length} जाँच देखें`)}</button>
            {checksOpen && <div style={{ display: 'grid', gap: 6 }}>{checks.map((c) => <span key={c.t} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: 'var(--ink2)' }}><span style={{ color: c.ok ? 'var(--link)' : 'var(--err-ink)', fontWeight: 700 }}>{c.ok ? '✓' : '✕'}</span>{c.t}</span>)}</div>}
            <a href="/invest/xray" style={{ ...S.primary, display: 'grid', placeItems: 'center', textDecoration: 'none' }}>{L('See your X-ray', 'अपना X-ray देखें')}</a>
          </section>
          <section style={{ ...S.card, gap: 8, padding: '14px 16px' }}>
            <span style={S.lock}><Lock />{L('Saved on this phone only, without your name, PAN or folio numbers. Ask Munim uses sample data until bank statements arrive.', 'सिर्फ़ इसी फ़ोन पर सेव, आपके नाम, PAN या फ़ोलियो नंबर के बिना। बैंक स्टेटमेंट आने तक मुनीम से पूछें सैंपल डेटा इस्तेमाल करता है।')}</span>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button type="button" onClick={choose} style={{ ...S.inlineLink, padding: 0 }}>{L('Add a newer CAS', 'नया CAS जोड़ें')}</button>
              <button type="button" onClick={del} style={{ ...S.inlineLink, padding: 0, color: 'var(--err-ink)' }}>{L('Delete from this phone', 'इस फ़ोन से मिटाएँ')}</button>
            </div>
          </section>
          <section style={{ ...S.card, gap: 8, padding: '14px 16px' }}>
            <b style={{ fontSize: 15, fontWeight: 600 }}>{L('Bank and card statements', 'बैंक और कार्ड स्टेटमेंट')}</b>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{L('HDFC, SBI, Canara and Federal Bank savings; HDFC and Axis credit cards', 'HDFC, SBI, Canara और Federal Bank सेविंग्स; HDFC और Axis क्रेडिट कार्ड')}</span>
            <button type="button" onClick={choose} style={{ ...S.inlineLink, padding: 0, justifySelf: 'start' }}>{L('Add a statement', 'स्टेटमेंट जोड़ें')}</button>
          </section>
          <StatementList list={stmts} onDelete={delStmt} hi={lang === 'hi'} />
        </>}

        {step === 'batch' && batch && <>
          <section role="status" style={S.card}>
            <b ref={batchHead} tabIndex={-1} className="serif" style={{ fontSize: 22, lineHeight: 1.2, outline: 'none' }}>{lang === 'hi' ? `${batch.length} में से ${batch.filter((x) => x.ok).length} ${batch.filter((x) => x.ok).length === 1 ? 'फ़ाइल जुड़ गई' : 'फ़ाइलें जुड़ गईं'}` : `${batch.filter((x) => x.ok).length} of ${batch.length} file${batch.length === 1 ? '' : 's'} added`}</b>
            <div style={{ display: 'grid', gap: 0 }}>{batch.map((x, i) => (
              <div key={`${x.name}-${i}`} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--hair)' : 0 }}>
                <span aria-hidden="true" style={{ color: x.ok ? 'var(--link)' : 'var(--err-ink)', fontWeight: 700 }}>{x.ok ? '✓' : '✕'}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}><b style={{ fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.title}</b>
                  <span style={{ fontSize: 13, color: 'var(--ink2)' }}><span style={{ position: 'absolute', left: -9999 }}>{x.ok ? L('Added. ', 'जुड़ गया। ') : L('Not added. ', 'नहीं जुड़ा। ')}</span>{x.detail}</span></span>
              </div>))}</div>
            {batch.some((x) => x.kind === 'bank' && x.ok) && <a href="/spends" style={{ ...S.primary, display: 'grid', placeItems: 'center', textDecoration: 'none' }}>{L('See your spends', 'अपना खर्च देखें')}</a>}
            {batch.some((x) => x.kind === 'cas' && x.ok) && <a href="/invest/xray" style={{ ...(batch.some((x) => x.kind === 'bank' && x.ok) ? { ...S.link, display: 'grid', placeItems: 'center', textDecoration: 'none' } : { ...S.primary, display: 'grid', placeItems: 'center', textDecoration: 'none' }) }}>{L('See your X-ray', 'अपना X-ray देखें')}</a>}
            <button type="button" onClick={choose} style={S.link}>{L('Add more files', 'और फ़ाइलें जोड़ें')}</button>
          </section>
          <StatementList list={stmts} onDelete={delStmt} hi={lang === 'hi'} />
        </>}

        {(step === 'summary' || step === 'partial' || step === 'mismatch' || step === 'unknown') && <section role="alert" style={S.card}>
          <span style={S.warnTag}>{step === 'summary' ? L('Summary statement', 'समरी स्टेटमेंट') : step === 'partial' ? L('Starts mid-way', 'बीच से शुरू') : step === 'mismatch' ? L(`${res?.cas?.skipped.length ?? 0} fund${(res?.cas?.skipped.length ?? 0) === 1 ? '' : 's'} didn’t add up`, `${res?.cas?.skipped.length ?? 0} फ़ंड का हिसाब नहीं मिला`) : res ? L('Couldn’t find funds', 'फ़ंड नहीं मिले') : L('Can’t read this yet', 'अभी नहीं पढ़ सकते')}</span>
          <b className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>{step === 'summary' ? L('This CAS has no transactions', 'इस CAS में लेन-देन नहीं हैं') : step === 'partial' ? L('This CAS starts after your first investment', 'यह CAS आपके पहले निवेश के बाद से शुरू होता है') : step === 'mismatch' ? L(`${fund(res?.cas?.skipped[0] ?? '')} needs a look`, `${fund(res?.cas?.skipped[0] ?? '')} को देखना होगा`) : res ? L('This doesn’t look like a detailed CAS', 'यह डिटेल्ड CAS नहीं लगता') : L('Munim doesn’t recognise this file', 'मुनीम इस फ़ाइल को नहीं पहचानता')}</b>
          <span style={S.sub}>{step === 'summary'
            ? L('It’s the summary version, so Munim can’t work out your returns, tax or fees. Ask CAMS for the Detailed one; it’s free and takes a few minutes.', 'यह समरी वाला है, इसलिए मुनीम आपका रिटर्न, टैक्स या फ़ीस नहीं निकाल सकता। CAMS से Detailed वाला माँगें; यह मुफ़्त है और कुछ मिनट लगते हैं।')
            : step === 'partial'
              ? L('It covers only part of your history (for example this financial year), so Munim can’t work out what you paid, your returns or your tax. Ask for a Detailed CAS from your first investment to today.', 'इसमें आपके निवेश का सिर्फ़ कुछ हिस्सा है (जैसे इसी वित्त वर्ष का), इसलिए मुनीम यह नहीं निकाल सकता कि आपने कितना लगाया, रिटर्न या टैक्स कितना है। पहले निवेश से आज तक का Detailed CAS माँगें।')
            : step === 'mismatch'
              ? L(`Its transactions don’t add up to the units the statement shows. Munim shows your other ${funds} fund${funds === 1 ? '' : 's'} and leaves ${(res?.cas?.skipped.length ?? 0) === 1 ? 'this one' : 'these'} out until it’s fixed, rather than guessing.`, `इसके लेन-देन स्टेटमेंट में दिखी यूनिट से मेल नहीं खाते। मुनीम अंदाज़ा लगाने के बजाय आपके बाक़ी ${funds} फ़ंड दिखाता है और इसे ठीक होने तक बाहर रखता है।`)
              : !res ? `${CANT[lang]} ${L('If it is one of these, copy the diagnostics below and send them to us: they have no amounts, names or account numbers.', 'अगर यह इनमें से एक है, तो नीचे की जाँच-जानकारी कॉपी करके हमें भेजें: उसमें कोई रक़म, नाम या खाता नंबर नहीं है।')}`
              : L('Munim couldn’t find any funds in it. If it is a CAMS or KFintech detailed CAS, copy the diagnostics below and send them to us: they have no amounts, names or account numbers.', 'मुनीम को इसमें कोई फ़ंड नहीं मिला। अगर यह CAMS या KFintech का डिटेल्ड CAS है, तो नीचे की जाँच-जानकारी कॉपी करके हमें भेजें: उसमें कोई रक़म, नाम या खाता नंबर नहीं है।')}</span>
          {step === 'mismatch' ? <button type="button" onClick={() => setStep('done')} style={S.primary}>{L(`Continue with ${funds} fund${funds === 1 ? '' : 's'}`, `${funds} फ़ंड के साथ आगे बढ़ें`)}</button>
            : <button type="button" onClick={() => { setStep('intro'); setHow(true); }} style={S.primary}>{step === 'summary' || step === 'partial' ? L('How to get the right CAS', 'सही CAS कैसे मिलेगा') : L('Try another file', 'दूसरी फ़ाइल आज़माएँ')}</button>}
          {(step === 'mismatch' || step === 'unknown') && (res || diag) && <button type="button" onClick={copyDiag} style={S.link}>{copied ? L('✓ Copied (no amounts or names)', '✓ कॉपी हो गया (कोई रक़म या नाम नहीं)') : L('Copy diagnostics', 'जाँच-जानकारी कॉपी करें')}</button>}
          {(step === 'summary' || step === 'partial') && <button type="button" onClick={choose} style={S.link}>{L('Choose another file', 'दूसरी फ़ाइल चुनें')}</button>}
        </section>}
      </div>
    </div>
  );
}

function StatementList({ list, onDelete, hi }: { list: SavedStatement[]; onDelete: (key: string) => void; hi: boolean }) {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a.account.label.localeCompare(b.account.label) || (a.period?.from ?? '').localeCompare(b.period?.from ?? ''));
  return (
    <section style={{ ...S.card, gap: 0, padding: '6px 16px' }}>
      {sorted.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--hair)' : 0 }}>
          <span style={{ color: 'var(--link)', fontWeight: 700 }} aria-hidden="true">✓</span>
          <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}><b style={{ fontSize: 14.5, fontWeight: 600 }}>{s.account.label}</b>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{s.period ? `${day(s.period.from)} – ${day(s.period.to)} · ` : ''}{s.txns.length} {hi ? 'लेन-देन' : 'transactions'}</span></span>
          <button type="button" onClick={() => onDelete(s.key)} aria-label={hi ? `${s.account.label} का स्टेटमेंट मिटाएँ` : `Delete ${s.account.label} statement`} style={{ ...S.inlineLink, color: 'var(--err-ink)' }}>{hi ? 'मिटाएँ' : 'Delete'}</button>
        </div>))}
      <a href="/spends" style={{ ...S.inlineLink, display: 'block', padding: '10px 0', textDecoration: 'none' }}>{hi ? 'अपना खर्च देखें ›' : 'See your spends ›'}</a>
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
