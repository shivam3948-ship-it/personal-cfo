// Account: members (family), consents, delete-all-my-data. Signed-in only; RLS enforces ownership in the database too.
import { json } from '@/lib/http';
import { resolve } from '@/lib/session';
import { deleteAuthUser } from '@/lib/supabase';
import { clearActions } from '@/lib/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PURPOSES = ['analyse', 'ai', 'voice'] as const;
const RELATIONS = ['self', 'parent', 'spouse', 'child', 'sibling', 'other'];

export async function GET(req: Request) {
  const ctx = await resolve(req);
  if (!ctx.user) return json({ signedIn: false });
  const c = await ctx.user.db.from('consents').select('purpose,granted,updated_at');
  return json({ signedIn: true, phone: ctx.user.phone ? ctx.user.phone.replace(/\d(?=\d{4})/g, '•') : null, member: ctx.member, members: ctx.members, consents: c.data ?? [] });
}

/** { consents: {analyse,ai,voice} } and/or { addMember: { label, relation, attest: true } } */
export async function POST(req: Request) {
  const ctx = await resolve(req);
  if (!ctx.user) return json({ error: 'Sign in first' }, 401);
  const body = (await req.json().catch(() => ({}))) as { consents?: Record<string, boolean>; addMember?: { label?: string; relation?: string; attest?: boolean } };
  if (body.consents) {
    const rows = PURPOSES.filter((p) => typeof body.consents![p] === 'boolean').map((p) => ({ user_id: ctx.user!.id, purpose: p, granted: body.consents![p], version: 'v1', updated_at: new Date().toISOString() }));
    if (rows.length) { const r = await ctx.user.db.from('consents').upsert(rows); if (r.error) return json({ error: r.error.message }, 500); }
  }
  if (body.addMember) {
    const label = String(body.addMember.label ?? '').trim().slice(0, 40); const relation = RELATIONS.includes(String(body.addMember.relation)) ? String(body.addMember.relation) : 'other';
    if (!label) return json({ error: 'Name the member' }, 400);
    if (relation !== 'self' && body.addMember.attest !== true) return json({ error: 'Confirm you have their permission' }, 400);
    if (ctx.members.length >= 6) return json({ error: 'Up to 6 members' }, 400);
    const r = await ctx.user.db.from('members').insert({ user_id: ctx.user.id, label, relation, consent_attested_at: relation === 'self' ? null : new Date().toISOString() }).select('id,label,relation,consent_attested_at').single();
    if (r.error) return json({ error: r.error.message }, 500);
    return json({ ok: true, member: r.data });
  }
  return json({ ok: true });
}

/** Delete all my data (J14). ?account=1 also removes the sign-in account when the server has the service-role key. */
export async function DELETE(req: Request) {
  const ctx = await resolve(req);
  if (!ctx.user) return json({ error: 'Sign in first' }, 401);
  const r = await ctx.user.db.rpc('delete_my_data');
  if (r.error) return json({ error: r.error.message }, 500);
  clearActions(ctx.sid);
  const account = new URL(req.url).searchParams.get('account') === '1' ? await deleteAuthUser(ctx.user.id) : false;
  return json({ ok: true, accountDeleted: account });
}
