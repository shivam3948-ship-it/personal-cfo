'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp, type Summary } from '../client';
import { Empty, Screen, ShowMath, WithSummary, fmtDate, isNeg } from '../ui';

const num = (s?: string | null) => (s ? Number(s.replace(/[^\d.-]/g, '')) || 0 : 0); // bar widths only

interface Month { month: string; complete: boolean; period: string; income: string; true_spend: string; committed: string; surplus: string; savings_rate: string }

function MonthView({ s }: { s: Summary }) {
  const { api } = useApp();
  const months = (s.money_overview?.months ?? []) as Month[];
  const keyOf = (m: Month) => m.period.slice(0, 7);
  const defaultKey = s.spending_breakdown?.month ? months.find((m) => m.month === s.spending_breakdown.month && m.complete) : months.filter((m) => m.complete).at(-1);
  const [key, setKey] = useState<string>(defaultKey ? keyOf(defaultKey) : months.at(-1) ? keyOf(months.at(-1)!) : '');
  const [breakdown, setBreakdown] = useState(s.spending_breakdown);
  useEffect(() => {
    if (!key || (defaultKey && key === keyOf(defaultKey))) { setBreakdown(s.spending_breakdown); return; }
    let live = true;
    api(`/api/summary?month=${key}`).then((r) => r.json()).then((j) => { if (live) setBreakdown(j.spending_breakdown); }).catch(() => {});
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!months.length) return <Empty title="No bank or card statements yet" body="Add bank and card statements (or SMS alerts) to see income, spending and what's left each month." cta={{ href: '/you#files', label: 'Add files' }} />;
  const m = months.find((x) => keyOf(x) === key) ?? months.at(-1)!;
  const complete = months.filter((x) => x.complete);
  const maxAbs = Math.max(1, ...complete.map((x) => Math.abs(num(x.surplus))));
  const cats = ((breakdown?.categories ?? []) as { category: string; group: string; amount: string }[]).filter((c) => c.group === 'spend').slice(0, 6);
  const maxCat = Math.max(1, ...cats.map((c) => num(c.amount)));
  const b = s.sunday_briefing ?? {}; const cf = b.cashflow ?? {}; const ef = s.emergency_fund ?? {};

  return (<>
    <div className="seg2" role="group" aria-label="Month" style={{ alignSelf: 'flex-start' }}>
      {months.map((x) => <button key={keyOf(x)} aria-pressed={keyOf(x) === key} onClick={() => setKey(keyOf(x))}>{x.month.slice(0, 3)}{x.complete ? '' : '*'}</button>)}
    </div>
    <div className="card grid2" style={{ gap: 12 }}>
      <div style={{ display: 'grid', gap: 2 }}><span className="sub">Income</span><b className="mono" style={{ fontSize: 18 }}>{m.income}</b></div>
      <div style={{ display: 'grid', gap: 2 }}><span className="sub">True spend</span><b className="mono" style={{ fontSize: 18 }}>{m.true_spend}</b></div>
      <div style={{ display: 'grid', gap: 2 }}><span className="sub">EMIs, SIP, insurance, family</span><b className="mono" style={{ fontSize: 18 }}>{m.committed}</b></div>
      <div style={{ display: 'grid', gap: 2 }}><span className="sub">Left over</span><b className={`mono ${isNeg(m.surplus) ? 'neg' : 'pos'}`} style={{ fontSize: 18 }}>{m.surplus} · {m.savings_rate}</b></div>
    </div>
    {!m.complete && <span className="sub">* {m.month} is still running ({m.period}).</span>}
    {complete.length > 1 && (
      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <b style={{ fontSize: 13 }}>Left over each month</b>
        {complete.map((x) => (
          <div key={keyOf(x)} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 84px', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
            <span>{x.month.slice(0, 3)}</span><i style={{ display: 'block', height: 10, borderRadius: 5, background: isNeg(x.surplus) ? 'var(--red)' : 'var(--green)', width: `${(Math.abs(num(x.surplus)) / maxAbs) * 100}%` }} /><span className={`mono ${isNeg(x.surplus) ? 'neg' : ''}`} style={{ textAlign: 'right' }}>{x.surplus}</span>
          </div>
        ))}
      </div>
    )}
    {!!cats.length && (
      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <b style={{ fontSize: 13 }}>Where it went in {breakdown?.month}</b>
        {cats.map((c) => <div key={c.category} className="hbar"><span>{c.category}</span><i style={{ width: `${(num(c.amount) / maxCat) * 100}%` }} /><span className="mono" style={{ textAlign: 'right' }}>{c.amount}</span></div>)}
        <span className="sub" style={{ fontSize: 12 }}>Self-transfers and card-bill payments are left out, so nothing is counted twice.</span>
      </div>
    )}
    {!!b.unusual?.length && <>
      <div className="eyebrow">Unusual</div>
      {b.unusual.map((u: { what: string; amount: string }, i: number) => <div key={i} className="tile"><span><b style={{ fontSize: 13.5 }}>{u.what}</b></span><span className="mono">{u.amount}</span></div>)}
    </>}
    {cf.dues_total && (
      <div className={`note ${isNeg(cf.balance_after_dues) ? 'red' : 'green'}`}>
        <b>Before next salary{cf.next_salary ? ` (${fmtDate(cf.next_salary)})` : ''}</b>
        <span>{(b.upcoming_before_salary ?? []).length} dues add up to {cf.dues_total}. Your balance of {cf.balance_now} {isNeg(cf.balance_after_dues) ? 'falls short by' : 'covers them, leaving'} {cf.balance_after_dues.replace('-', '')}.</span>
      </div>
    )}
    {ef.months_covered !== undefined && <div className="tile"><span><b>Emergency fund</b><small>{ef.note ?? ef.basis}</small></span><span className="mono">{ef.months_covered} mo</span></div>}
    <Link className="tile" href="/money/subscriptions"><span><b>Subscriptions & leaks</b><small>{s.subscriptions_and_leaks?.subscription_count ?? 0} running · {s.subscriptions_and_leaks?.all_subscriptions_per_year ?? '—'} a year</small></span><span aria-hidden="true">→</span></Link>
    <ShowMath data={{ month: m, breakdown, cashflow: cf, sources: s.money_overview?.sources }} />
  </>);
}

export default function Money() {
  return <Screen title="Money"><WithSummary>{(s) => <MonthView s={s} />}</WithSummary></Screen>;
}
