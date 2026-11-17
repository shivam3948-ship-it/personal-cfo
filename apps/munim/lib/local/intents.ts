'use client';
// What people asked for behind a "coming soon" door (D-063), kept on this phone: which sheets were opened, and which
// ones they asked to hear about. Counts of the same go out as usage events (no amounts, no names).
import { idbGet, idbPut } from './idb';

/** Sheet keys on Today → the feature name used in events. */
export const FEATURE: Record<string, string> = {
  autopay: 'autopay', once: 'save_once', topup: 'topup', now: 'save_now', pay: 'bill_pay', debt: 'card_extra',
  tool_goals: 'goals', tool_fire: 'fire', tool_ins: 'insurance', tool_fam: 'family',
};
export type IntentLog = Record<string, { opened: number; notifyAt?: string }>;
const KEY = 'intents';

export async function loadIntents(): Promise<IntentLog> { return (await idbGet<IntentLog>(KEY)) ?? {}; }
export async function recordIntent(sheet: string, kind: 'opened' | 'notify'): Promise<IntentLog> {
  const log = await loadIntents(); const cur = log[sheet] ?? { opened: 0 };
  log[sheet] = kind === 'opened' ? { ...cur, opened: cur.opened + 1 } : { ...cur, notifyAt: cur.notifyAt ?? new Date().toISOString() };
  await idbPut(KEY, log); return log;
}
/** Sheets this phone already asked to hear about: they open in the "we'll tell you" state. */
export const notifiedSheets = (log: IntentLog) => Object.fromEntries(Object.entries(log).filter(([, v]) => v.notifyAt).map(([k]) => [k, true]));
