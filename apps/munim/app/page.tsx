'use client';
// S03 Home: "Is my money okay?" answered in one screen: net worth with its math, the 3 things that matter this week,
// a way to talk, and the four areas. Data: GET /api/view/home → HomeView (lib/views/home.ts).
import Link from 'next/link';
import { AppShell } from '@/ui/AppShell';
import { ShowMath } from '@/ui/ShowMath';
import { EmptyState, ErrorState, Skeleton } from '@/ui/States';
import { IconMic } from '@/ui/icons';
import { useView } from '@/ui/useView';
import { track } from '@/lib/analytics';
import type { HomeView } from '@/lib/views/types';

export default function Home() {
  const { state, reload } = useView('home');
  return (
    <AppShell>
      {state.status === 'loading' && <><Header /><Skeleton /></>}
      {state.status === 'error' && <><Header /><ErrorState message={state.message} onRetry={reload} /></>}
      {state.status === 'ready' && <Ready v={state.view} />}
    </AppShell>
  );
}

function Header({ v }: { v?: HomeView }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span className="muted" style={{ fontSize: 13 }}>{v?.dateLabel ?? ' '}</span>
        <h1 style={{ margin: 0, fontSize: 22, letterSpacing: '-0.01em' }}>{v?.greeting ?? 'Namaste'}</h1>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {v && <span style={{ fontSize: 13, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 999, padding: '6px 12px' }}>{v.memberLabel}</span>}
        <Link href="/you" aria-label="You: actions, family, files and privacy"
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--dark)', color: 'var(--dark-ink)', display: 'grid', placeItems: 'center', textDecoration: 'none', fontWeight: 600 }}>
          {(v?.greeting.split(', ')[1] ?? v?.memberLabel ?? 'Y').slice(0, 1)}
        </Link>
      </div>
    </header>
  );
}

function Ready({ v }: { v: HomeView }) {
  return (<>
    <Header v={v} />
    {v.isSample && <div className="banner"><span>You're looking at the sample family.</span><Link href="/you#files">Use my data</Link></div>}

    {v.netWorth ? (
      <section className="card" aria-labelledby="nw" style={{ display: 'grid', gap: 10 }}>
        <span id="nw" className="muted" style={{ fontSize: 13 }}>Net worth (from your documents)</span>
        <span className="num" style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.1 }}>{v.netWorth.total.text}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, fontSize: 12 }}>
          {([['Investments', v.netWorth.investments.text, ''], ['Bank', v.netWorth.bank.text, ''], ['Loans', v.netWorth.loans.text, 'neg']] as const).map(([l, t, c]) => (
            <div key={l} style={{ display: 'grid', gap: 2, minWidth: 0 }}><span className="muted">{l}</span><b className={`num ${c}`} style={{ fontWeight: 500, fontSize: 13 }}>{t}</b></div>
          ))}
        </div>
        {v.netWorth.total.math && <ShowMath math={v.netWorth.total.math} screen="home" figure="net_worth" />}
        <span className="muted" style={{ fontSize: 12 }}>Not included: {v.netWorth.notIncluded}</span>
      </section>
    ) : (
      <EmptyState title="Add your first document" body="Upload a mutual fund statement (CAS), a bank statement or a loan paper to see your net worth." cta={{ href: '/you#files', label: 'Add documents' }} />
    )}

    <Link href="/talk?call=1" onClick={() => track('home_call_started')}
      style={{ textDecoration: 'none', background: 'var(--dark)', color: 'var(--dark-ink)', borderRadius: 'var(--r-lg)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--mic)', display: 'grid', placeItems: 'center', flex: 'none' }}><IconMic color="#fff" /></span>
      <span style={{ display: 'grid', gap: 2 }}><b style={{ fontSize: 16 }}>Sunday Money Call</b><span style={{ fontSize: 13, color: 'var(--dark-muted)' }}>2 minutes, in Hindi or English</span></span>
    </Link>

    {!!v.top.length && <>
      <h2 className="eyebrow" style={{ margin: '4px 0 0' }}>Top {v.top.length} this week</h2>
      {v.top.map((t, i) => (
        <Link key={t.id} href={t.href} className="row-link" onClick={() => track('home_top_item_tapped', { reason: t.reason, position: i + 1 })}>
          <span style={{ minWidth: 0 }}><b>{t.title}</b><small>{t.sub}</small></span>
          <span className={`num ${t.tone === 'bad' ? 'neg' : ''}`} style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{t.amount}</span>
        </Link>
      ))}
    </>}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
      {v.tiles.map((t) => (
        <Link key={t.label} href={t.href} onClick={() => track('home_tile_tapped', { tile: t.href })}
          style={{ textDecoration: 'none', color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 12px', display: 'grid', gap: 2, minHeight: 60 }}>
          <span className="muted" style={{ fontSize: 12 }}>{t.label}</span>
          <b className={t.empty ? '' : 'num'} style={{ fontWeight: 500, fontSize: t.empty ? 13 : 15, color: t.empty ? 'var(--green-ink)' : undefined }}>
            {t.value}{t.delta && <span className={t.delta.tone === 'bad' ? 'neg' : 'pos'} style={{ fontSize: 12, marginLeft: 6 }}>{t.delta.text}</span>}
          </b>
        </Link>
      ))}
    </div>
  </>);
}
