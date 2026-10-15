import { datasetFor, isUsingUploads } from '@/lib/store';
import { json } from '@/lib/http';
import { resolve } from '@/lib/session';
import { supabaseConfigured } from '@/lib/supabase';
import { asOfDate, cashflowCheck, coverage, creditView, emergencyFund, leaks, monthPictures, unusual, upcoming } from '@/lib/finance/picture';
import { inr } from '@/lib/money';
import { MODEL } from '@/lib/llm';
import { sarvamConfigured } from '@/lib/voice/sarvam';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await resolve(req); const sid = ctx.sid;
  const ds = await datasetFor(sid);
  const R = (p: number | null | undefined) => (p === null || p === undefined ? null : inr(p));
  let snapshot: Record<string, unknown> = {};
  try {
    const pics = monthPictures(ds); const last = pics.filter((p) => p.complete).at(-1);
    const cf = cashflowCheck(ds); const cr = creditView(ds); const ef = emergencyFund(ds);
    snapshot = {
      asOf: asOfDate(ds),
      balance: R(cf.balance), balanceDate: cf.balanceDate,
      lastMonth: last ? { key: last.key, income: R(last.income), spend: R(last.spend), committed: R(last.committed), surplus: R(last.surplus), savingsRatePct: last.savingsRatePct } : null,
      duesBeforeSalary: R(cf.duesTotal), nextSalary: cf.nextSalary, afterDues: R(cf.balanceAfterDues),
      upcoming: upcoming(ds).slice(0, 5).map((d) => ({ date: d.date, title: d.title, amount: R(d.amount) })),
      flags: leaks(ds).filter((l) => l.kind !== 'subscription').length + unusual(ds).length,
      credit: cr ? { score: cr.score, change: cr.change } : null,
      emergencyMonths: ef.months,
      months: coverage(ds).map((c) => c.key),
    };
  } catch (e) { snapshot = { error: (e as Error).message }; }
  return json({
    label: ds.label, usingUploads: isUsingUploads(sid),
    status: { claude: !!process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_API_KEY ? MODEL : null, sarvam: sarvamConfigured(), auth: supabaseConfigured() },
    signedIn: !!ctx.user,
    counts: { transactions: ds.txns.length, loans: ds.loans.length, policies: ds.policies.length, notices: ds.notices.length, credit: !!ds.credit },
    log: ds.log, snapshot,
  });
}
