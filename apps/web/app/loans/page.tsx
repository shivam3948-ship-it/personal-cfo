'use client';
import { useEffect, useState } from 'react';
import { useApp } from '../client';
import { Empty, Screen, ShowMath, WithSummary, fmtDate, isNeg } from '../ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = Record<string, any>;
const post = (api: ReturnType<typeof useApp>['api'], path: string, body: unknown) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

function Negotiate({ loan }: { loan: string }) {
  const { api } = useApp();
  const [n, setN] = useState<R | null>(null); const [msg, setMsg] = useState('');
  useEffect(() => { void post(api, '/api/tool', { tool: 'loan_negotiation', input: { loan } }).then((j) => setN(j.result)); }, [api, loan]);
  if (!n || n.error || !n.offer) return null;
  const draft = async () => { const j = await post(api, '/api/actions', { tool: 'draft_email', input: { kind: 'rate_reduction', loan } }); setMsg(j.action ? (j.action.duplicate ? 'Already in You → Actions' : 'Draft saved in You → Actions') : (j.result?.error ?? 'Could not draft')); };
  return (
    <div className="note amber">
      <b>{n.offer} for your {n.loan}</b>
      <span>Switching saves {n.interest_difference} in interest but costs {n.switch_costs?.processing_fee_incl_gst} fee + {n.switch_costs?.foreclosure_charge_incl_gst} foreclosure: net <b className={isNeg(n.switch_net_saving) ? 'neg' : 'pos'}>{n.switch_net_saving}</b>.{n.offer_expires_before_switch_allowed ? ` The offer ends ${fmtDate(n.offer_valid_till)}, before you're allowed to switch (${fmtDate(n.switch_allowed_from)}).` : ''} If {n.loan.split('(')[1]?.replace(')', '') ?? 'your lender'} matches the rate, you save {n.if_current_lender_matches_rate?.saving} with no fees.</span>
      {msg ? <span className="sub">{msg}</span> : <button className="btn primary small" style={{ justifySelf: 'start' }} onClick={draft}>Draft rate-match request</button>}
    </div>
  );
}

const num = (s?: string) => (s ? Number(String(s).replace(/[^\d.-]/g, '')) || 0 : 0); // ranking only; display uses the tool's string

function BestPrepay({ loans }: { loans: R[] }) {
  const { api } = useApp();
  const [best, setBest] = useState<R | null>(null);
  useEffect(() => {
    void Promise.all(loans.map((l) => post(api, '/api/tool', { tool: 'simulate_prepayment', input: { loan: l.loan.split(' ')[0], amount_rupees: 50000 } }).then((j) => j.result as R)))
      .then((rs) => setBest(rs.filter((r) => r && !r.error && r.allowed_now).sort((a, b) => num(b.net_saving_after_charge) - num(a.net_saving_after_charge))[0] ?? null));
  }, [api, loans]);
  if (!best) return null;
  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <span style={{ display: 'grid', gap: 2 }}><b style={{ fontSize: 14.5 }}>Prepay {best.prepay} now?</b><small style={{ color: 'var(--muted)', fontSize: 12.5 }}>Best today: {best.loan.split(' (')[0]}, {num(best.charge_incl_gst) === 0 ? 'no charge' : `charge ${best.charge_incl_gst}`}</small></span>
      <span style={{ display: 'grid', justifyItems: 'end', gap: 2 }}><small style={{ color: 'var(--muted)', fontSize: 12 }}>net saving</small><b className="mono pos" style={{ fontSize: 17 }}>{best.net_saving_after_charge}</b></span>
    </div>
  );
}

function Prepay({ loans }: { loans: R[] }) {
  const { api } = useApp();
  const [loan, setLoan] = useState(loans[0]?.loan?.split(' ')[0] ?? 'car'); const [amt, setAmt] = useState('50000');
  const [r, setR] = useState<R | null>(null); const [saved, setSaved] = useState('');
  const run = async () => { setSaved(''); setR((await post(api, '/api/tool', { tool: 'simulate_prepayment', input: { loan, amount_rupees: Number(amt) } })).result); };
  const save = async () => { const j = await post(api, '/api/actions', { tool: 'save_prepayment_plan', input: { loan, amount_rupees: Number(amt) } }); setSaved(j.action ? 'Plan saved with a calendar reminder (You → Actions)' : (j.result?.error ?? 'Could not save')); };
  return (
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <b>Try another amount</b>
      <div style={{ display: 'flex', gap: 8 }}>
        <select aria-label="Loan" value={loan} onChange={(e) => setLoan(e.target.value)} style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', padding: '0 10px' }}>{loans.map((l) => <option key={l.loan} value={l.loan.split(' ')[0]}>{l.loan} · {l.rate}</option>)}</select>
        <input aria-label="Amount in rupees" inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ''))} style={{ width: 84, minWidth: 0, height: 44, borderRadius: 10, border: '1px solid var(--line)', padding: '0 10px', fontFamily: 'var(--mono)' }} />
        <button className="btn" onClick={run} disabled={!amt}>Check</button>
      </div>
      {r && (r.error ? <span className="err">{r.error}</span> : !r.allowed_now ? <span className="sub">Not allowed yet: part-prepayment opens {fmtDate(r.allowed_from)}.</span> : (
        <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Interest saved, after charges</span><b className="mono pos">{r.net_saving_after_charge}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>EMIs fewer</span><b className="mono">{r.months_saved}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bank left after dues and this</span><b className={`mono ${isNeg(r.balance_after_dues_and_prepayment) ? 'neg' : ''}`}>{r.balance_after_dues_and_prepayment}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Emergency buffer</span><b className="mono">{r.emergency_months_now} → {r.emergency_months_after} months</b></div>
          {saved ? <span className="sub">{saved}</span> : <button className="btn small" style={{ justifySelf: 'start' }} onClick={save}>Save as a plan + reminder</button>}
          <ShowMath data={r} />
        </div>
      ))}
    </div>
  );
}

export default function Loans() {
  return (
    <Screen title="Loans" back={{ href: '/', label: 'Home' }}>
      <WithSummary>{(s) => {
        const l = s.loans_overview ?? {}; const loans = ((l.loans ?? []) as R[]).slice().sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate));
        if (!loans.length) return <Empty title="No loans found" body="Add your loan papers (sanction letter or statement) to see what's left, interest still to pay and prepayment options." cta={{ href: '/you#files', label: 'Add files' }} />;
        return (<>
          <div className="topbar" style={{ minHeight: 0 }}><span className="sub">{l.emi_share_of_income} of income</span><b className="mono" style={{ fontSize: 18 }}>{l.total_emi_per_month}/mo</b></div>
          {loans.map((x) => (
            <div key={x.loan + x.lender} className="card" style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span><b style={{ fontSize: 15, textTransform: 'capitalize' }}>{x.loan}</b><small style={{ display: 'block', color: 'var(--muted)', fontSize: 12.5 }}>{x.lender}</small></span><span className="mono" style={{ fontSize: 18 }}>{x.rate}</span></div>
              <div className="grid3" style={{ fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ display: 'grid', gap: 2 }}>Outstanding<b className="mono" style={{ color: 'var(--ink)', fontSize: 13 }}>{x.outstanding}</b></span>
                <span style={{ display: 'grid', gap: 2 }}>EMI<b className="mono" style={{ color: 'var(--ink)', fontSize: 13 }}>{x.emi}</b></span>
                <span style={{ display: 'grid', gap: 2 }}>EMIs left<b className="mono" style={{ color: 'var(--ink)', fontSize: 13 }}>{x.emis_left}</b></span>
              </div>
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-2)' }}>Interest still to pay {x.interest_still_to_pay}. Part-prepayment: {x.part_prepayment}. Foreclosure: {x.foreclosure}.{x.emi_matches_terms === false ? ' ⚠ EMI charged differs from the loan terms.' : ''}</span>
            </div>
          ))}
          {!!l.offers?.length && <Negotiate loan={loans.slice().sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate))[0].loan.split(' ')[0]} />}
          <BestPrepay loans={loans} />
          <Prepay loans={loans} />
          <ShowMath data={l} />
        </>);
      }}</WithSummary>
    </Screen>
  );
}
