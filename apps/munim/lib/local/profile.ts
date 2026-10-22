'use client';
// Who is using Munim on this phone: language, how they started, and the first name to greet them by (D-049).
// Kept in this browser only (localStorage), like their statements; never sent to the server or to an LLM.
export type Lang = 'hi' | 'en';
export interface Profile { lang: Lang; start: 'mine' | 'sample'; name: string | null; doneAt: string }

const KEY = 'munim_profile';
let memory: Profile | null = null;

export function getProfile(): Profile | null {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as Profile; } catch { /* private mode: memory only */ }
  return memory;
}
export function saveProfile(p: Profile) {
  memory = p;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* memory only */ }
}
export function updateProfile(patch: Partial<Profile>) { const p = getProfile(); if (p) saveProfile({ ...p, ...patch }); }
export function clearProfile() { memory = null; try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ } }

/** A first name as typed, trimmed to something safe to show: letters (any script), spaces, dot, hyphen, apostrophe; max 24. */
export function cleanName(s: string): string | null {
  const n = s.normalize('NFC').replace(/[^\p{L}\p{M} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return n || null;
}
/** The design's "bharat" variant is the Hindi version. */
export const variantOf = (p: Profile | null) => (p?.lang === 'hi' ? 'bharat' : 'standard');
