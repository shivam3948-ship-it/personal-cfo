'use client';
// Your answers to "Still using it?" (D-052), kept in this browser with your statements. The answers themselves are not
// sent anywhere; a finding built from them ("Netflix charged again after you decided to cancel") can reach the AI as a
// computed tool result, like any other finding (D-050 option A). Analytics gets the button only, never the merchant.
import { idbGet, idbPut } from './idb';
import type { Dataset } from '@core/types';

export type SubAnswer = 'yes' | 'no' | 'later';
type Answers = NonNullable<Dataset['subAnswers']>;
const KEY = 'sub_answers';

export async function loadSubAnswers(): Promise<Answers> { return (await idbGet<Answers>(KEY)) ?? {}; }
export async function saveSubAnswer(merchant: string, answer: SubAnswer): Promise<void> {
  const all = await loadSubAnswers();
  await idbPut(KEY, { ...all, [merchant]: { answer, at: new Date().toISOString() } });
}
