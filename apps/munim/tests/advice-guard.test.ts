// The answer guard against an independent list (D-066, review 2). The eval reuses the guard's own check, so it can't catch
// what the check misses; these sentences were written by hand from two reviews: real instructions that must be removed, and
// real money-path advice that must survive. Add every new miss here first.
import { describe, expect, it } from 'vitest';
import { loadDemo } from '@core/demo';
import { tellsToExit } from '@/lib/agent/tradeWords';
import { fundLabels, heldNames } from '@/lib/agent/funds';
import { knownProducts, strangerProducts } from '@/lib/agent/brands';
import { guardAnswer, userAllowsAction } from '@/lib/agent/claude';
import { NO_PRODUCT, NO_TRADE } from '@/lib/advice';
import { ADVICE_THAT_STAYS, INSTRUCTIONS } from '../evals/guardGolden';

describe('the guard on the sample family', async () => {
  const ds = await loadDemo();
  const funds = fundLabels(ds.portfolio!.holdings, 'en'), held = heldNames(funds);
  const known = knownProducts(ds.portfolio!.holdings, ds.policies);

  it('removes every instruction', () => { for (const a of INSTRUCTIONS) expect(tellsToExit(a, held), a).toBe(true); });
  it('keeps every piece of money-path advice and every fact', () => { for (const a of ADVICE_THAT_STAYS) expect(tellsToExit(a, held), a).toBe(false); });
  it('the hard guard removes only the instruction', () => {
    expect(guardAnswer('Your safety net is short by ₹40,000. Move ₹40,000 from your savings account into a liquid fund.', 'guided', funds, known, 'en'))
      .toBe('Your safety net is short by ₹40,000. Move ₹40,000 from your savings account into a liquid fund.');
    expect(guardAnswer('Monsoon Small Cap Fund is worth ₹92,440. Consider selling Monsoon Small Cap Fund before March.', 'guided', funds, known, 'en'))
      .toBe(`Monsoon Small Cap Fund is worth ₹92,440. ${NO_TRADE.en}`);
  });

  const BANKS_AND_OWN_COVER = ['Clear the SBI Card debt first.', 'Your HDFC Credit Card debt is ₹48,000.', 'Pay off the Union Bank debt before investing.',
    'The Bajaj Finserv EMI Card debt costs you the most.', 'Your Tata Nexon value has dropped.', 'Axis Bank Index of rates went up.',
    'Your LIC premium of ₹12,000 is due on Friday.', 'Ask LIC for the surrender value.', 'That ₹12,000 to ICICI Lombard is your car insurance renewal.',
    'Your Acko car insurance renews next month.', 'Your Star Health policy covers ₹5 lakh.', 'Pay your HDFC credit card bill.', 'Your SBI account balance is ₹4,000.',
    'Your Tata Play plan renews on Friday.'];
  const PRODUCTS_FROM_MEMORY = [['Buy Parag Parikh Flexi Cap Fund for the long term.', 'Parag Parikh Flexi Cap Fund'], ['Mirae Asset Large Cap Fund is a good pick.', 'Mirae Asset Large Cap Fund'],
    ['Take a term plan from HDFC Life.', 'HDFC Life'], ['Buy a Star Health family floater.', 'Star Health'], ['Jio BlackRock Flexi Cap is new.', 'Jio BlackRock Flexi Cap']] as const;
  it('banks, cards, loans and the user\'s own cover are not products from memory', () => { for (const a of BANKS_AND_OWN_COVER) expect(strangerProducts(a, known), a).toEqual([]); });
  it('a fund or insurer named from memory is', () => { for (const [a, name] of PRODUCTS_FROM_MEMORY) expect(strangerProducts(a, known), a).toEqual([name]); });
  it('a fund from a house not on the list is caught where it is recommended (injection review)', () => {
    expect(strangerProducts('You could move that money into QuickRich Growth Fund.', known)).toEqual(['QuickRich Growth Fund']);
    expect(strangerProducts('Consider SuperShield Plus Plan for your health cover.', known)).toEqual(['SuperShield Plus Plan']); // a Plan counts where cover is the topic (review 7)
    expect(strangerProducts('Switch to the Netflix Basic Plan to save ₹300 a month.', known)).toEqual([]);
    for (const a of ['Put the bonus in a Liquid Fund for the safety net.', 'An Index Fund is a good choice for new money.', 'Your Monsoon Small Cap Fund fell 4%.', 'QuickRich Growth Fund appeared on your statement.'])
      expect(strangerProducts(a, known), a).toEqual([]);
  });
  it('a product the user named may be discussed as a fact, never recommended back (review 3)', () => {
    const asked = (q: string, picks: string[] = []) => knownProducts(ds.portfolio!.holdings, ds.policies, picks, [q]);
    expect(strangerProducts('Star Health covers day-care procedures.', asked('Is Star Health any good?'))).toEqual([]);
    expect(strangerProducts('Parag Parikh Flexi Cap Fund has a 5-year lock-in? No, only ELSS funds do.', asked('Does Parag Parikh Flexi Cap Fund have a lock-in?'))).toEqual([]);
    expect(strangerProducts('Yes, buy Parag Parikh Flexi Cap Fund for the long term.', asked('Should I buy Parag Parikh Flexi Cap Fund?'))).toEqual(['Parag Parikh Flexi Cap Fund']);
    expect(strangerProducts('Yes, buy Quant Small Cap Fund.', asked('Should I buy Quant Small Cap Fund?', ['Monsoon Liquid Fund']))).toEqual(['Quant Small Cap Fund']); // private: only picks
    expect(strangerProducts('Yes, go with Star Health for your family.', asked('Star Health or Niva Bupa?'))).toEqual(['Star Health']);
  });
  it('an insurer with a plan name counts whatever the verb; "your" plan is the user\'s own (review 3)', () => {
    for (const [a, name] of [['HDFC Life Click 2 Protect is a good term plan.', 'HDFC Life Click 2 Protect'], ['Star Health is the best option for your parents.', 'Star Health'],
      ['ICICI Prudential Life iProtect Smart is a good term plan.', 'ICICI Prudential Life'], ['Consider HDFC Life Click 2 Protect for term cover; the premium is low.', 'HDFC Life Click 2 Protect']] as const)
      expect(strangerProducts(a, known), a).toEqual([name]);
    for (const a of ['Your LIC Jeevan Anand premium is due on Friday.', 'Aapki LIC Jeevan Anand policy ka premium ₹12,000 hai.'])
      expect(strangerProducts(a, known), a).toEqual([]);
  });
  it('a removed product gets a product-neutral line, not "can\'t name funds"', () => {
    expect(guardAnswer('Take a term plan from HDFC Life. Cover of ₹1 crore costs less at 30.', 'guided', funds, known, 'en')).toBe(`Cover of ₹1 crore costs less at 30. ${NO_PRODUCT.en}`);
  });
});

describe('the action guard (review 7)', () => {
  const offer = 'Your card bill is ₹36,343 on 24 October. Shall I set a reminder?';
  it('a yes to an offer, in the words people use', () => {
    for (const y of ['yes', 'haan', 'thik hai', 'theek hai', 'ज़रूर', 'जरूर', 'अच्छा', 'Zaroor', 'Acha', 'Sahi hai', 'Chalega', 'kar lo', 'हो जाए', 'Haa', 'Sounds good', 'Go for it', 'Yep', 'Of course', 'Absolutely', 'Do that', 'okk', '👍', 'हाँ कर दो', 'ठीक है', 'OK'])
      expect(userAllowsAction(y, offer), y).toBe(true);
  });
  it('a no, or no offer, runs nothing; an outright ask always does', () => {
    for (const n of ['no', 'nahi', 'not now', 'baad mein', 'रहने दो', 'मत करो']) expect(userAllowsAction(n, offer), n).toBe(false);
    expect(userAllowsAction('How much did I save last month?', 'Your spend fell.')).toBe(false);
    expect(userAllowsAction('ok', 'Your spend fell.')).toBe(false);
    expect(userAllowsAction('Remind me to pay my card bill on 30 Oct', '')).toBe(true);
    expect(userAllowsAction('haan, plan save kar do', 'Want me to save this plan?')).toBe(true);
  });
});
