// Research behind the embedded voice agent: what 15,532 Play Store reviews say, and what we built from it.
// Aggregates only (data/research-play-reviews.json); raw review text stays off the repo. Method: docs/26.
import Link from 'next/link';
import data from '@/data/research-play-reviews.json';

export const metadata = { title: 'Munim · Research' };

const fmt = (n: number) => n.toLocaleString('en-IN');
const BUILT: { theme: string; behaviour: string; scenario: string; ask: string }[] = [
  { theme: 'withdrawal_problem', behaviour: 'Answers “where is my money” from the withdrawal record: date requested, date due, status. Late → apologises with the delay in days and offers a person.', scenario: 'late', ask: 'मेरे पैसे अभी तक नहीं आए' },
  { theme: 'withdrawal_problem', behaviour: 'Paid but “not in my bank” → gives the bank reference to look for in the bank SMS or passbook.', scenario: 'paid', ask: 'withdrawal shows success but money not received' },
  { theme: 'support_unreachable', behaviour: 'A person in one step. “इंसान से बात कराओ” creates a case with a written summary; two misses in a row also offer a person. Never a bot loop.', scenario: 'ontime', ask: 'इंसान से बात कराओ' },
  { theme: 'got_less_than_put_in', behaviour: 'Shows the arithmetic: put in + market move − charges = value now. No reassurance without numbers.', scenario: 'ontime', ask: 'कम क्यों दिख रहा है?' },
  { theme: 'unexpected_debit', behaviour: 'Checks the debit list for the week; a double debit becomes a refund request after “haan”.', scenario: 'double', ask: 'आज दो बार पैसे कटे?' },
  { theme: 'trust_fraud', behaviour: '“Is this a fraud?” gets where the money sits and in whose name, from the host’s own terms.', scenario: 'ontime', ask: 'ये ऐप फ्रॉड तो नहीं?' },
];

export default function Research() {
  const d = data;
  const top = d.themes.filter((t) => t.savings_pct >= 2 || t.investing_pct >= 5);
  const max = Math.max(...top.map((t) => Math.max(t.savings_pct, t.investing_pct)));
  const label = (id: string) => d.themes.find((t) => t.id === id)?.label ?? id;
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 16, display: 'grid', gap: 8 };
  const total = Object.values(d.apps).reduce((a, b) => a + b, 0);
  const c = d.cost_per_voice_turn;

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 60px', display: 'grid', gap: 18 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <span style={{ display: 'flex', gap: 14, fontSize: 13 }}><Link href="/host" style={{ color: 'var(--green-ink)' }}>← Back to the embedded demo</Link><Link href="/research/bachatt" style={{ color: 'var(--green-ink)' }}>Bachatt deep dive →</Link></span>
        <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.2 }}>What {fmt(total)} Play Store reviews say about saving apps</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14.5 }}>
          Bachatt, Jar (micro-savings) and Groww, ET Money (investing). Collected {d.collected}: the newest 3,000 and 1,000 “most relevant” reviews per app, coded into themes with a keyword codebook in Python.
          Bars show the share of 1–3★ reviews with text that mention each theme ({fmt(d.low_rated_with_text.savings_apps)} savings-app reviews, {fmt(d.low_rated_with_text.investing_apps)} investing-app reviews).
        </p>
      </header>

      <section style={card} aria-labelledby="themes">
        <h2 id="themes" style={{ margin: 0, fontSize: 17 }}>Savings-app complaints are about getting money back</h2>
        <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: 'var(--ink-2)' }}>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--green)', marginRight: 6 }} />Savings apps (Bachatt, Jar)</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--muted)', marginRight: 6 }} />Investing apps (Groww, ET Money)</span>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {top.map((t) => (
            <div key={t.id} style={{ display: 'grid', gap: 3 }}>
              <span style={{ fontSize: 13.5 }}>{t.label}</span>
              {([['savings_pct', 'var(--green)'], ['investing_pct', 'var(--muted)']] as const).map(([k, col]) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 52px', alignItems: 'center', gap: 8 }}>
                  <div style={{ height: 10, background: 'var(--line-2)', borderRadius: 4 }}><div style={{ width: `${(t[k] / max) * 100}%`, height: '100%', background: col, borderRadius: 4 }} /></div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, textAlign: 'right' }}>{t[k]}%</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>A review can carry several themes; {d.uncoded_low_pct}% matched no theme. Precision was checked by reading 10 coded reviews per theme: withdrawal and support 9/10, others 7–8/10.</p>
      </section>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div style={card}>
          <b style={{ fontFamily: 'var(--mono)', fontSize: 26 }}>{d.themes.find((t) => t.id === 'withdrawal_problem')?.savings_pct}%</b>
          <span style={{ fontSize: 14 }}>of low-rated savings-app reviews are about a withdrawal that was slow, failed or stuck, versus {d.themes.find((t) => t.id === 'withdrawal_problem')?.investing_pct}% for investing apps.</span>
        </div>
        <div style={card}>
          <b style={{ fontFamily: 'var(--mono)', fontSize: 26 }}>{d.ai_support.n}</b>
          <span style={{ fontSize: 14 }}>1–2★ reviews attack AI or chatbot support ({d.ai_support.with_withdrawal} written while a withdrawal was stuck): generic replies, no route to a person. Small count, strong signal: a bot that blocks a human at a money problem costs trust.</span>
        </div>
        <div style={card}>
          <b style={{ fontFamily: 'var(--mono)', fontSize: 26 }}>₹{c.voice_inr_per_turn_median.toFixed(2)}</b>
          <span style={{ fontSize: 14 }}>estimated speech cost per voice turn (Sarvam list prices; {Math.round((c.tts_inr_per_turn_median / c.voice_inr_per_turn_median) * 100)}% is text-to-speech). Voice belongs at high-stakes moments, with short answers.</span>
        </div>
      </section>

      <section style={card} aria-labelledby="built">
        <h2 id="built" style={{ margin: 0, fontSize: 17 }}>What we built from it</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {BUILT.map((b, i) => (
            <div key={i} style={{ display: 'grid', gap: 4, paddingTop: i ? 10 : 0, borderTop: i ? '1px solid var(--line-2)' : 0 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label(b.theme)}</span>
              <span style={{ fontSize: 14 }}>{b.behaviour}</span>
              <Link href={`/host?s=${b.scenario}`} style={{ fontSize: 13, color: 'var(--green-ink)' }}>Try it: “{b.ask}” →</Link>
            </div>
          ))}
        </div>
      </section>

      <section style={card} aria-labelledby="cost">
        <h2 id="cost" style={{ margin: 0, fontSize: 17 }}>Does voice pay for a ₹50-a-day saver?</h2>
        <p style={{ margin: 0, fontSize: 14 }}>Measured: {c.replies_measured} demo replies, median {c.reply_chars_median} characters spoken. Assumed: {c.assumptions.utterance_seconds}-second questions. Claude runs only when rules can’t answer (≈${c.claude_usd_per_fallback_turn} a turn at the assumed price).</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--muted)' }}><th style={{ padding: '6px 4px' }}>Voice sessions / month</th><th style={{ padding: '6px 4px' }}>Cost / user / month</th><th style={{ padding: '6px 4px' }}>Balance to break even at 0.25% trail*</th></tr></thead>
            <tbody>{d.unit_economics_illustrative.rows.map((r) => (
              <tr key={r.sessions_per_month} style={{ borderTop: '1px solid var(--line-2)' }}>
                <td style={{ padding: '6px 4px' }}>{r.sessions_per_month} × {r.turns_per_session} turns</td>
                <td style={{ padding: '6px 4px', fontFamily: 'var(--mono)' }}>₹{r.voice_cost_inr_per_user_month.toFixed(2)}</td>
                <td style={{ padding: '6px 4px', fontFamily: 'var(--mono)' }}>₹{fmt(r.breakeven_balance_inr_at_annual_trail['0.25%'])}</td>
              </tr>))}</tbody>
          </table>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>*Trail rate is an illustrative input, not a sourced figure. The case for voice is retention and fewer support contacts at withdrawal and debit moments; both still need measuring.</p>
      </section>

      <section style={card} aria-labelledby="context">
        <h2 id="context" style={{ margin: 0, fontSize: 17 }}>Primary-source context</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: 'grid', gap: 6 }}>
          <li>Beyond the top 30 cities (B30) hold 19.1% of mutual fund assets; retail investors hold only 29.9% of their assets in direct plans, so most go through distributors (<a href="https://www.amfiindia.com/uploads/AMFI_Investor_Trends_July2026_f90f3da83e.pdf">AMFI Investor Trends, July 2026</a>).</li>
          <li>SEBI’s Dec 2024 adviser amendments keep responsibility with the adviser however much AI is used, and require disclosing AI use to clients (summary by <a href="https://www.azbpartners.com/bank/overhaul-of-the-regulatory-framework-for-investment-advisers-and-research-analysts/">AZB &amp; Partners</a>; verify against the SEBI text).</li>
          <li>Speech prices: speech-to-text ₹30/hour, Bulbul v3 text-to-speech ₹30 per 10K characters (<a href="https://docs.sarvam.ai/api-reference-docs/pricing">Sarvam pricing</a>, read 16 Oct 2026).</li>
        </ul>
      </section>

      <section style={{ ...card, background: 'var(--amber-soft)', borderColor: 'transparent' }} aria-labelledby="limits">
        <h2 id="limits" style={{ margin: 0, fontSize: 17 }}>Limits</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, display: 'grid', gap: 4 }}>
          <li>Reviews over-represent angry users and English writers ({d.language.roman_hindi_pct}% of low-rated savings-app reviews are in romanised Hindi, {d.language.devanagari_pct}% in Devanagari). They show what goes wrong, not how often.</li>
          <li>The sample is the newest and most relevant reviews, not a random sample. Bachatt’s store rating is {d.store_rating_bachatt}.</li>
          <li>One coder, a keyword codebook, a 10-review precision check per theme. Interviews with first-time savers are the next step.</li>
        </ul>
      </section>
    </main>
  );
}
