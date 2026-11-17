'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useApp } from '../client';
import { GuidanceBadge, Screen, ShowMath, WithSummary } from '../ui';

const TITLE: Record<string, string> = { cash_flow: 'Monthly cash flow', card_debt: 'Card debt', high_interest_loans: 'Costly loans', emergency_fund: 'Emergency fund', health_cover: 'Health cover', life_cover: 'Life cover', savings_policies: 'Savings policies', invest_surplus: 'Invest the surplus' };
const LINK: Record<string, string> = { cash_flow: '/money', card_debt: '/money', high_interest_loans: '/loans', emergency_fund: '/money', health_cover: '/protect', life_cover: '/protect', savings_policies: '/protect', invest_surplus: '/invest' };
const STATUS: Record<string, string> = { done: 'Done', todo: 'To do', review: 'Review', no_data: 'No data' };
interface Step { order: number; step: string; status: string; finding: string; recommendation: string; basis: string }

export default function Plan() {
  const { api } = useApp();
  const [saved, setSaved] = useState('');
  return (
    <Screen title="Your plan" right={<GuidanceBadge />}>
      <WithSummary>{(s) => {
        const p = s.advice_plan ?? {}; const steps = (p.steps ?? []) as Step[]; const first = p.first_thing_to_fix;
        const rp = s.portfolio_overview?.regular_plans;
        const commit = async () => {
          const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
          const r = await api('/api/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tool: 'create_reminder', input: { title: `Do: ${TITLE[first.step] ?? first.step}`, date, notes: first.recommendation } }) });
          const j = await r.json().catch(() => ({})); setSaved(j.action ? 'Saved. Munim will remind you in 3 days (You → Actions).' : 'Could not save');
        };
        return (<>
          <span className="sub" style={{ lineHeight: 1.45 }}>Foundation first: fix what costs you most before investing more.</span>
          {first && (
            <div className="hero">
              <span className="k">First thing to fix</span>
              {(() => { const i = first.recommendation.indexOf('. '); const head = i > 0 ? first.recommendation.slice(0, i + 1) : first.recommendation; const rest = i > 0 ? first.recommendation.slice(i + 2) : '';
                return <><b style={{ fontSize: 17, lineHeight: 1.35 }}>{head}</b>{rest && <span style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--dark-muted)' }}>{rest}</span>}</>; })()}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {saved ? <span style={{ fontSize: 13, color: 'var(--dark-muted)' }}>{saved}</span> : <button className="btn light small" onClick={commit}>I'll do this</button>}
                <Link className="btn outline-dark small" style={{ textDecoration: 'none' }} href={LINK[first.step] ?? '/'}>Show the math</Link>
              </div>
            </div>
          )}
          {steps.map((st, i) => (
            <details key={st.step} className="step" style={{ display: 'block' }}>
              <summary style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', listStyle: 'none' }}>
                <span className="n">{i + 1}</span>
                <span className="t"><b style={{ fontSize: 13.5 }}>{TITLE[st.step] ?? st.step}</b><small style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.finding}</small></span>
                <span className={`pillstat ${st.status === 'done' ? 'done' : st.status === 'todo' ? 'todo' : 'review'}`}>{STATUS[st.status] ?? st.status}</span>
              </summary>
              <div style={{ display: 'grid', gap: 6, padding: '10px 2px 4px', fontSize: 13, lineHeight: 1.5 }}>
                <span>{st.finding}</span>
                <span><b>Guidance:</b> {st.recommendation}</span>
                <span className="sub" style={{ fontSize: 12 }}>Basis: {st.basis}</span>
                <Link href={LINK[st.step] ?? '/'} style={{ fontSize: 13, fontWeight: 600 }}>Open →</Link>
              </div>
            </details>
          ))}
          {rp?.funds > 0 && <div className="note amber"><b>Inside your investments</b><span>{rp.funds} regular-plan {rp.funds === 1 ? 'fund' : 'funds'} cost about {rp.estimated_extra_cost_per_year} a year more than direct plans (estimate).</span><Link href="/invest">See funds →</Link></div>}
          <span className="sub" style={{ fontSize: 11.5, lineHeight: 1.45 }}>{p.disclaimer}</span>
          <ShowMath data={p} />
        </>);
      }}</WithSummary>
    </Screen>
  );
}
