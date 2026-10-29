// Fixes from the independent review of the advice-config branch (D-066, 28 Oct): disclaimers, the trade guard, products the
// user doesn't hold, the relay's mode, the picks staying on the server.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { loadDemo } from '@core/demo';
import { tellsToExit, tellsToTrade, sentences } from '@/lib/agent/tradeWords';
import { enforceNoTrade, fundLabels } from '@/lib/agent/funds';
import { knownProducts, strangerProducts } from '@/lib/agent/brands';
import { guardAnswer, runClaude } from '@/lib/agent/claude';
import { DISCLAIMER, NO_PICK, NO_TRADE } from '@/lib/advice';

const textReply = (text: string) => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', model: 'test' }) as unknown as Anthropic.Message;

describe('B2: the Hindi disclaimer never claims registration', () => {
  for (const f of ['screens/Xray.jsx', 'screens/Invest.jsx']) it(f, () => {
    const src = readFileSync(f, 'utf8');
    const discHi = new Function(`${/var discHi = (function \(en\) \{[\s\S]*?\});/.exec(src)![0]}; return discHi;`)() as (en: string) => string;
    expect(discHi(DISCLAIMER.private.en)).toBe(DISCLAIMER.private.hi);
    expect(discHi(DISCLAIMER.private.en)).toMatch(/नहीं|न SEBI/);
    expect(discHi(DISCLAIMER.guided.en)).toMatch(/निवेश सलाह नहीं/);
  });
  it('the private line names both registrations Munim does not have', () => {
    expect(DISCLAIMER.private.en).toMatch(/not a SEBI-registered investment adviser or an AMFI-registered mutual fund distributor/);
  });
});

describe('B1: Ask on your own data shows the advice-mode line when advice is on', () => {
  it('AskLive asks the server, and uses the private line only on a yes', () => {
    const src = readFileSync('ui/AskLive.tsx', 'utf8');
    expect(src).toMatch(/if \(local\) \{[^\n]*fetch\('\/api\/advice'[^\n]*j\.advice === true\) setDisc\(\{ \.\.\.DISCLAIMER\.private/);
  });
});

describe('B3: the trade guard', () => {
  const yes = ['Sell Rs. 5,000 of the Axis Bluechip Fund.', 'Redeem ₹1.5 lakh from your small cap fund.', 'Move ₹20,000 out of your small cap fund into the FD.',
    'Shift your money from the ELSS fund to a liquid fund.', 'Stop your SIP in the mid cap fund.', 'Pause the SIP for now.', 'Ye fund chhod do.',
    'इस फंड से निकल जाइए।', 'SIP बंद कर दो।', 'You should sell your small-cap fund now.', 'Ye small cap fund switch kar lo.', 'Surrender the policy.'];
  const no = [NO_TRADE.en, NO_TRADE.hi, 'Move ₹5,000 from your emergency fund to clear the card.', 'Your small cap fund fell 4% this year.',
    "You don't need to sell any fund to build the buffer.", 'उसी फ़ंड का डायरेक्ट प्लान सस्ता होता है; बदलने का मतलब बेचना और फिर खरीदना, इसलिए टैक्स लगता है।',
    'For new money, a liquid fund is a common choice.', 'इमरजेंसी फंड से पैसे निकाल लो।',
    'LingoPro का पेड प्लान बन गया, बंद करें या रिफ़ंड माँगें।']; // रिफ़ंड holds फ़ंड: a refund, not a fund
  it('catches sell, switch, exit, move-out and stop, in English, Hindi and Hinglish', () => { for (const a of yes) expect(tellsToExit(a), a).toBe(true); });
  it('lets facts, refusals, savings pots and regular → direct through', () => { for (const a of no) expect(tellsToExit(a), a).toBe(false); });
  it('"Rs." and "₹1.5" no longer split a sentence', () => {
    expect(sentences('Pay Rs. 500 now. Then ₹1.5 lakh later. Done!')).toHaveLength(3);
    expect(tellsToTrade('Sell Rs. 5,000 of the Axis Bluechip Fund.')).toBe(true);
  });
  it('the window stops at the sentence end ("sell the car. Your fund…" is not a fund call)', () => {
    expect(tellsToExit('Sell the old bike first; your fund stays as it is.')).toBe(false);
  });
  it('the hard guard removes the instruction and says the no-licence line once', () => {
    expect(enforceNoTrade('Your small cap fund is worth ₹92,440. Sell your small cap fund before March.', [], 'en'))
      .toBe(`Your small cap fund is worth ₹92,440. ${NO_TRADE.en}`);
    expect(enforceNoTrade('Sell it all: redeem the fund.', [], 'en')).toBe(NO_TRADE.en);
  });
  it('runClaude: one repair round for a category-level exit, then the guard', async () => {
    const ds = await loadDemo(); const seen: string[] = [];
    const client = { messages: { create: async (b: Anthropic.MessageCreateParamsNonStreaming) => { seen.push(JSON.stringify(b.messages.at(-1))); return textReply('Redeem your small cap fund before March.'); } } };
    const r = await runClaude([{ role: 'user', content: 'Should I exit?' }], { ds, sid: 't', lang: 'en', adviceMode: 'guided', addAction: (() => ({})) as never }, client);
    expect(seen).toHaveLength(2); expect(seen[1]).toContain('tells the user to act on something they hold');
    expect(r.answer).toBe(NO_TRADE.en);
  });
});

describe('#4: products the user does not hold, and (advice mode) the owner has not picked', () => {
  const known = knownProducts([{ scheme: 'Axis Bluechip Fund - Direct Plan - Growth', amc: 'Axis Mutual Fund' }], [{ insurer: 'LIC', name: 'Jeevan Anand' }]);
  it('finds a fund or insurer named from memory', () => {
    expect(strangerProducts('Buy Parag Parikh Flexi Cap Fund for the long term.', known)).toEqual(['Parag Parikh Flexi Cap Fund']);
    expect(strangerProducts('Take a term plan from HDFC Life.', known)).toEqual(['HDFC Life']);
    expect(strangerProducts('Go with Star Health for your health cover.', known)).toEqual(['Star Health']); // an insurer counts where cover is recommended (review 2, N3)
  });
  it('leaves held products, banks and bills alone', () => {
    for (const a of ['Your Axis Bluechip Fund fell 3%.', 'Your Axis fund fell 3%.', 'Your LIC policy premium is due.', 'Pay your HDFC credit card bill.', 'Your SBI account balance is ₹4,000.', 'Your Tata Play plan renews on Friday.'])
      expect(strangerProducts(a, known), a).toEqual([]);
  });
  it('advice mode: a pick may be named, anything else goes', () => {
    const withPick = knownProducts([], [], ['Monsoon Liquid Fund']);
    expect(guardAnswer('Put the safety net in Monsoon Liquid Fund.', 'private', [], withPick, 'en')).toBe('Put the safety net in Monsoon Liquid Fund.');
    expect(guardAnswer('Buy Mirae Asset Large Cap Fund. It is cheap.', 'private', [], withPick, 'en')).toBe(`It is cheap. ${NO_PICK.en}`);
  });
  it('outside advice mode, a product from memory goes too', () => {
    expect(guardAnswer('A good pick is Quant Small Cap Fund.', 'guided', [], knownProducts([], []), 'en')).toMatch(/licence/);
  });
});

describe('#5: the phone follows the mode the server used', () => {
  it('the relay returns its mode, and the phone guards a guided answer', () => {
    expect(readFileSync('app/api/ask/relay/route.ts', 'utf8')).toMatch(/model: MODEL, mode[,}]/);
    expect(readFileSync('lib/local/askLocal.ts', 'utf8')).toMatch(/seen\.mode === 'guided' && adviceMode !== 'guided'\) r = \{ \.\.\.r, answer: guardAnswer\(r\.answer, 'guided'/);
  });
});

describe('#6 and #9: the key and the picks stay off the phone', () => {
  it('the unlock link uses #advice=, and ?advice= is removed without being used', () => {
    const src = readFileSync('ui/TestSwitches.tsx', 'utf8');
    expect(src).toMatch(/\/\(\?:\^#\|&\)advice=\(\[\^&\]\*\)\/\.exec\(location\.hash\)/); // the raw value after #, so a '+' in the key survives
    expect(src).not.toMatch(/advice = q\.get\('advice'\)/);
  });
  it('nothing the phone runs reaches the server picks, following imports all the way down (review 2, N10)', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (f === 'api' ? [] : walk(p)) : /\.(tsx?|jsx)$/.test(f) ? [p] : []; });
    const entries = [...walk('app'), ...walk('ui'), ...walk('screens'), ...walk('lib/local'), 'lib/agent/claude.ts', 'lib/agent/tools.ts'] // app/api is server code
      .filter((f) => f.startsWith('lib/') || f.startsWith('ui/') || f.startsWith('screens/') || /^app\/.*(page|layout)\.tsx$/.test(f) || /^['"]use client['"]/.test(readFileSync(f, 'utf8')));
    const resolve = (from: string, spec: string): string | null => {
      const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('@core/') ? join('../../packages/core/src', spec.slice(6)) : spec.startsWith('.') ? join(from, '..', spec) : null;
      if (!base) return null; // a package
      for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']) { try { if (statSync(base + ext).isFile()) return base + ext; } catch { /* next */ } }
      return null;
    };
    const seen = new Set<string>(), bad: string[] = [];
    const visit = (f: string, via: string) => {
      if (seen.has(f)) return; seen.add(f);
      if (/lib\/server\//.test(f)) { bad.push(`${via} → ${f}`); return; }
      for (const m of readFileSync(f, 'utf8').matchAll(/(?:^|\n)\s*(?:import|export)\s(?!type\s)[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const r = resolve(f, m[1] ?? m[2]); if (r) visit(r, f);
      }
    };
    for (const e of entries) visit(e, e);
    expect(seen.size).toBeGreaterThan(40); // the walk really walked
    expect(bad).toEqual([]);
  });
  it('/api/advice/picks is locked without the cookie', async () => {
    const { GET } = await import('@/app/api/advice/picks/route');
    expect((await GET(new Request('https://munim.test/api/advice/picks'))).status).toBe(403);
  });
});

describe('the guard keeps the demo family\'s own fund names as facts', async () => {
  const ds = await loadDemo(); const funds = fundLabels(ds.portfolio!.holdings, 'en');
  const known = knownProducts(ds.portfolio!.holdings, ds.policies);
  it('a fact about each holding passes untouched', () => {
    for (const h of ds.portfolio!.holdings) { const a = `${h.scheme} is worth less than last year.`; expect(guardAnswer(a, 'guided', funds, known, 'en'), a).toBe(a); }
  });
});
