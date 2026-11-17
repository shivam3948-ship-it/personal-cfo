// Everything the screens show, from the same tools the voice agent uses: one source for every number on screen and in speech.
import { datasetFor, isUsingUploads } from '@/lib/store';
import { json } from '@/lib/http';
import { resolve } from '@/lib/session';
import { runTool } from '@/lib/agent/tools';
import { supabaseConfigured } from '@/lib/supabase';
import { sarvamConfigured } from '@/lib/voice/sarvam';
import { MODEL } from '@/lib/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOOLS = ['net_worth', 'sunday_briefing', 'money_overview', 'spending_breakdown', 'subscriptions_and_leaks', 'upcoming_dues', 'loans_overview', 'insurance_overview', 'credit_health', 'emergency_fund', 'advice_plan', 'portfolio_overview'] as const;

export async function GET(req: Request) {
  const ctx = await resolve(req);
  const ds = await datasetFor(ctx.sid);
  const month = new URL(req.url).searchParams.get('month');
  const out: Record<string, unknown> = {};
  await Promise.all(TOOLS.map(async (t) => {
    try {
      const input = t === 'spending_breakdown' && month && /^\d{4}-\d{2}$/.test(month) ? { month } : {};
      out[t] = (await runTool(t, input, { ds, sid: ctx.sid, lang: 'en' })).result;
    } catch (e) { out[t] = { error: (e as Error).message.slice(0, 160) }; }
  }));
  return json({
    label: ds.label, isSample: !isUsingUploads(ctx.sid),
    has: { transactions: ds.txns.length > 0, loans: ds.loans.length > 0, policies: ds.policies.length > 0, credit: !!ds.credit, portfolio: !!ds.portfolio?.holdings.length },
    signedIn: !!ctx.user, member: ctx.member, members: ctx.members,
    status: { claude: !!process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_API_KEY ? MODEL : null, sarvam: sarvamConfigured(), auth: supabaseConfigured() },
    files: ds.log.map((l) => ({ file: l.file.split('/').pop(), kind: l.kind, ok: l.ok, summary: l.summary, checks: l.checks.length, failed: l.checks.filter((c) => !c.ok).length })),
    casChecks: ds.portfolio ? { passed: ds.portfolio.checks.filter((c) => c.ok).length, total: ds.portfolio.checks.length, source: ds.portfolio.source } : null,
    ...out,
  });
}
