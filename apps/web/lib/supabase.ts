// Supabase access on the server, always as the signed-in user (their JWT), so row-level security decides what they can see.
// The service-role key is never used for data (D-027); only optional account removal uses it.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_ = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const supabaseConfigured = () => !!(URL_() && ANON());

export function userClient(token: string): SupabaseClient {
  return createClient(URL_(), ANON(), { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}

export interface SignedIn { id: string; token: string; db: SupabaseClient; phone: string | null }

/** Verifies the bearer token with Supabase Auth. Returns null when signed out, not configured, or the token is invalid. */
export async function userFrom(req: Request): Promise<SignedIn | null> {
  if (!supabaseConfigured()) return null;
  const h = req.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(.+)$/i.exec(h)?.[1];
  if (!token || token.length > 4096) return null;
  const db = userClient(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, token, db, phone: data.user.phone ?? null };
}

/** Removes the auth account itself; needs the service-role key in server env (optional). */
export async function deleteAuthUser(userId: string): Promise<boolean> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !supabaseConfigured()) return false;
  const admin = createClient(URL_(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.deleteUser(userId);
  return !error;
}
