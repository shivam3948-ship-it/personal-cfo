// Read-only calculators the screens call directly (prepayment, loan switch vs match, claim helper). No side effects.
import { json } from '@/lib/http';
import { resolve } from '@/lib/session';
import { runTool } from '@/lib/agent/tools';
import { datasetFor } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const READ_ONLY = new Set(['simulate_prepayment', 'loan_negotiation', 'claim_helper', 'spending_breakdown', 'upcoming_dues', 'search_documents']);

export async function POST(req: Request) {
  const ctx = await resolve(req);
  const body = (await req.json().catch(() => ({}))) as { tool?: string; input?: Record<string, unknown> };
  if (!body.tool || !READ_ONLY.has(body.tool)) return json({ error: 'Unknown tool' }, 400);
  const input = Object.fromEntries(Object.entries(body.input ?? {}).filter(([, v]) => ['string', 'number'].includes(typeof v)).map(([k, v]) => [k.slice(0, 40), typeof v === 'string' ? v.slice(0, 300) : v]));
  const out = await runTool(body.tool, input, { ds: await datasetFor(ctx.sid), sid: ctx.sid, lang: 'en' });
  return json({ result: out.result });
}
