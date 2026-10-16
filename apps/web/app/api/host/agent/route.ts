// Embedded Munim for a host app: rules first (fast, predictable), Claude only for questions the rules don't cover.
// The host sends its own state; Munim answers from it and proposes actions; the host applies them after "haan".
import { json } from '@/lib/http';
import { hostRespond, type Debit, type HostState, type Proposal, type Screen, type Withdrawal } from '@/lib/host/agent';
import { hostSystemPrompt, HOST_PROMPT_VERSION } from '@/lib/host/prompt';
import { checkNumbers } from '@/lib/agent/guard';
import { forSpeech } from '@/lib/agent/lang';
import { getClient, MODEL } from '@/lib/llm';
import { inr } from '@/lib/money';
import { redact } from '@/lib/privacy/redact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const int = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v < 1e12 ? v : null);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function readState(x: unknown): HostState | null {
  const s = x as Record<string, unknown>;
  if (!s || typeof s !== 'object') return null;
  const st = { savedPaise: int(s.savedPaise), valuePaise: int(s.valuePaise), dailyPaise: int(s.dailyPaise), streakDays: int(s.streakDays), monthSavedPaise: int(s.monthSavedPaise) };
  if (Object.values(st).some((v) => v === null)) return null;
  if (typeof s.nextDebit !== 'string' || !DATE.test(s.nextDebit) || typeof s.asOf !== 'string' || !DATE.test(s.asOf)) return null;
  const pausedUntil = typeof s.pausedUntil === 'string' && DATE.test(s.pausedUntil) ? s.pausedUntil : null;
  const REF = /^[A-Za-z0-9-]{1,24}$/;
  const withdrawals: Withdrawal[] = (Array.isArray(s.withdrawals) ? s.withdrawals : []).slice(0, 10).flatMap((x) => {
    const w = x as Record<string, unknown>;
    const amountPaise = int(w?.amountPaise);
    if (!amountPaise || typeof w.id !== 'string' || !REF.test(w.id) || !['processing', 'paid', 'failed'].includes(String(w.status))) return [];
    if (typeof w.requestedOn !== 'string' || !DATE.test(w.requestedOn) || typeof w.expectedBy !== 'string' || !DATE.test(w.expectedBy)) return [];
    return [{ id: w.id, amountPaise, requestedOn: w.requestedOn, expectedBy: w.expectedBy, status: w.status as Withdrawal['status'],
      paidOn: typeof w.paidOn === 'string' && DATE.test(w.paidOn) ? w.paidOn : undefined, bankRef: typeof w.bankRef === 'string' && REF.test(w.bankRef) ? w.bankRef : undefined }];
  });
  const debits: Debit[] = (Array.isArray(s.debits) ? s.debits : []).slice(0, 40).flatMap((x) => {
    const d = x as Record<string, unknown>; const amountPaise = int(d?.amountPaise);
    return amountPaise && typeof d.date === 'string' && DATE.test(d.date) && typeof d.ref === 'string' && REF.test(d.ref) ? [{ date: d.date, amountPaise, ref: d.ref }] : [];
  });
  return { ...(st as Omit<HostState, 'pausedUntil' | 'nextDebit' | 'asOf'>), pausedUntil, nextDebit: s.nextDebit, asOf: s.asOf, withdrawals, debits };
}
function readPending(x: unknown): Proposal | null {
  const p = x as Record<string, unknown>;
  if (!p || typeof p !== 'object') return null;
  if (p.type === 'set_daily' && int(p.amountPaise)) return { type: 'set_daily', amountPaise: p.amountPaise as number };
  if (p.type === 'pause' && int(p.days) && typeof p.until === 'string' && DATE.test(p.until)) return { type: 'pause', days: p.days as number, until: p.until };
  if (p.type === 'resume') return { type: 'resume' };
  if (p.type === 'handoff' && ['asked', 'withdrawal_late', 'not_understood', 'extra_debit', 'trust'].includes(String(p.reason))) return { type: 'handoff', reason: p.reason as Extract<Proposal, { type: 'handoff' }>['reason'], summary: String(p.summary ?? '').slice(0, 600) };
  if (p.type === 'refund_request' && int(p.extraPaise) && typeof p.date === 'string' && DATE.test(p.date)) return { type: 'refund_request', date: p.date, extraPaise: p.extraPaise as number, refs: (Array.isArray(p.refs) ? p.refs : []).map(String).slice(0, 10) };
  return null;
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const b = (await req.json().catch(() => ({}))) as { text?: string; lang?: 'hi' | 'en' | 'auto'; screen?: Screen; state?: unknown; pending?: unknown; misses?: unknown };
  const text = String(b.text ?? '').slice(0, 500).trim();
  const state = readState(b.state);
  if (!text || !state) return json({ error: 'text and a valid state are required' }, 400);
  const screen: Screen = b.screen === 'save' || b.screen === 'withdraw' ? b.screen : 'home';
  const misses = typeof b.misses === 'number' && b.misses >= 0 && b.misses < 20 ? Math.floor(b.misses) : 0;
  let r = hostRespond(text, state, screen, readPending(b.pending), b.lang ?? 'auto', { misses });
  let engine = 'rules';

  const client = getClient();
  if (r.intent === 'help' && client) {
    // Open question: Claude answers briefly, from the host state only; the number guard still applies.
    const facts = { saved: inr(state.savedPaise), value_now: inr(state.valuePaise), earned: inr(state.valuePaise - state.savedPaise), daily: inr(state.dailyPaise), this_month: inr(state.monthSavedPaise), streak_days: state.streakDays, paused_until: state.pausedUntil, next_debit: state.nextDebit, screen };
    try {
      const res = await client.messages.create({ model: MODEL, max_tokens: 220, system: hostSystemPrompt(r.lang, facts), messages: [{ role: 'user', content: redact(text) }] });
      const answer = res.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join(' ').trim();
      const check = checkNumbers(answer, [Object.values(facts)]);
      if (answer && check.ok) { r = { ...r, answer, check, intent: 'open_question' }; engine = 'claude'; }
    } catch (e) { console.error('[host-agent]', (e as Error).message); }
  }
  return json({ ...r, speech: forSpeech(r.answer, r.lang), engine, prompt: engine === 'claude' ? HOST_PROMPT_VERSION : null, ms: Date.now() - t0 });
}
