'use client';
import { Empty, Screen, ShowMath, WithSummary, fmtDate } from '../ui';

export default function Credit() {
  return (
    <Screen title="Credit" back={{ href: '/', label: 'Home' }}>
      <WithSummary>{(s) => {
        const c = s.credit_health ?? {};
        if (c.score === undefined || c.error) return <Empty title="No credit report yet" body="Add a credit report (CIBIL, Experian, Equifax or CRIF) to see your score, what moved it and what helps." cta={{ href: '/you#files', label: 'Add files' }} />;
        const pos = Math.max(0, Math.min(100, ((c.score - 300) / 600) * 100));
        return (<>
          <div className="card" style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span style={{ display: 'grid', gap: 2 }}><span className="sub">Score on {fmtDate(c.as_of)}</span><span className="mono" style={{ fontSize: 40, lineHeight: 1 }}>{c.score}</span></span>
              {typeof c.change === 'number' && <span className={`pillstat ${c.change < 0 ? 'todo' : 'done'}`} style={{ fontSize: 13 }}>{c.change > 0 ? '+' : ''}{c.change} since last report</span>}
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <div className="bar"><i style={{ width: `${pos}%`, background: 'var(--green)' }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--muted)' }}><span>300</span><span>900</span></div>
            </div>
          </div>
          <div className="eyebrow">{typeof c.change === 'number' && c.change < 0 ? 'Why it dropped' : 'What the report shows'}</div>
          <div className="card" style={{ display: 'grid', padding: '4px 14px' }}>
            {c.utilisation_on_report && <div className="row"><span>Card use on the report</span><span>{c.utilisation_previous ? `${c.utilisation_previous} → ` : ''}{c.utilisation_on_report}</span></div>}
            <div className="row"><span>New enquiries, last 90 days</span><span>{c.enquiries_last_90_days?.length ?? 0}</span></div>
            <div className="row"><span>Late payments</span><span style={{ whiteSpace: 'normal', textAlign: 'right' }}>{c.late_payments?.length ? c.late_payments.join('; ') : 'None'}</span></div>
          </div>
          {c.utilisation_latest_statement && <span className="sub" style={{ lineHeight: 1.45 }}>Your latest card statement ({fmtDate(c.latest_statement_date)}) shows {c.utilisation_latest_statement} use.</span>}
          <div className="eyebrow">What helps</div>
          {(c.steps ?? []).map((t: string) => <div key={t} className="note green"><span>{t}</span></div>)}
          <ShowMath data={c} />
        </>);
      }}</WithSummary>
    </Screen>
  );
}
