'use client';
// Testing switches you can add to any link (no screens, no settings):
//   ?theme=dark | light | auto   — pin the theme for this tab, or follow the phone again
//   ?mode=guided | test          — preview what real users see (stricter advice), or go back to test mode
//   ?sample=1                    — demo link: skip onboarding and show the sample family (your statements stay saved)
//   ?lang=hi | en                — with sample=1, the language to demo in
//   ?ai=off | on                 — the no-model version: rules engine + browser voice (D-062); on clears it
//   #advice=<key> | off          — turn advice on for this browser with the owner's key (D-066), or off again. After the #,
//                                  so the key is never sent in a page request or kept in server logs; the page sends it once
//                                  to /api/advice and removes it from the address bar. (?advice= is ignored and removed.)
//   #owner=<key> | off           — mark this browser as the owner's (D-089): its Ask turns go to the owner's log at /owner.
//                                  Same handling as #advice: sent once to /api/owner, then removed from the address bar.
// They run before the screen mounts, so the first paint already uses them.
import { useLayoutEffect } from 'react';
import { getProfile, saveProfile } from '@/lib/local/profile';

export function TestSwitches() {
  useLayoutEffect(() => {
    const q = new URLSearchParams(location.search);
    const theme = q.get('theme'), mode = q.get('mode'), sample = q.get('sample'), lang = q.get('lang'), ai = q.get('ai');
    const h = new URLSearchParams(location.hash.slice(1));
    // read the raw value: URLSearchParams would turn a '+' in the key into a space (review 2, N11)
    const raw = /(?:^#|&)advice=([^&]*)/.exec(location.hash)?.[1]; let advice: string | null = null; try { advice = raw ? decodeURIComponent(raw) : null; } catch { advice = null; }
    const rawOwner = /(?:^#|&)owner=([^&]*)/.exec(location.hash)?.[1]; let owner: string | null = null; try { owner = rawOwner ? decodeURIComponent(rawOwner) : null; } catch { owner = null; }
    try {
      if (theme === 'dark' || theme === 'light') sessionStorage.setItem('munim_theme', theme);
      else if (theme === 'auto') sessionStorage.removeItem('munim_theme');
    } catch { /* private mode: falls back to the phone's setting */ }
    if (mode === 'guided') document.cookie = 'munim_mode=guided; path=/; max-age=86400; samesite=lax';
    else if (mode === 'test') document.cookie = 'munim_mode=; path=/; max-age=0; samesite=lax';
    if (ai === 'off') document.cookie = 'munim_ai=off; path=/; max-age=2592000; samesite=lax';
    else if (ai === 'on') document.cookie = 'munim_ai=; path=/; max-age=0; samesite=lax';
    if (q.has('advice')) { q.delete('advice'); history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : '') + location.hash); } // a key in the query string has already reached the server's logs: don't use it, change it
    if (q.has('owner')) { q.delete('owner'); history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : '') + location.hash); } // in the query string it has reached the server's logs: change the key
    if (owner) {
      h.delete('owner');
      history.replaceState(null, '', location.pathname + location.search + (h.toString() ? `#${h}` : ''));
      void fetch('/api/owner', owner === 'off' ? { method: 'DELETE' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: owner }) })
        .then(() => { if (!advice) location.reload(); }).catch(() => {});
    }
    if (advice) {
      h.delete('advice'); // never leave the key in the address bar, history or a shared screenshot
      history.replaceState(null, '', location.pathname + location.search + (h.toString() ? `#${h}` : ''));
      void fetch('/api/advice', advice === 'off' ? { method: 'DELETE' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: advice }) })
        .then(() => location.reload()).catch(() => {});
    }
    // runs before any screen's effects read the profile, so the first load is already the sample family
    if (sample === '1') {
      const p = getProfile();
      saveProfile({ lang: lang === 'hi' || lang === 'en' ? lang : p?.lang ?? 'en', start: 'sample', name: p?.name ?? null, doneAt: p?.doneAt ?? new Date().toISOString() });
    }
  }, []);
  return null;
}
