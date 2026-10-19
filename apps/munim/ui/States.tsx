export function Skeleton({ blocks = [110, 72, 56, 56, 56] }: { blocks?: number[] }) {
  return <div aria-busy="true" aria-label="Loading" style={{ display: 'grid', gap: 12 }}>{blocks.map((h, i) => <div key={i} className="skel" style={{ height: h }} />)}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="card" style={{ display: 'grid', gap: 10, borderColor: 'var(--red)' }}>
      <b>That didn't load</b>
      <span className="muted" style={{ fontSize: 14 }}>{message}</span>
      <button onClick={onRetry} style={{ justifySelf: 'start', border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 600 }}>Try again</button>
    </div>
  );
}

export function EmptyState({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <b>{title}</b>
      <span className="muted" style={{ fontSize: 14 }}>{body}</span>
      {cta && <a href={cta.href} style={{ justifySelf: 'start', background: 'var(--green)', color: '#fff', textDecoration: 'none', borderRadius: 12, padding: '10px 16px', fontWeight: 600 }}>{cta.label}</a>}
    </div>
  );
}
