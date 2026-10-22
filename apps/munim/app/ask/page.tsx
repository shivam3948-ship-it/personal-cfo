'use client';
// Ask Munim answers from the sample family until it can read your statements (agent architecture, decision A pending),
// so it always carries the Sample data bar (D-049).
import { useEffect, useState } from 'react';
import AskLive from '@/ui/AskLive';
import { useTheme, SampleBar, BAR } from '@/ui/Screen';
import { getProfile } from '@/lib/local/profile';

export default function Page() {
  useTheme();
  const [hi, setHi] = useState(false);
  useEffect(() => { setHi(getProfile()?.lang === 'hi'); }, []);
  return <div style={{ ['--screen-h' as string]: `calc(100dvh - ${BAR}px)` }}><SampleBar hi={hi} /><AskLive /></div>;
}
