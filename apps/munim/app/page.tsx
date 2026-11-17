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
import { FEATURE, loadIntents, notifiedSheets, recordIntent, type IntentLog } from '@/lib/local/intents';

// "Still using it?" (D-052): the answer stays on this phone; the event carries the answer only, never the merchant
const onSubAnswer = (merchant: string, answer: SubAnswer) => { void saveSubAnswer(merchant, answer); track('sub_answered', { answer }); };

export default function Page() {
  const [ok, setOk] = useState(false);
  const [intents, setIntents] = useState<IntentLog>({});
  useEffect(() => { if (getProfile()) setOk(true); else location.replace('/welcome'); void loadIntents().then(setIntents); }, []);
  // "coming soon" doors (D-063): kept on this phone, counted as usage events by feature only
  const onIntent = (sheet: string, kind: 'opened' | 'notify') => {
    const feature = FEATURE[sheet]; if (!feature) return;
    track(kind === 'opened' ? 'fake_door_shown' : 'fake_door_notify_tapped', kind === 'opened' ? { feature, first: !intents[sheet] } : { feature });
    void recordIntent(sheet, kind).then(setIntents);
  };
  return ok ? <Screen C={Today} view="today" patch={withMyToday} props={{ onTrySample: trySample, onSubAnswer, onIntent, intents: notifiedSheets(intents) }} /> : null;
}
