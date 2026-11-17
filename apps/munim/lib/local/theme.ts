// Light, dark or the phone's own setting (29 Oct, owner's ask). Kept in this browser only. A ?theme= test switch (sessionStorage,
// ui/TestSwitches.tsx) still wins for that tab.
export type ThemePref = 'auto' | 'light' | 'dark';
const KEY = 'munim_theme_pref';
export const THEME_EVENT = 'munim-theme';

export function getThemePref(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; }
}
export function setThemePref(v: ThemePref) {
  try { if (v === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch { /* private mode: this visit only */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}
/** The theme to show: the tab's test switch, then your choice, then the phone. */
export function resolveTheme(phoneDark: boolean): 'light' | 'dark' {
  let pinned: string | null = null; try { pinned = sessionStorage.getItem('munim_theme'); } catch { /* none */ }
  if (pinned === 'dark' || pinned === 'light') return pinned;
  const p = getThemePref(); return p === 'auto' ? (phoneDark ? 'dark' : 'light') : p;
}
