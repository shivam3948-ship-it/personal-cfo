'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ScreenKey, ViewMap } from '@/lib/views/types';
import { track } from '@/lib/analytics';

type State<K extends ScreenKey> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; view: ViewMap[K] };

/** Loads one screen's view model. Every screen goes through this, so loading and error states are the same everywhere. */
export function useView<K extends ScreenKey>(screen: K) {
  const [state, setState] = useState<State<K>>({ status: 'loading' });
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const r = await fetch(`/api/view/${screen}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Could not load this screen.');
      setState({ status: 'ready', view: j.view as ViewMap[K] });
      track('screen_viewed', { screen });
    } catch (e) {
      setState({ status: 'error', message: (e as Error).message || 'Check your connection and try again.' });
      track('view_load_failed', { screen });
    }
  }, [screen]);
  useEffect(() => { void load(); }, [load]);
  return { state, reload: load };
}
