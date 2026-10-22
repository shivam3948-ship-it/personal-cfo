'use client';
// "Try with sample data" from an empty screen: switch this phone to the sample family (your statements stay saved).
import { getProfile, saveProfile } from '@/lib/local/profile';
import { track } from '@/lib/analytics';
export function trySample() {
  const p = getProfile();
  saveProfile({ lang: p?.lang ?? 'en', start: 'sample', name: p?.name ?? null, doneAt: p?.doneAt ?? new Date().toISOString() });
  track('switched_to_sample');
  location.reload();
}
