'use client';
// Testing switches you can add to any link (no screens, no settings):
//   ?theme=dark | light | auto   — pin the theme for this tab, or follow the phone again
//   ?mode=guided | test          — preview what real users see (stricter advice), or go back to test mode
// They run before the screen mounts, so the first paint already uses them.
import { useLayoutEffect } from 'react';

export function TestSwitches() {
  useLayoutEffect(() => {
    const q = new URLSearchParams(location.search);
    const theme = q.get('theme'), mode = q.get('mode');
    try {
      if (theme === 'dark' || theme === 'light') sessionStorage.setItem('munim_theme', theme);
      else if (theme === 'auto') sessionStorage.removeItem('munim_theme');
    } catch { /* private mode: falls back to the phone's setting */ }
    if (mode === 'guided') document.cookie = 'munim_mode=guided; path=/; max-age=86400; samesite=lax';
    else if (mode === 'test') document.cookie = 'munim_mode=; path=/; max-age=0; samesite=lax';
  }, []);
  return null;
}
