// Who is asking, and whose data: resolves a request to a session id (sid), loads that member's data and actions,
// and writes changes back. Signed out → the anonymous browser session (sample data, memory only).
// Signed in → the user's own rows under RLS; the member comes from `x-member` and is ownership-checked here (AGENTS.md rule 3).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Dataset } from './types';
import { sidOf } from './http';
import { userFrom, type SignedIn } from './supabase';
import { actionKey, listActions, setActions, type Action } from './actions';
import { isUsingUploads, setUploads, resetToDemo } from './store';
import { redact, holderNames } from './privacy/redact';

export interface Member { id: string; label: string; relation: string; consent_attested_at: string | null }
export interface Ctx {
  sid: string;
  user: SignedIn | null;
  member: Member | null;
  members: Member[];
  /** Save actions changed during this request (no-op when signed out). */
  flush: () => Promise<void>;
  /** Save the dataset for this member (signed in) or keep it in memory (signed out). */
  saveDataset: (ds: Dataset | null) => Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const compact = (u: string) => u.replace(/-/g, '');

async function ensureSelf(db: SupabaseClient, userId: string): Promise<Member[]> {
  const { data, error } = await db.from('members').select('id,label,relation,consent_attested_at').order('created_at');
  if (error) throw new Error(`members: ${error.message}`);
  if (data && data.length) return data as Member[];
  const ins = await db.from('members').insert({ user_id: userId, label: 'Me', relation: 'self' }).select('id,label,relation,consent_attested_at');
  if (ins.error) throw new Error(`members insert: ${ins.error.message}`);
  return ins.data as Member[];
}

/** Text that may hold personal details is redacted before it is stored (statements are mock data at the event; D-020). */
export function scrubForStorage(ds: Dataset): Dataset {
  const names = holderNames([...ds.docs.map((d) => d.text), ...ds.notices.map((n) => n.text)]);
  return {
    ...ds,
    docs: ds.docs.map((d) => ({ ...d, text: redact(d.text, { names }) })),
    notices: ds.notices.map((n) => ({ ...n, text: redact(n.text, { names }) })),
  };
}

export async function resolve(req: Request): Promise<Ctx> {
  const user = await userFrom(req);
  if (!user) {
    const sid = sidOf(req);
    return {
      sid, user: null, member: null, members: [],
      flush: async () => {},
      saveDataset: async (ds) => { if (ds) setUploads(sid, ds); else resetToDemo(sid); },
    };
  }
  const members = await ensureSelf(user.db, user.id);
  const asked = req.headers.get('x-member') ?? '';
  const member = (UUID.test(asked) && members.find((m) => m.id === asked)) || members[0]; // never trust a client id without this check
  const sid = `u_${compact(user.id).slice(0, 28)}_${compact(member.id).slice(0, 28)}`;

  const [dsRes, actRes] = await Promise.all([
    user.db.from('datasets').select('data').eq('member_id', member.id).maybeSingle(),
    user.db.from('actions').select('id,data').eq('member_id', member.id).order('created_at', { ascending: false }),
  ]);
  if (dsRes.data?.data) setUploads(sid, dsRes.data.data as Dataset); else if (isUsingUploads(sid)) resetToDemo(sid);
  const loaded = (actRes.data ?? []).map((r) => r.data as Action);
  setActions(sid, loaded);
  const before = new Set(loaded.map((a) => a.id));

  return {
    sid, user, member, members,
    flush: async () => {
      const now = listActions(sid); const nowIds = new Set(now.map((a) => a.id));
      const added = now.filter((a) => !before.has(a.id));
      const removed = [...before].filter((id) => !nowIds.has(id));
      if (added.length) {
        const { error } = await user.db.from('actions').upsert(added.map((a) => ({ id: a.id, user_id: user.id, member_id: member.id, key: actionKey(a).slice(0, 500), data: a })), { onConflict: 'user_id,member_id,key', ignoreDuplicates: true });
        if (error) console.error('[session] actions upsert', error.message);
      }
      if (removed.length) {
        const { error } = await user.db.from('actions').delete().eq('member_id', member.id).in('id', removed);
        if (error) console.error('[session] actions delete', error.message);
      }
    },
    saveDataset: async (ds) => {
      if (!ds) {
        resetToDemo(sid);
        const { error } = await user.db.from('datasets').delete().eq('member_id', member.id);
        if (error) throw new Error(`datasets delete: ${error.message}`);
        return;
      }
      const clean = scrubForStorage(ds);
      setUploads(sid, clean);
      const { error } = await user.db.from('datasets').upsert({ member_id: member.id, user_id: user.id, data: clean, updated_at: new Date().toISOString() });
      if (error) throw new Error(`datasets upsert: ${error.message}`);
    },
  };
}
