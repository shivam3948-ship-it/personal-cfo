'use client';
// Mounts a compiled design screen with live data: fetches its view model, follows the system light/dark setting,
// and maps fetch status to the design's own loading / error states.
import { useEffect, useState, type ComponentType } from 'react';
import { track } from '@/lib/analytics';

type Props = Record<string, unknown>;

export function useTheme(): 'light' | 'dark' {
  const [t, setT] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    // ?theme=dark|light pins the theme for this browser tab (testing); ?theme=auto goes back to the phone's setting
    const pinned = () => { try { return sessionStorage.getItem('munim_theme'); } catch { return null; } };
    const set = () => { const p = pinned(); const v = p === 'dark' || p === 'light' ? p : mq.matches ? 'dark' : 'light'; setT(v); document.body.className = 't-' + v; };
    set(); mq.addEventListener('change', set); return () => mq.removeEventListener('change', set);
  }, []);
  return t;
}

/** `check` lets a page reject data it can't show (e.g. an unknown category in the URL) with a message instead of a crash. */
export function Screen({ C, view, props = {}, check }: { C: ComponentType<Props>; view?: string; props?: Props; check?: (data: unknown) => string | null }) {
  const theme = useTheme();
  const [data, setData] = useState<unknown>(view ? undefined : {});
  const [err, setErr] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!view) { track('screen_viewed', { screen: 'static' }); return; }
    let live = true;
    fetch(`/api/view/${view}`, { cache: 'no-store' }).then(async (r) => {
      const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Could not load this screen.');
      if (live) { setData(j.view); setErr(null); track('screen_viewed', { screen: view }); }
    }).catch((e) => { if (live) { setErr((e as Error).message); track('view_load_failed', { screen: view }); } });
    return () => { live = false; };
  }, [view, n]);
  if (data === undefined) return err ? <Failed message={err} onRetry={() => setN(n + 1)} /> : <Loading />;
  const bad = check?.(data);
  if (bad) return <Failed message={bad} onRetry={() => { location.href = '/spends'; }} retryLabel="Back" />;
  return <C {...props} theme={theme} state="ready" data={data} />;
}

function Loading() {
  return (
    <div aria-busy="true" style={{ maxWidth: 480, margin: '0 auto', padding: '16px', display: 'grid', gap: 12 }}>
      <span className="skel" style={{ height: 32, width: '40%' }} />
      <span className="skel" style={{ height: 180, borderRadius: 22 }} />
      <span className="skel" style={{ height: 220, borderRadius: 22 }} />
      <span style={{ fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>Adding up your money…</span>
    </div>
  );
}

function Failed({ message, onRetry, retryLabel = 'Retry' }: { message: string; onRetry: () => void; retryLabel?: string }) {
  return (
    <div role="alert" style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--err-tint)', color: 'var(--err-ink)', borderRadius: 16, padding: '6px 6px 6px 14px' }}>
        <span style={{ flex: 1, fontSize: 14 }}>{message}</span>
        <button type="button" onClick={onRetry} style={{ minHeight: 40, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--card)', color: 'var(--ink)', fontSize: 14, fontWeight: 600 }}>{retryLabel}</button>
      </div>
    </div>
  );
}
