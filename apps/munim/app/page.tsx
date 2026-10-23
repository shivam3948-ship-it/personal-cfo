'use client';
// Today. First visit on this phone (no profile yet) goes to onboarding (D-049).
import { useEffect, useState } from 'react';
import Today from '@/screens/Today';
import { Screen } from '@/ui/Screen';
import { withMyToday } from '@/lib/local/patch';
import { getProfile } from '@/lib/local/profile';
import { saveSubAnswer, type SubAnswer } from '@/lib/local/subAnswers';
import { track } from '@/lib/analytics';
import { trySample } from '@/ui/trySample';

// "Still using it?" (D-052): the answer stays on this phone; the event carries the answer only, never the merchant
const onSubAnswer = (merchant: string, answer: SubAnswer) => { void saveSubAnswer(merchant, answer); track('sub_answered', { answer }); };

export default function Page() {
  const [ok, setOk] = useState(false);
  useEffect(() => { if (getProfile()) setOk(true); else location.replace('/welcome'); }, []);
  return ok ? <Screen C={Today} view="today" patch={withMyToday} props={{ onTrySample: trySample, onSubAnswer }} /> : null;
}
