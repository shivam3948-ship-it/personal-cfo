'use client';
// Mounts a compiled design screen with live data: fetches its view model, follows the system light/dark setting,
// and maps fetch status to the design's own loading / error states.
import { useEffect, useState, type ComponentType } from 'react';
import { track } from '@/lib/analytics';
import { getProfile, variantOf, type Profile } from '@/lib/local/profile';

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
/** `patch` lets a page fold in data that lives only on this phone (your CAS) before the screen renders; it never goes to the server. */
/** A patched view marks `_mine: true` when it now shows your data, and may set `_state` (e.g. 'empty'). Anything else is the
 *  sample family, so a "Sample data" bar sits above it (D-049); `sample` marks static screens that are sample-only. */
export function Screen({ C, view, props = {}, check, patch, sample = false }: { C: ComponentType<Props>; view?: string; props?: Props; check?: (data: unknown) => string | null; patch?: (data: Record<string, unknown>) => Promise<Record<string, unknown>>; sample?: boolean }) {
  const theme = useTheme();
  const [prof, setProf] = useState<Profile | null | undefined>(undefined);
  useEffect(() => { setProf(getProfile()); }, []);
  const [data, setData] = useState<unknown>(view ? undefined : {});
  const [err, setErr] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!view) { track('screen_viewed', { screen: 'static' }); return; }
    let live = true;
    fetch(`/api/view/${view}`, { cache: 'no-store' }).then(async (r) => {
      const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Could not load this screen.');
      const v = patch ? await patch(j.view).catch(() => j.view) : j.view;
      if (live) { setData(v); setErr(null); track('screen_viewed', { screen: view }); }
    }).catch((e) => { if (live) { setErr((e as Error).message); track('view_load_failed', { screen: view }); } });
    return () => { live = false; };
  }, [view, n]);
  if (data === undefined || prof === undefined) return err ? <Failed message={err} onRetry={() => setN(n + 1)} /> : <Loading />;
  const bad = check?.(data);
  if (bad) return <Failed message={bad} onRetry={() => { location.href = '/spends'; }} retryLabel="Back" />;
  const d = data as Record<string, unknown>;
  const showsSample = sample || (!!view && !d._mine);
  const screen = <C {...props} variant={props.variant ?? variantOf(prof)} theme={theme} state={(d._state as string) ?? 'ready'} data={data} />;
  if (!showsSample) return screen;
  return <div style={{ ['--screen-h' as string]: `calc(100dvh - ${BAR}px)` }}><SampleBar hi={prof?.lang === 'hi'} />{screen}</div>;
}

export const BAR = 44;
/** One line, on every screen that shows the sample family, so it never passes for your money. */
export function SampleBar({ hi }: { hi: boolean }) {
  return (
    <div role="note" style={{ height: BAR, boxSizing: 'border-box', maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', background: 'var(--mari-tint)', color: 'var(--mari-ink)', fontSize: 13.5 }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mari)', flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b style={{ fontWeight: 600 }}>{hi ? 'नमूना डेटा' : 'Sample data'}</b>{hi ? ' · रोहन, एक काल्पनिक परिवार' : ' · Rohan, a made-up family'}</span>
      <a href="/invest/add" onClick={() => track('sample_bar_add_tapped')} style={{ flex: 'none', fontWeight: 600, color: 'var(--link)', textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center' }}>{hi ? 'अपना जोड़ें ›' : 'Add yours ›'}</a>
    </div>
  );
}

/** Hindi for the wrapper's own loading and error lines; read after mount (the profile lives in this browser). */
function useHi() { const [hi, setHi] = useState(false); useEffect(() => { setHi(getProfile()?.lang === 'hi'); }, []); return hi; }

function Loading() {
  const hi = useHi();
  return (
    <div aria-busy="true" style={{ maxWidth: 480, margin: '0 auto', padding: '16px', display: 'grid', gap: 12 }}>
      <span className="skel" style={{ height: 32, width: '40%' }} />
      <span className="skel" style={{ height: 180, borderRadius: 22 }} />
      <span className="skel" style={{ height: 220, borderRadius: 22 }} />
      <span style={{ fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>{hi ? 'आपका हिसाब जोड़ा जा रहा है…' : 'Adding up your money…'}</span>
    </div>
  );
}

function Failed({ message, onRetry, retryLabel }: { message: string; onRetry: () => void; retryLabel?: 'Retry' | 'Back' }) {
  const hi = useHi();
  const label = (retryLabel ?? 'Retry') === 'Back' ? (hi ? 'वापस' : 'Back') : (hi ? 'फिर कोशिश करें' : 'Retry');
  return (
    <div role="alert" style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--err-tint)', color: 'var(--err-ink)', borderRadius: 16, padding: '6px 6px 6px 14px' }}>
        <span style={{ flex: 1, fontSize: 14 }}>{message}</span>
        <button type="button" onClick={onRetry} style={{ minHeight: 40, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--card)', color: 'var(--ink)', fontSize: 14, fontWeight: 600 }}>{label}</button>
      </div>
    </div>
  );
}
