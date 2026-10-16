'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { store, useApp } from './client';
import { Screen, ShowMath, WithSummary, fmtDate, isNeg } from './ui';

const rupees = (s?: string | null) => (s ? Number(s.replace(/[^\d.-]/g, '')) || 0 : 0); // for ranking only; display uses the tool's string

export default function Home() {
  const router = useRouter();
  const { summary, signedIn, setMemberId } = useApp();
  useEffect(() => { if (!store.get('munim-welcomed')) router.replace('/welcome'); }, [router]);
  const members = (summary?.members ?? []) as { id: string; label: string }[];

  return (
    <Screen
      title={<div style={{ display: 'grid', gap: 2 }}><span className="sub">{summary?.net_worth?.as_of ? new Date(summary.net_worth.as_of + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }) : ''}</span><span style={{ fontSize: 22, fontWeight: 700 }}>Namaste{summary?.isSample ? ', Rohan' : ''}{summary?.member && summary.member.relation !== 'self' ? ` · ${summary.member.label}` : ''}</span></div>}
      right={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {!(signedIn && members.length > 1) && <span style={{ fontSize: 13, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 999, padding: '6px 12px' }}>{summary?.member?.label ?? 'Me'}</span>}
        {signedIn && members.length > 1 && (
          <select aria-label="Family member" value={summary?.member?.id ?? ''} onChange={(e) => setMemberId(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '6px 10px', background: 'var(--surface)' }}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        )}
        <Link href="/you" aria-label="You: actions, family, files and privacy" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--dark)', color: 'var(--dark-ink)', display: 'grid', placeItems: 'center', textDecoration: 'none', fontWeight: 600 }}>{summary?.isSample ? 'R' : (summary?.member?.label ?? 'You').slice(0, 1).toUpperCase()}</Link>
      </div>}
    >
      <WithSummary>{(s) => {
        const nw = s.net_worth ?? {}; const b = s.sunday_briefing ?? {}; const pf = s.portfolio_overview ?? {};
        const dues = [...(b.upcoming_before_salary ?? [])] as { date: string; what: string; amount: string }[];
        const bigDue = dues.sort((x, y) => rupees(y.amount) - rupees(x.amount))[0];
        const leaks = (b.leaks ?? []) as { what: string; amount: string; per_year: string; deadline?: string }[];
        const top: { href: string; title: string; sub: string; amt: string; bad?: boolean }[] = [];
        if (bigDue) top.push({ href: '/money', title: `${bigDue.what} due ${fmtDate(bigDue.date)}`, sub: b.cashflow?.balance_after_dues ? `${isNeg(b.cashflow.balance_after_dues) ? 'Bank falls short' : 'Bank covers it'}; ${b.cashflow.balance_after_dues} left after all dues` : '', amt: bigDue.amount });
        if (leaks[0]) top.push({ href: '/money/subscriptions', title: leaks[0].what, sub: leaks[0].deadline ? `Act by ${fmtDate(leaks[0].deadline)}` : 'Money leaking every month', amt: `${leaks[0].per_year}/yr`, bad: true });
        if (pf.regular_plans?.funds) top.push({ href: '/invest', title: `${pf.regular_plans.funds} ${pf.regular_plans.funds === 1 ? 'fund' : 'funds'} in regular plans`, sub: 'Extra cost vs direct plans (estimate)', amt: `~${pf.regular_plans.estimated_extra_cost_per_year}/yr`, bad: true });
        else if (leaks[1]) top.push({ href: '/money/subscriptions', title: leaks[1].what, sub: 'Money leaking', amt: `${leaks[1].per_year}/yr`, bad: true });
        const loans = s.loans_overview ?? {}; const ins = s.insurance_overview ?? {}; const cr = s.credit_health ?? {}; const sub = s.subscriptions_and_leaks ?? {};

        return (<>
          <div className="card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="sub">Net worth (uploaded data)</span></div>
            <div className="big">{nw.net_worth ?? '—'}</div>
            <div className="grid3" style={{ fontSize: 12 }}>
              <div style={{ display: 'grid', gap: 2 }}><span className="sub" style={{ fontSize: 12 }}>Investments</span><b className="mono">{nw.mutual_funds ?? '—'}</b></div>
              <div style={{ display: 'grid', gap: 2 }}><span className="sub" style={{ fontSize: 12 }}>Bank</span><b className="mono">{nw.bank_balance ?? '—'}</b></div>
              <div style={{ display: 'grid', gap: 2 }}><span className="sub" style={{ fontSize: 12 }}>Loans</span><b className="mono neg">{nw.loans_outstanding ? `−${nw.loans_outstanding}` : '—'}</b></div>
            </div>
            <ShowMath data={nw} />
          </div>

          <Link className="hero" href="/talk?call=1">
            <div className="callrow">
              <span className="dot"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></span>
              <span style={{ display: 'grid', gap: 2 }}><b style={{ fontSize: 16 }}>Sunday Money Call</b><span style={{ fontSize: 13, color: 'var(--dark-muted)' }}>2 minutes, in Hindi or English</span></span>
            </div>
          </Link>

          {!!top.length && <>
            <div className="eyebrow">Top {top.length} this week</div>
            {top.map((t, i) => (
              <Link key={i} className="tile" href={t.href}>
                <span><b>{t.title}</b>{t.sub && <small>{t.sub}</small>}</span>
                <span className={`mono${t.bad ? ' neg' : ''}`} style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{t.amt}</span>
              </Link>
            ))}
          </>}

          <div className="grid2">
            <Link className="mini" href="/loans"><span>Loans · {loans.loans?.length ?? 0}</span><b className="mono">{loans.total_emi_per_month ? `${loans.total_emi_per_month}/mo` : '—'}</b></Link>
            <Link className="mini" href="/protect"><span>Insurance · {ins.policies?.length ?? 0}</span><b className="mono">{ins.total_premium_per_year ? `${ins.total_premium_per_year}/yr` : '—'}</b></Link>
            <Link className="mini" href="/credit"><span>Credit score</span><b className="mono">{cr.score ?? '—'} {typeof cr.change === 'number' && <span className={cr.change < 0 ? 'neg' : 'pos'} style={{ fontSize: 12 }}>{cr.change > 0 ? '+' : ''}{cr.change}</span>}</b></Link>
            <Link className="mini" href="/money/subscriptions"><span>Subscriptions · {sub.subscription_count ?? 0}</span><b className="mono">{sub.all_subscriptions_per_year ? `${sub.all_subscriptions_per_year}/yr` : '—'}</b></Link>
          </div>
        </>);
      }}</WithSummary>
    </Screen>
  );
}
