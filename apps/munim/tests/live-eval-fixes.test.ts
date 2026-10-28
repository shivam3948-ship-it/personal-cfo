// Fixes from the first live-Claude eval (28 Oct): a fund named in a Hinglish answer, and two checker false alarms.
import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { loadDemo } from '@core/demo';
import { runClaude } from '@/lib/agent/claude';
import { fundLabels, labelFor, namedFunds, scrubFunds } from '@/lib/agent/funds';
import { PII, tellsToTrade } from '../evals/score';

const textReply = (text: string) => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', model: 'test' }) as unknown as Anthropic.Message;

describe('no fund names in Claude answers (D-051)', async () => {
  const ds = await loadDemo();
  const funds = fundLabels(ds.portfolio!.holdings, 'hi');
  const one = funds.find((f) => f.names.some((n) => /small/i.test(n))) ?? funds[0];
  const name = one.names[1]; // the short name, e.g. "Monsoon Small Cap Fund"
  it('knows the sample family\'s funds', () => { expect(funds.length).toBeGreaterThan(0); expect(namedFunds(`${name} 17,933 रुपये पीछे है`, funds).length).toBeGreaterThan(0); });
  it('scrub turns a name into its category', () => {
    const out = scrubFunds(`${name} उसी तारीख़ों के इंडेक्स फ़ंड से पीछे है`, funds);
    expect(namedFunds(out, funds)).toEqual([]); expect(out).toContain(one.label);
  });
  it('asks Claude to rewrite once, then scrubs if it still names the fund', async () => {
    const seen: string[] = [];
    const client = { messages: { create: async (b: Anthropic.MessageCreateParamsNonStreaming) => {
      seen.push(JSON.stringify(b.messages.at(-1))); return textReply(`${name} index fund se peeche hai.`); } } };
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

describe('fund names: edge cases from the review', () => {
  const H = (scheme: string, category: string, amc: string) => ({ scheme, category, amc }) as never;
  const funds = fundLabels([H('Parag Parikh Flexi Cap Fund - Direct Plan - Growth', 'Flexi cap', 'PPFAS'), H('Parag Parikh ELSS Tax Saver Fund - Direct Plan - Growth', 'ELSS', 'PPFAS'), H('ICICI Prudential Bluechip Fund - Regular Plan - Growth', 'Large cap', 'ICICI Prudential')], 'en');
  it('two funds sharing their first two words: each gets its own label, nothing left over', () => {
    const out = scrubFunds('Parag Parikh ELSS Tax Saver Fund is out of lock-in; Parag Parikh Flexi Cap Fund - Direct Plan - Growth is fine.', funds);
    expect(out).toBe('your ELSS fund is out of lock-in; your flexi cap fund is fine.');
  });
  it('a fund house name alone is not a fund (no false positive), and articles read right', () => {
    expect(scrubFunds('Your ICICI Prudential Life policy renews in March.', funds)).toBe('Your ICICI Prudential Life policy renews in March.');
    expect(scrubFunds('The ICICI Prudential Bluechip Fund lags.', funds)).toBe('Your large cap fund lags.');
  });
  it('tool results get labels, so Claude never sees the names', () => {
    expect(labelFor(funds)('Parag Parikh ELSS Tax Saver Fund')).toBe('your ELSS fund');
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
    for (const a of ["Don't wait, redeem the small cap fund now.", "I can't name funds\n- Sell the small cap fund", 'Switch to an index fund.', 'Ye fund bech do.', 'Small cap fund nikal lo.', 'फ़ंड बेच दो।', 'नहीं रखना, फ़ंड बेच दो।'])
      expect(tellsToTrade(a), a).toBe(true);
    expect(tellsToTrade('मैं यह नहीं बता सकता कि कौन सा फ़ंड बेचें।')).toBe(false);
    expect(tellsToTrade('उसी फ़ंड का डायरेक्ट प्लान सस्ता होता है; बदलने का मतलब बेचना और फिर खरीदना, इसलिए टैक्स लगता है।')).toBe(false);
    expect(tellsToTrade('Ye small cap fund switch kar lo.')).toBe(true);
  });
  it('fictional .example business emails are not PII; real-looking ones are', () => {
    expect(PII.test('The draft to support@cultfit.example is saved.')).toBe(false);
    expect(PII.test('Reach me at rohan.s@gmail.com')).toBe(true);
    expect(PII.test('rohan@mail.example.org')).toBe(true);
  });
});
