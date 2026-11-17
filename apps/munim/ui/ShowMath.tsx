'use client';
import type { Math } from '@/lib/figure';
import { track } from '@/lib/analytics';

export function ShowMath({ math, screen, figure, label = 'Show the math' }: { math: Math; screen: string; figure: string; label?: string }) {
  return (
    <details className="math" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) track('math_opened', { screen, figure }); }}>
      <summary>{label}</summary>
      <div className="math-body">
        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{math.formula}</span>
        {math.parts.map((p) => <span key={p.label} className="part"><span>{p.label}</span><span className="num">{p.text}</span></span>)}
        {!!math.sources.length && <span className="muted" style={{ fontSize: 12 }}>From: {math.sources.join(' · ')}{math.asOf ? ` · as of ${math.asOf}` : ''}</span>}
      </div>
    </details>
  );
}
