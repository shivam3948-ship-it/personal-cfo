// Bachatt-only review research (docs/27). Aggregates only; raw review text stays off the repo.
import Link from 'next/link';
import d from '@/data/research-bachatt.json';

export const metadata = { title: 'Munim · Bachatt review research' };
const fmt = (n: number) => n.toLocaleString('en-IN');

const OPPS: { title: string; body: string; href?: string; cta?: string }[] = [
  { title: 'A withdrawal tracker you can ask', body: 'Slow or “doesn’t happen” is about 72% of withdrawal complaints. Answer “where is my money” from the request record: date asked, date due, bank reference once paid, and a person in one step if it is late.', href: '/host?s=late', cta: 'Try “मेरे पैसे अभी तक नहीं आए”' },
  { title: 'Explain the instant-access limit before it feels like “blocked” money', body: 'Insta Fund can pay instantly only up to ₹50,000 or 90% of value a day; the rest follows. Say the split out loud, in rupees, before the user withdraws.', href: '/host?s=ontime', cta: 'Try “पूरा पैसा एक साथ क्यों नहीं?”' },
  { title: 'Name every charge the moment it happens', body: 'Users meet the ₹49 maintenance/Elite charge or a lower payout and call it fraud. A debit-by-debit explanation (“₹49 on 3 Sep: annual account fee”) turns a surprise into a known cost.', href: '/host?s=double', cta: 'Try “आज दो बार पैसे कटे?”' },
  { title: 'Support that already knows the account', body: 'Replies to low ratings ask people to WhatsApp a number and explain again. An in-app agent that sees the folio, the request and the status can resolve or hand over with the case written up.' },
  { title: '“Withdraw all” across folios', body: 'Each daily saving can sit in its own folio, so emptying savings means many requests. One spoken request should cover them all.' },
  { title: 'Read satisfaction from words, not stars', body: 'About 1 in 6 one-star reviews say only “good” or “nice”. For this audience the star tap is noisy; tag text or voice feedback instead.' },
];

export default function BachattResearch() {
  const max = Math.max(...d.themes_low.map((t) => t.pct));
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 16, display: 'grid', gap: 8 };
  const stars = d.android.stars as Record<string, number>;
  const low12 = ((stars['1'] + stars['2']) / d.android.n) * 100;
  const r = d.replies;
  const qMax = Math.max(...d.quarterly.map((q) => q.wd_per_1000));
  const Kpi = ({ v, t }: { v: string; t: string }) => <div style={card}><b style={{ fontFamily: 'var(--mono)', fontSize: 24 }}>{v}</b><span style={{ fontSize: 13.5 }}>{t}</span></div>;

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 60px', display: 'grid', gap: 18 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <Link href="/research" style={{ fontSize: 13, color: 'var(--green-ink)' }}>← All four apps</Link>
        <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.2 }}>Bachatt: what {fmt(d.android.n)} written reviews say</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14.5 }}>
          Every written Google Play review the store returned ({d.android.from} to {d.android.to}) plus {d.ios.n} App Store reviews, collected {d.collected}. Themes coded in Python on the {fmt(d.android.low_1to3_20plus)} reviews rated 1–3★ with at least 20 characters; withdrawal complaints hand-coded on a random 100.
        </p>
      </header>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
        <Kpi v={`${d.android.avg}★`} t={`average of written Android reviews (store shows ${d.listing.rating} from ${d.listing.ratings} ratings)`} />
        <Kpi v={`${low12.toFixed(1)}%`} t="of written Android reviews are 1–2★" />
        <Kpi v={`${d.ios.avg}★`} t={`average of ${d.ios.n} iOS reviews; ${d.ios_low.n} are 1–2★`} />
        <Kpi v={`${d.android.short_le15_pct}%`} t="of written reviews are 15 characters or fewer (“good”, “nice”)" />
      </section>

      <section style={card} aria-labelledby="themes">
        <h2 id="themes" style={{ margin: 0, fontSize: 17 }}>What low ratings are about</h2>
        <div style={{ display: 'grid', gap: 9 }}>
          {d.themes_low.map((t) => (
            <div key={t.id} style={{ display: 'grid', gap: 3 }}>
              <span style={{ fontSize: 13.5 }}>{t.label.replace(' (umbrella)', '')}</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px', alignItems: 'center', gap: 8 }}>
                <div style={{ height: 10, background: 'var(--line-2)', borderRadius: 4 }}><div style={{ width: `${(t.pct / max) * 100}%`, height: '100%', background: 'var(--green)', borderRadius: 4 }} /></div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, textAlign: 'right' }}>{t.pct}%</span>
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Share of {fmt(d.android.low_1to3_20plus)} low-rated reviews; a review can carry several themes; {d.uncoded_low_pct}% matched none. Withdrawal coding was right on 94 of 100 hand-checked reviews.</p>
      </section>

      <section style={card} aria-labelledby="wd">
        <h2 id="wd" style={{ margin: 0, fontSize: 17 }}>Inside withdrawal complaints (100 read by hand)</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--muted)' }}><th style={{ padding: '6px 4px' }}>What went wrong</th><th style={{ padding: '6px 4px' }}>Share</th><th style={{ padding: '6px 4px' }}>95% range</th></tr></thead>
            <tbody>{d.withdrawal_subtypes.items.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--line-2)' }}>
                <td style={{ padding: '6px 4px' }}>{s.label}</td>
                <td style={{ padding: '6px 4px', fontFamily: 'var(--mono)' }}>{s.pct}%</td>
                <td style={{ padding: '6px 4px', fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{s.ci[0]}–{s.ci[1]}%</td>
              </tr>))}</tbody>
          </table>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Of {d.withdrawal_subtypes.on_topic} on-topic reviews; a review can have more than one. {d.withdrawal_subtypes.flags.mentions_ad_or_instant_promise.k} cite the “instant withdrawal” promise, {d.withdrawal_subtypes.flags.mentions_emergency.k} needed the money for an emergency.</p>
      </section>

      <section style={card} aria-labelledby="replies">
        <h2 id="replies" style={{ margin: 0, fontSize: 17 }}>How replies land</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: 'grid', gap: 6 }}>
          <li>Bachatt replies to {r.reply_rate_pct}% of written reviews, typically within {r.median_reply_days} day.</li>
          <li>{r.redirects_to_phone_pct}% of replies to 1–2★ reviews send the user to a phone number; on withdrawal complaints, {r.could_not_understand_on_withdrawal_reviews_pct}% say the problem wasn’t understood and ask them to explain again. A public review carries no account details, so the reply can’t do better; an in-app agent can.</li>
          <li>{r.top5_templates_cover_pct}% of replies to low ratings use five templates. Templates seem matched to the text, not the stars: {d.star_noise.one_star_positive_only_text_n} one-star reviews ({d.star_noise.pct}%) say only “good” or “nice”, and some clearly negative ones still received a 5-star request.</li>
        </ul>
      </section>

      <section style={card} aria-labelledby="trend">
        <h2 id="trend" style={{ margin: 0, fontSize: 17 }}>Withdrawal complaints per 1,000 reviews, by quarter</h2>
        <div style={{ display: 'grid', gap: 6 }}>
          {d.quarterly.map((q) => (
            <div key={q.q} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 44px', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
              <span style={{ color: 'var(--muted)' }}>{q.q}</span>
              <div style={{ height: 10, background: 'var(--line-2)', borderRadius: 4 }}><div style={{ width: `${(q.wd_per_1000 / qMax) * 100}%`, height: '100%', background: 'var(--amber)', borderRadius: 4 }} /></div>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right' }}>{q.wd_per_1000}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Highest in Jan–Mar 2026; lower in the current quarter so far (partial). Review volume grew about tenfold over the period, so small early quarters are noisy.</p>
      </section>

      <section style={card} aria-labelledby="opps">
        <h2 id="opps" style={{ margin: 0, fontSize: 17 }}>Where a voice agent helps Bachatt</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {OPPS.map((o, i) => (
            <div key={o.title} style={{ display: 'grid', gap: 4, paddingTop: i ? 12 : 0, borderTop: i ? '1px solid var(--line-2)' : 0 }}>
              <b style={{ fontSize: 14.5 }}>{o.title}</b>
              <span style={{ fontSize: 14 }}>{o.body}</span>
              {o.href && <Link href={o.href} style={{ fontSize: 13, color: 'var(--green-ink)' }}>{o.cta} →</Link>}
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...card, background: 'var(--amber-soft)', borderColor: 'transparent' }} aria-labelledby="limits">
        <h2 id="limits" style={{ margin: 0, fontSize: 17 }}>Limits</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, display: 'grid', gap: 4 }}>
          <li>Reviews show what goes wrong, not how often it happens to the average saver; most savers never write one.</li>
          <li>Keyword coding by one person; precision checked on small samples (7/8 to 8/8 for most themes), recall not measured.</li>
          <li>Instant-access limit as summarised by an AMC from SEBI’s Mutual Fund Master Circular (27 Jun 2024, 14.9); verify against the circular. We have no Bachatt internal data; the demo host is fictional.</li>
        </ul>
      </section>
    </main>
  );
}
