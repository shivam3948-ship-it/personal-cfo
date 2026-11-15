'use client';
// Ask Munim. On your own data it answers from your statements, on the phone (D-050); on the sample family it answers about
// the sample family and carries the Sample data bar (D-049). The two never mix.
import { useEffect, useState } from 'react';
import AskLive from '@/ui/AskLive';
import { useTheme, SampleBar, BAR } from '@/ui/Screen';
import { getProfile } from '@/lib/local/profile';

export default function Page() {
  useTheme();
  const [state, setState] = useState<{ hi: boolean; local: boolean } | null>(null);
  // on your own data Munim answers only from it, on the phone, even before you add anything (it then asks for a statement):
  // it never answers about the sample family in your mode (the owner, 15 Nov: the two modes never mix)
  useEffect(() => { const p = getProfile(); setState({ hi: p?.lang === 'hi', local: p?.start === 'mine' }); }, []);
  if (!state) return null;
  if (state.local) return <AskLive local hi={state.hi} />;
  return <div style={{ ['--screen-h' as string]: `calc(100dvh - ${BAR}px)` }}><SampleBar hi={state.hi} /><AskLive hi={state.hi} /></div>;
}
