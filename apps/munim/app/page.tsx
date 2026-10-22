'use client';
// Today. First visit on this phone (no profile yet) goes to onboarding (D-049).
import { useEffect, useState } from 'react';
import Today from '@/screens/Today';
import { Screen } from '@/ui/Screen';
import { withMyToday } from '@/lib/local/patch';
import { getProfile } from '@/lib/local/profile';
import { trySample } from '@/ui/trySample';

export default function Page() {
  const [ok, setOk] = useState(false);
  useEffect(() => { if (getProfile()) setOk(true); else location.replace('/welcome'); }, []);
  return ok ? <Screen C={Today} view="today" patch={withMyToday} props={{ onTrySample: trySample }} /> : null;
}
