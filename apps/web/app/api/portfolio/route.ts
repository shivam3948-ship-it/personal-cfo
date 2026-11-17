import { emptyDataset } from '@/lib/types';
import { datasetFor, isUsingUploads } from '@/lib/store';
import { json } from '@/lib/http';
import { resolve } from '@/lib/session';
import { validatePortfolio } from '@/lib/portfolio/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Holdings parsed from a CAS in the browser. The PDF and its password never reach this server (AGENTS.md rule 5). */
export async function POST(req: Request) {
  const ctx = await resolve(req);
  const raw = await req.text();
  if (raw.length > 2_000_000) return json({ error: 'Too large' }, 413);
  let body: unknown; try { body = JSON.parse(raw); } catch { return json({ error: 'Bad JSON' }, 400); }
  const v = validatePortfolio(body);
  if (!v.ok) return json({ error: v.error }, 400);
  const base = isUsingUploads(ctx.sid) ? await datasetFor(ctx.sid) : emptyDataset('Your data');
  await ctx.saveDataset({ ...base, portfolio: v.data });
  return json({ ok: true, funds: v.data.holdings.length });
}

export async function DELETE(req: Request) {
  const ctx = await resolve(req);
  if (!isUsingUploads(ctx.sid)) return json({ ok: true });
  const ds = await datasetFor(ctx.sid);
  const rest = { ...ds, portfolio: undefined };
  const empty = !rest.txns.length && !rest.loans.length && !rest.policies.length && !rest.credit;
  await ctx.saveDataset(empty ? null : rest);
  return json({ ok: true });
}
