// Fixes from the first live-Claude eval (28 Oct): a fund named in a Hinglish answer, and two checker false alarms.
import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { loadDemo } from '@core/demo';
import { runClaude } from '@/lib/agent/claude';
import { fundLabels, labelFor, namedFunds, scrubFunds } from '@/lib/agent/funds';
import { PII, tellsToTrade } from '../evals/score';
import { NO_TRADE } from '@/lib/advice';

const textReply = (text: string) => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', model: 'test' }) as unknown as Anthropic.Message;

describe('fund names: facts yes, trade instructions no (D-051, D-066)', async () => {
  const ds = await loadDemo();
  const funds = fundLabels(ds.portfolio!.holdings, 'en');
  const one = funds.find((f) => f.names.some((n) => /small/i.test(n))) ?? funds[0];
  const name = one.names[1]; // the short name, e.g. "Monsoon Small Cap Fund"
  it('a name stated as a fact stays', () => {
    const fact = `${name} is worth ₹92,440, ₹17,933 behind an index fund on the same dates.`;
    expect(namedFunds(fact, funds)).toEqual([]); expect(scrubFunds(fact, funds)).toBe(fact);
  });
  it('a name next to a sell instruction is caught and swapped, only in that sentence', () => {
    const a = `${name} is worth ₹92,440. Sell ${name} before March.`;
    expect(namedFunds(a, funds).length).toBeGreaterThan(0);
    expect(scrubFunds(a, funds)).toBe(`${name} is worth ₹92,440. Sell ${one.label} before March.`);
  });
  it('asks Claude to rewrite once, then scrubs if it still pairs a name with a trade', async () => {
    const seen: string[] = [];
    const client = { messages: { create: async (b: Anthropic.MessageCreateParamsNonStreaming) => { seen.push(JSON.stringify(b.messages.at(-1))); return textReply(`Sell ${name} now.`); } } };
    const r = await runClaude([{ role: 'user', content: 'What should I do with my funds?' }], { ds, sid: 't', lang: 'en', adviceMode: 'demo', addAction: (() => ({})) as never }, client);
    expect(seen).toHaveLength(2); expect(seen[1]).toContain('tells the user to act on something they hold');
    expect(r.answer).toBe(NO_TRADE.en); // the name is swapped, then the sell instruction itself goes (D-066 review, B3)
  });
  it('a factual answer with names costs one model call and is left alone', async () => {
    let calls = 0;
    const text = `${name} trails a plain index fund on the same dates.`; // no figures: the number check isn't what's tested here
    const client = { messages: { create: async () => { calls++; return textReply(text); } } };
    const r = await runClaude([{ role: 'user', content: 'How are my funds?' }], { ds, sid: 't', lang: 'en', adviceMode: 'demo', addAction: (() => ({})) as never }, client);
    expect(calls).toBe(1); expect(r.answer).toBe(text);
  });
  it('advice mode: names may go with instructions (no guard)', async () => {
    const client = { messages: { create: async () => textReply(`Sell ${name} before March. Private test.`) } };
    const r = await runClaude([{ role: 'user', content: 'What should I sell?' }], { ds, sid: 't', lang: 'en', adviceMode: 'private', addAction: (() => ({})) as never }, client);
    expect(r.answer).toContain(name);
  });
});

describe('fund names: edge cases from the review (in trade sentences)', () => {
  const H = (scheme: string, category: string, amc: string) => ({ scheme, category, amc }) as never;
  const funds = fundLabels([H('Parag Parikh Flexi Cap Fund - Direct Plan - Growth', 'Flexi cap', 'PPFAS'), H('Parag Parikh ELSS Tax Saver Fund - Direct Plan - Growth', 'ELSS', 'PPFAS'), H('ICICI Prudential Bluechip Fund - Regular Plan - Growth', 'Large cap', 'ICICI Prudential')], 'en');
  it('two funds sharing their first two words: each gets its own label', () => {
    expect(scrubFunds('Sell Parag Parikh ELSS Tax Saver Fund and switch Parag Parikh Flexi Cap Fund - Direct Plan - Growth to an index fund.', funds))
      .toBe('Sell your ELSS fund and switch your flexi cap fund to an index fund.');
  });
  it('a fund house name alone is not a fund, and articles read right', () => {
    expect(scrubFunds('Surrender the ICICI Prudential Life policy? No.', funds)).toBe('Surrender the ICICI Prudential Life policy? No.');
    expect(scrubFunds('Exit the ICICI Prudential Bluechip Fund now.', funds)).toBe('Exit your large cap fund now.');
  });
  it('labels for tool results', () => { expect(labelFor(funds)('Parag Parikh ELSS Tax Saver Fund')).toBe('your ELSS fund'); });
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
    for (const a of ['I can\'t tell you what to do, so just sell the fund.', "I can't say this strongly enough, sell the fund.", "I can't recommend it enough: redeem the fund.",
      'मैं सलाह नहीं दे सकता, पर यह फ़ंड बेच दो।', 'License nahi hai, par fund bech do.', 'यह फ़ंड बेचना चाहिए।', 'Ye fund bechna chahiye.', 'Is fund se exit kar lo.'])
      expect(tellsToTrade(a), a).toBe(true);
    expect(tellsToTrade("You don't need to sell any fund to build the buffer.")).toBe(false);
    expect(tellsToTrade('उसी फ़ंड का डायरेक्ट प्लान सस्ता होता है; बदलने का मतलब बेचना और फिर खरीदना, इसलिए टैक्स लगता है।')).toBe(false);
    expect(tellsToTrade('Ye small cap fund switch kar lo.')).toBe(true);
  });
  it('fictional .example business emails are not PII; real-looking ones are', () => {
    expect(PII.test('The draft to support@cultfit.example is saved.')).toBe(false);
    expect(PII.test('Reach me at rohan.s@gmail.com')).toBe(true);
    expect(PII.test('rohan@mail.example.org')).toBe(true);
  });
});
