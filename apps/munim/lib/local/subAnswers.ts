'use client';
// Your answers to "Still using it?" (D-052), kept in this browser with your statements. Never sent anywhere.
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
