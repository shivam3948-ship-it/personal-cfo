import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { runOffline, intentOf, clearPending } from '@/lib/agent/offline';
import { runClaude } from '@/lib/agent/claude';
import { TOOLS, runTool } from '@/lib/agent/tools';
import { clearActions } from '@/lib/actions';
import type { LlmClient } from '@/lib/llm';
import { demo } from './helpers';

const evals = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'evals/questions.json'), 'utf8')).cases as { id: string; q: string; lang: 'hi' | 'en'; tools_any: string[]; must_include: string[]; must_not_include?: string[]; live_only?: boolean }[];

describe('offline agent passes the golden set', () => {
  for (const c of evals.filter((x) => !x.live_only)) {
    it(`${c.id}: ${c.q}`, async () => {
      const ds = await demo(); const sid = `eval-${c.id}`; clearPending(sid);
      const r = await runOffline([{ role: 'user', content: c.q }], { ds, sid, lang: c.lang });
      expect(r.lang).toBe(c.lang);
      expect(r.trace.some((t) => c.tools_any.includes(t.tool))).toBe(true);
      for (const s of c.must_include) expect(r.answer).toContain(s);
      for (const s of c.must_not_include ?? []) expect(r.answer.toLowerCase()).not.toContain(s.toLowerCase());
      expect(r.check.ok).toBe(true);
    });
  }
  it('a confirmation executes the offered action exactly once', async () => {
    const ds = await demo(); const sid = 'confirm-flow'; clearPending(sid); clearActions(sid);
    const ctx = { ds, sid, lang: 'hi' as const };
    await runOffline([{ role: 'user', content: 'कौन से सब्सक्रिप्शन बेकार हैं?' }], ctx);
    const r = await runOffline([{ role: 'user', content: 'हाँ' }], ctx);
    expect(r.actions.length).toBe(1); expect(r.actions[0].kind).toBe('email');
    const again = await runOffline([{ role: 'user', content: 'हाँ' }], ctx);
    expect(again.actions.length).toBe(0);
  });
  it('routes Hinglish and Devanagari intents', () => {
    expect(intentOf('mera paisa kahan ja raha hai')).toBe('spend');
    expect(intentOf('kya main loan jaldi chuka sakta hoon')).toBe('prepay');
    expect(intentOf('Papa hospital mein admit hain')).toBe('claim');
    expect(intentOf('haan kar do')).toBe('confirm');
  });
});

describe('tool contract', () => {
  it('every tool runs on the demo data without errors and returns JSON-safe output', async () => {
    const ds = await demo(); const ctx = { ds, sid: 'contract', lang: 'en' as const };
    const inputs: Record<string, Record<string, unknown>> = {
      simulate_prepayment: { loan: 'car', amount_rupees: 50000 }, claim_helper: { member: 'father', condition: 'cataract' }, search_documents: { query: 'room rent' },
      create_reminder: { title: 't', date: '2026-10-23' }, draft_email: { kind: 'fee_waiver' }, create_savings_goal: { name: 'g', target_rupees: 10000, by_date: '2027-01-01' }, save_prepayment_plan: { loan: 'car', amount_rupees: 10000, date: '2026-11-01' },
    };
    for (const t of TOOLS) {
      const out = await runTool(t.name, inputs[t.name] ?? {}, ctx);
      expect([t.name, 'error' in out.result]).toEqual([t.name, false]);
      expect(() => JSON.stringify(out.result)).not.toThrow();
    }
  });
  it('tool results never carry holder names, P2P names, PAN-like strings or full account numbers', async () => {
    const ds = await demo(); const ctx = { ds, sid: 'pii', lang: 'en' as const };
    const blob = JSON.stringify(await Promise.all(['sunday_briefing', 'money_overview', 'spending_breakdown', 'subscriptions_and_leaks', 'upcoming_dues', 'loans_overview', 'insurance_overview', 'credit_health'].map((n) => runTool(n, {}, ctx))));
    for (const bad of ['Rohan', 'RAJESH', 'RAKESH', 'Mehta', 'okaxis', 'oksbi']) expect(blob).not.toContain(bad);
    expect(blob).not.toMatch(/\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/);
    expect(blob).not.toMatch(/\d{9,}/);
    const search = JSON.stringify((await runTool('search_documents', { query: 'policyholder nominee borrower' }, ctx)).result);
    expect(search).not.toContain('Rohan');
  });
});

describe('Claude loop (mocked client)', () => {
  const fake = (script: Anthropic.Message['content'][]): LlmClient => {
    let i = 0;
    return { messages: { create: async () => ({ id: `m${i}`, type: 'message', role: 'assistant', model: 'x', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } as Anthropic.Usage, content: script[i], stop_reason: script[i++].some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn' } as unknown as Anthropic.Message) } };
  };
  it('runs tools, returns the answer, verifies numbers', async () => {
    const ds = await demo(); clearActions('claude-mock');
    const client = fake([
      [{ type: 'tool_use', id: 't1', name: 'upcoming_dues', input: {} } as Anthropic.ToolUseBlock],
      [{ type: 'text', text: 'Your card bill of ₹36,343 is due on 24 October. Shall I set a reminder?', citations: null } as Anthropic.TextBlock],
    ]);
    const r = await runClaude([{ role: 'user', content: 'What is due?' }], { ds, sid: 'claude-mock', lang: 'en' }, client);
    expect(r.engine).toBe('claude'); expect(r.trace.map((t) => t.tool)).toEqual(['upcoming_dues']);
    expect(r.check).toMatchObject({ ok: true, checked: 1 });
  });
  it('an invented number triggers one repair round; if it persists, the reply is flagged', async () => {
    const ds = await demo();
    const bad = [{ type: 'text', text: 'Fixing this could save you ₹25,000 a year.', citations: null } as Anthropic.TextBlock];
    const client = fake([[{ type: 'tool_use', id: 't1', name: 'credit_health', input: {} } as Anthropic.ToolUseBlock], bad, bad]);
    const r = await runClaude([{ role: 'user', content: 'credit?' }], { ds, sid: 'claude-mock2', lang: 'en' }, client);
    expect(r.repaired).toBe(true); expect(r.check.ok).toBe(false); expect(r.check.unverified).toEqual(['₹25,000']);
  });
  it('the repair round fixes the answer before anyone hears it', async () => {
    const ds = await demo();
    const client = fake([
      [{ type: 'tool_use', id: 't1', name: 'credit_health', input: {} } as Anthropic.ToolUseBlock],
      [{ type: 'text', text: 'Your score is 768, worth ₹25,000.', citations: null } as Anthropic.TextBlock],
      [{ type: 'text', text: 'Your score is 768, down from 791.', citations: null } as Anthropic.TextBlock],
    ]);
    const r = await runClaude([{ role: 'user', content: 'credit?' }], { ds, sid: 'claude-mock4', lang: 'en' }, client);
    expect(r).toMatchObject({ repaired: true, answer: 'Your score is 768, down from 791.' }); expect(r.check.ok).toBe(true);
  });
  it('PII the user speaks is scrubbed before it reaches the model', async () => {
    const ds = await demo(); const sent: string[] = [];
    const client: LlmClient = { messages: { create: async (body) => { sent.push(JSON.stringify(body.messages)); return { id: 'm', type: 'message', role: 'assistant', model: 'x', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: 'ok', citations: null }], stop_reason: 'end_turn' } as unknown as Anthropic.Message; } } };
    await runClaude([{ role: 'user', content: 'Main Rohan hoon, PAN ABCPE1234F, phone 9876543210' }], { ds, sid: 'pii-in', lang: 'hi' }, client);
    for (const bad of ['ABCPE1234F', '9876543210', 'Rohan']) expect(sent[0]).not.toContain(bad);
  });
  it('action tool calls produce actions', async () => {
    const ds = await demo(); clearActions('claude-mock3');
    const client = fake([
      [{ type: 'tool_use', id: 't1', name: 'create_reminder', input: { title: 'कार्ड बिल', date: '2026-10-23' } } as Anthropic.ToolUseBlock],
      [{ type: 'text', text: 'रिमाइंडर 23 अक्टूबर के लिए लगा दिया।', citations: null } as Anthropic.TextBlock],
    ]);
    const r = await runClaude([{ role: 'user', content: 'हाँ' }], { ds, sid: 'claude-mock3', lang: 'hi' }, client);
    expect(r.actions.map((a) => a.kind)).toEqual(['reminder']);
  });
});

describe('offline reminders target the item the user named', () => {
  it('"remind me to pay the card bill" → the card bill, a day before it is due', async () => {
    const ds = await demo(); const sid = 'remind-card'; clearPending(sid); clearActions(sid);
    const r = await runOffline([{ role: 'user', content: 'Remind me to pay the card bill' }], { ds, sid, lang: 'en' });
    expect(r.actions[0].title).toMatch(/Credit card bill/); expect(r.actions[0].reminder!.date).toBe('2026-10-23');
  });
});

describe('offline: named merchants and direct draft requests', () => {
  it('"What about LingoPro?" then "Draft the refund request"', async () => {
    const ds = await demo(); const sid = 'lingo'; clearPending(sid); clearActions(sid);
    const a = await runOffline([{ role: 'user', content: 'What about LingoPro?' }], { ds, sid, lang: 'en' });
    expect(a.answer).toContain('₹4,999'); expect(a.answer).toContain('25 October');
    const b = await runOffline([{ role: 'user', content: 'Draft the refund request' }], { ds, sid, lang: 'en' });
    expect(b.actions[0].email!.to).toBe('billing@lingopro.example');
  });
});
