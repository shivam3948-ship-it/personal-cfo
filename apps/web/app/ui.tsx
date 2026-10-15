'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp, type Summary } from './client';

const I = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  money: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  invest: <path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" />,
  plan: <><path d="M9 5h11M9 12h11M9 19h11" /><path d="M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2" /></>,
  talk: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
};
const TABS: { href: string; label: string; icon: keyof typeof I; match: RegExp }[] = [
  { href: '/', label: 'Home', icon: 'home', match: /^\/($|loans|protect|credit|you)/ },
  { href: '/money', label: 'Money', icon: 'money', match: /^\/money/ },
  { href: '/invest', label: 'Invest', icon: 'invest', match: /^\/invest/ },
  { href: '/plan', label: 'Plan', icon: 'plan', match: /^\/plan/ },
  { href: '/talk', label: 'Talk', icon: 'talk', match: /^\/talk/ },
];

export function BottomNav() {
  const path = usePathname() ?? '/';
  return (
    <nav className="nav" aria-label="Main"><div>
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.match.test(path) ? 'page' : undefined}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{I[t.icon]}</svg>
          {t.label}
        </Link>
      ))}
    </div></nav>
  );
}

export function Screen({ title, back, right, children, nav = true }: { title?: React.ReactNode; back?: { href: string; label: string }; right?: React.ReactNode; children: React.ReactNode; nav?: boolean }) {
  return (
    <div className="app">
      <main className={`screen${nav ? '' : ' nonav'}`}>
        {back && <Link className="back" href={back.href}>← {back.label}</Link>}
        {(title || right) && <div className="topbar">{typeof title === 'string' ? <h1>{title}</h1> : title}{right}</div>}
        {children}
      </main>
      {nav && <BottomNav />}
    </div>
  );
}

/** Wraps a screen body: loading skeleton, error, and the "sample family" banner. */
export function WithSummary({ children }: { children: (s: Summary) => React.ReactNode }) {
  const { summary, summaryError, refresh, signedIn } = useApp();
  if (summaryError && !summary) return <div className="note red"><b>{summaryError}</b><button className="btn small" onClick={() => void refresh()}>Try again</button></div>;
  if (!summary) return <><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></>;
  return (
    <>
      {summary.isSample && <div className="banner"><span>You're looking at the sample family.</span>{signedIn ? <Link href="/you#files">Add your data</Link> : <Link href="/signin">Use my data</Link>}</div>}
      {children(summary)}
    </>
  );
}

export function ShowMath({ data, label = 'Show the math' }: { data: unknown; label?: string }) {
  return (
    <details className="math">
      <summary>{label}</summary>
      <pre>{JSON.stringify(data, null, 1)}</pre>
    </details>
  );
}

export function Empty({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <b>{title}</b>
      <span className="sub" style={{ lineHeight: 1.5 }}>{body}</span>
      {cta && <Link className="btn primary small" style={{ justifySelf: 'start', textDecoration: 'none' }} href={cta.href}>{cta.label}</Link>}
    </div>
  );
}

export const GuidanceBadge = () => <span className="pillstat review">Guidance · not registered advice</span>;

/** "₹1,23,456" strings from the tools; returns the sign for colouring. */
export const isNeg = (s?: string | null) => !!s && s.trim().startsWith('-');
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
