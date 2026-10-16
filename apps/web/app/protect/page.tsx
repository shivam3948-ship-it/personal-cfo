'use client';
import Link from 'next/link';
import { Empty, Screen, ShowMath, WithSummary, fmtDate } from '../ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = Record<string, any>;
const KIND: Record<string, string> = { term: 'Term', health: 'Health', endowment: 'Savings policy', ulip: 'ULIP', other: 'Policy' };
const ORDER: Record<string, number> = { term: 0, health: 1, endowment: 2, ulip: 3, other: 4 };
/** "₹1,00,00,000" → "₹1 crore", "₹10,00,000" → "₹10 lakh" (display only; the tool's figure is unchanged). */
const words = (s?: string | null) => {
  if (!s) return s; const n = Number(String(s).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n < 1e5) return s;
  const [v, u] = n >= 1e7 ? [n / 1e7, 'crore'] : [n / 1e5, 'lakh'];
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${u}`;
};

export default function Protect() {
  return (
    <Screen title="Insurance" back={{ href: '/', label: 'Home' }}>
      <WithSummary>{(s) => {
        const ins = s.insurance_overview ?? {}; const pols = ((ins.policies ?? []) as R[]).slice().sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9));
        if (!pols.length) return <Empty title="No policies found" body="Add your policy documents to see cover, premiums, due dates and what savings policies really return." cta={{ href: '/you#files', label: 'Add files' }} />;
        const health = pols.find((p) => p.kind === 'health');
        return (<>
          <div className="topbar" style={{ minHeight: 0 }}><span className="sub">{ins.premium_share_of_income} of income</span><b className="mono" style={{ fontSize: 18 }}>{ins.total_premium_per_year}/yr</b></div>
          <div className="grid2">
            <div className="mini"><span>Life cover (term)</span><b className="mono">{words(ins.term_cover) ?? 'None'}</b>{ins.term_cover_times_annual_income && <span>{ins.term_cover_times_annual_income}× yearly income</span>}</div>
            <div className="mini"><span>Health cover</span><b className="mono">{words(health?.cover) ?? 'None'}</b>{health?.next_due && <span>renews {fmtDate(health.next_due)}</span>}</div>
          </div>
          {pols.map((p) => (
            <div key={p.name} className="card" style={{ display: 'grid', gap: 6, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span><span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--green-ink)' }}>{KIND[p.kind] ?? p.kind}</span><b style={{ display: 'block', fontSize: 14.5 }}>{p.name}</b><small style={{ color: 'var(--muted)' }}>{p.insurer}</small></span>
                <span className="mono" style={{ whiteSpace: 'nowrap', fontSize: 13.5 }}>{p.premium_per_year}/yr</span>
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Cover {words(p.cover)}.{p.next_due ? ` Premium due ${fmtDate(p.next_due)}${p.days_to_due !== undefined ? `, in ${p.days_to_due} days` : ''}.` : ''}</span>
              {p.projected_return_from_insurer_illustration && <div className="note amber" style={{ marginTop: 4 }}><b>Projected return: {p.projected_return_from_insurer_illustration.join('; ')}</b><span>{p.note}</span></div>}
            </div>
          ))}
          <div className="note green"><span>We show what each policy costs and returns, from its own documents. We don't tell you to buy, surrender or switch a policy.</span></div>
          <Link className="tile" href="/talk"><span><b>Going to hospital?</b><small>Ask Munim: cover, waiting periods, documents, TPA</small></span><span aria-hidden="true">→</span></Link>
          <ShowMath data={ins} />
        </>);
      }}</WithSummary>
    </Screen>
  );
}
