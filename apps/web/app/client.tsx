'use client';
// App-wide client state: anonymous session id, Supabase sign-in (phone OTP), selected family member, and the API helper
// that attaches them to every request. One summary fetch feeds every screen.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const authConfigured = !!(SB_URL && SB_ANON);
export const emailLoginEnabled = process.env.NEXT_PUBLIC_EMAIL_LOGIN === '1';
let sb: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!authConfigured) return null;
  if (!sb) sb = createClient(SB_URL, SB_ANON, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'munim-auth' } });
  return sb;
}

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
export { store };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Summary = Record<string, any>;
interface AppCtx {
  ready: boolean; sid: string; session: Session | null; signedIn: boolean;
  memberId: string | null; setMemberId: (id: string | null) => void;
  api: (path: string, init?: RequestInit) => Promise<Response>;
  summary: Summary | null; summaryError: string | null; refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => { const c = useContext(Ctx); if (!c) throw new Error('AppProvider missing'); return c; };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sid, setSid] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!authConfigured);
  const [memberId, setMember] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const token = useRef<string | null>(null);

  useEffect(() => {
    let s = store.get('munim-sid') ?? '';
    if (!/^[a-z0-9-]{8,64}$/i.test(s)) { s = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).toLowerCase(); store.set('munim-sid', s); }
    setSid(s); setMember(store.get('munim-member'));
    const c = supabase();
    if (!c) return;
    c.auth.getSession().then(({ data }) => { setSession(data.session); token.current = data.session?.access_token ?? null; setAuthReady(true); });
    const { data: sub } = c.auth.onAuthStateChange((_e, s2) => { setSession(s2); token.current = s2?.access_token ?? null; });
    return () => sub.subscription.unsubscribe();
  }, []);

  const api = useCallback((path: string, init: RequestInit = {}) => {
    const h: Record<string, string> = { ...(init.headers as Record<string, string> | undefined), 'x-sid': sid };
    if (token.current) h.authorization = `Bearer ${token.current}`;
    const m = store.get('munim-member'); if (m && token.current) h['x-member'] = m;
    return fetch(path, { ...init, headers: h });
  }, [sid]);

  const refresh = useCallback(async () => {
    if (!sid) return;
    try {
      const r = await api('/api/summary');
      if (!r.ok) throw new Error(`Couldn't load your data (${r.status})`);
      setSummary(await r.json()); setSummaryError(null);
    } catch (e) { setSummaryError((e as Error).message); }
  }, [api, sid]);

  const ready = !!sid && authReady;
  useEffect(() => { if (ready) void refresh(); }, [ready, session?.user?.id, memberId, refresh]);

  const setMemberId = useCallback((id: string | null) => { store.set('munim-member', id); setMember(id); }, []);
  const signOut = useCallback(async () => { await supabase()?.auth.signOut(); token.current = null; setSession(null); setMemberId(null); }, [setMemberId]);

  const value = useMemo<AppCtx>(() => ({ ready, sid, session, signedIn: !!session, memberId, setMemberId, api, summary, summaryError, refresh, signOut }), [ready, sid, session, memberId, setMemberId, api, summary, summaryError, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Download a file from an authenticated API route (a plain link can't carry the sign-in token). */
export async function downloadVia(api: AppCtx['api'], path: string, filename: string) {
  const r = await api(path); if (!r.ok) return false;
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
