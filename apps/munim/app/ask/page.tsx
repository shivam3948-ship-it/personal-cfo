'use client';
// Ask Munim. With your own statements on this phone it answers from them, on the phone (D-050); otherwise it answers
// about the sample family and carries the Sample data bar (D-049).
import { useEffect, useState } from 'react';
import AskLive from '@/ui/AskLive';
import { useTheme, SampleBar, BAR } from '@/ui/Screen';
import { getProfile } from '@/lib/local/profile';
import { myData } from '@/lib/local/askLocal';

export default function Page() {
  useTheme();
  const [state, setState] = useState<{ hi: boolean; local: boolean } | null>(null);
  useEffect(() => { const p = getProfile(); myData().then((d) => setState({ hi: p?.lang === 'hi', local: p?.start === 'mine' && !!d })).catch(() => setState({ hi: p?.lang === 'hi', local: false })); }, []);
  if (!state) return null;
  if (state.local) return <AskLive local hi={state.hi} />;
  return <div style={{ ['--screen-h' as string]: `calc(100dvh - ${BAR}px)` }}><SampleBar hi={state.hi} /><AskLive hi={state.hi} /></div>;
}
