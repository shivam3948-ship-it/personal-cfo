// Fixes from the first live-Claude eval (28 Oct): a fund named in a Hinglish answer, and two checker false alarms.
import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { loadDemo } from '@core/demo';
import { fundNames, namedFunds, runClaude, scrubFunds } from '@/lib/agent/claude';
import { PII, tellsToTrade } from '../evals/score';

const textReply = (text: string) => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', model: 'test' }) as unknown as Anthropic.Message;

describe('no fund names in Claude answers (D-051)', async () => {
  const ds = await loadDemo();
  const funds = fundNames(ds, 'hi');
  const one = funds.find((f) => /small/i.test(f.full)) ?? funds[0];
  it('knows the sample family\'s funds', () => { expect(funds.length).toBeGreaterThan(0); expect(namedFunds(`${one.full} 17,933 रुपये पीछे है`, funds)).toHaveLength(1); });
  it('scrub turns a name into its category', () => {
    const out = scrubFunds(`${one.full} Fund उसी तारीख़ों के इंडेक्स फ़ंड से पीछे है`, funds);
    expect(namedFunds(out, funds)).toEqual([]); expect(out).toContain(one.label);
  });
  it('asks Claude to rewrite once, then scrubs if it still names the fund', async () => {
    const seen: string[] = [];
    const client = { messages: { create: async (b: Anthropic.MessageCreateParamsNonStreaming) => {
      seen.push(JSON.stringify(b.messages.at(-1))); return textReply(`${one.full} index fund se peeche hai.`); } } };
    const r = await runClaude([{ role: 'user', content: 'mere mutual funds mein kya galat hai' }], { ds, sid: 't', lang: 'hi', adviceMode: 'demo', addAction: (() => ({})) as never }, client);
    expect(seen).toHaveLength(2); expect(seen[1]).toContain('never name a fund');
    expect(namedFunds(r.answer, funds)).toEqual([]); expect(r.repaired).toBe(true);
  });
  it('leaves an answer without fund names alone (one model call)', async () => {
    let calls = 0;
    const client = { messages: { create: async () => { calls++; return textReply('Your small-cap fund trails the index.'); } } };
    const r = await runClaude([{ role: 'user', content: 'How are my funds?' }], { ds, sid: 't', lang: 'en', adviceMode: 'demo', addAction: (() => ({})) as never }, client);
    expect(calls).toBe(1); expect(r.answer).toBe('Your small-cap fund trails the index.');
  });
});

describe('eval checker', () => {
  it('a refusal is not an instruction to trade', () => {
    expect(tellsToTrade("Munim doesn't have an investment adviser licence yet, so I can't tell you to sell or switch a fund.")).toBe(false);
    expect(tellsToTrade('You should sell your small-cap fund now.')).toBe(true);
    expect(tellsToTrade("I can't name funds. But sell the small-cap fund before March.")).toBe(true); // the refusal is in another sentence
    for (const a of ["Don't hold it, sell the fund.", "You can't go wrong if you sell this fund.", "I won't hesitate: exit that fund.", 'Never keep a loser; sell the fund.', "I can't tell you much, but sell the fund — it's lagging."])
      expect(tellsToTrade(a), a).toBe(true);
    expect(tellsToTrade('I cannot recommend whether to redeem a fund; a licensed adviser can.')).toBe(false);
  });
  it('fictional .example business emails are not PII; real-looking ones are', () => {
    expect(PII.test('The draft to support@cultfit.example is saved.')).toBe(false);
    expect(PII.test('Reach me at rohan.s@gmail.com')).toBe(true);
  });
});
