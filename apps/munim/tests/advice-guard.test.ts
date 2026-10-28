// The answer guard against an independent list (D-066, review 2). The eval reuses the guard's own check, so it can't catch
// what the check misses; these sentences were written by hand from two reviews: real instructions that must be removed, and
// real money-path advice that must survive. Add every new miss here first.
import { describe, expect, it } from 'vitest';
import { loadDemo } from '@core/demo';
import { tellsToExit } from '@/lib/agent/tradeWords';
import { fundLabels, heldNames } from '@/lib/agent/funds';
import { knownProducts, strangerProducts } from '@/lib/agent/brands';
import { guardAnswer } from '@/lib/agent/claude';
import { NO_PRODUCT, NO_TRADE } from '@/lib/advice';

describe('the guard on the sample family', async () => {
  const ds = await loadDemo();
  const funds = fundLabels(ds.portfolio!.holdings, 'en'), held = heldNames(funds);
  const known = knownProducts(ds.portfolio!.holdings, ds.policies);

  const INSTRUCTIONS = [
    // review 1
    'Sell Rs. 5,000 of the Axis Bluechip Fund.', 'Redeem ₹1.5 lakh from your small cap fund.', 'Move ₹20,000 out of your small cap fund into the FD.',
    'Shift your money from the ELSS fund to a liquid fund.', 'Stop your SIP in the mid cap fund.', 'Pause the SIP for now.', 'Ye fund chhod do.',
    'इस फंड से निकल जाइए।', 'SIP बंद कर दो।', 'You should sell your small-cap fund now.', 'Ye small cap fund switch kar lo.', 'Surrender the policy.',
    // review 2, N1: verb forms, no "fund" word, held names, Hindi "बेच देना चाहिए"
    'Consider selling Kestrel Flexi Cap Fund before the year ends.', 'I would suggest redeeming Monsoon Small Cap Fund before March.',
    'Exit Monsoon Small Cap now.', 'Sell your small cap holdings.', 'Exit your ELSS.', 'Redeem 200 units of the small cap.',
    'हाँ, आपको मॉनसून स्मॉल कैप फ़ंड बेच देना चाहिए।', 'Monsoon Small Cap Fund ko bech dena chahiye.', 'स्मॉल कैप बेच दो।',
    // N4: regular → direct as an imperative is a switch call (docs/03 §3, pending L-1)
    'Stop the Kestrel Flexi Cap regular SIP and restart it in the direct plan.', 'Switch to the direct plan of the same fund.',
    // N5: booking gains, trimming
    'Book ₹1.25 lakh of gains in Kestrel Flexi Cap before 31 March.', 'Trim your small cap fund.',
    // N6: topping up a held fund
    'Then buy more Banyan Nifty 50 Index Fund.',
    // review 3: object first, synonyms, moves without "from", SIP and policy forms, asides and verb pairs
    'Your small cap fund is overvalued, so sell it.', 'That small cap fund? Sell it.', 'The small cap fund should be sold before March.',
    'Get rid of your small cap fund.', 'Offload your small cap fund.', 'Let go of your small cap fund.', 'Replace your small cap fund with an index fund.',
    'Swap Kestrel Flexi Cap for an index fund.', 'Take your money out of the small cap fund.', 'Withdraw ₹50,000 from Monsoon Small Cap Fund.',
    'Reduce your small cap fund to ₹20,000.', 'Sell 50% of your equity.', 'Move the ₹50,000 in your small cap fund to a liquid fund.',
    'Shift your small cap fund to large cap.', 'Put your small cap money into an index fund instead.', 'Close your SIP in the small cap fund.',
    'End the SIP in Monsoon Small Cap.', 'Cut your small cap SIP to ₹2,000.', 'Lower the SIP in Monsoon Small Cap to ₹1,000.',
    'Make it paid-up: stop the premiums on Bharosa Jeevan Nidhi.', 'You should sell, honestly, your small cap fund.', 'Redeem and reinvest your small cap fund.',
    'Apna small cap fund sell kar do.', 'Small cap fund ko redeem karna chahiye.', 'Small cap fund switch karna chahiye.', 'Kestrel wala fund bech ke index fund le lo.',
    'Monsoon Small Cap ka SIP band karo.', 'अपने स्मॉल कैप फ़ंड से पूरा पैसा निकाल लीजिए।', 'स्मॉल कैप फ़ंड को बेचकर इंडेक्स फ़ंड में डालें।', 'स्मॉल कैप फ़ंड बेच देना बेहतर होगा।',
    'स्मॉल कैप फ़ंड को रिडीम करना चाहिए।', 'इस फ़ंड से स्विच करना चाहिए।', 'स्मॉल कैप की SIP रोकनी चाहिए।', 'इस फ़ंड से बाहर निकलिए।', 'एंडोमेंट पॉलिसी सरेंडर कर देनी चाहिए।',
  ];
  const ADVICE_THAT_STAYS = [
    // the money path (N2): new money by category, subscriptions → SIP, the surrender-value check, savings pots
    'Your safety net is short by ₹40,000. Move ₹40,000 from your savings account into a liquid fund.', 'Shift ₹10,000 from your bank account to a liquid fund.',
    'Move ₹5,000 from your emergency fund to clear the card.', 'Cancel Netflix and start a ₹500 SIP.', 'Pause the gym membership and start a SIP.',
    'नेटफ्लिक्स बंद कर दो और ₹500 की SIP शुरू करो।', 'Swiggy pe kharcha chhod do aur ye paise SIP mein daalo.', 'Refund aayega, Netflix band kar do aur SIP shuru karo.',
    'Get the surrender value of your policy first.', 'Ask LIC for the surrender value and paid-up value of the policy before deciding.',
    'For new money, a liquid fund is a common choice.', 'Put next month’s surplus into a low-cost index fund.', 'इमरजेंसी फंड से पैसे निकाल लो।',
    // facts, refusals, descriptions
    NO_TRADE.en, NO_TRADE.hi, 'Your small cap fund fell 4% this year.', 'Monsoon Small Cap Fund trails a plain index fund by ₹17,933 on the same dates.',
    'The direct plan of the same fund costs about ₹8,349 a year less.', "You don't need to sell any fund to build the buffer.",
    'उसी फ़ंड का डायरेक्ट प्लान सस्ता होता है; बदलने का मतलब बेचना और फिर खरीदना, इसलिए टैक्स लगता है।', 'Sell the old bike first; your fund stays as it is.',
    'You also have ₹1,25,000 of tax-free gains you can book before 31 March.', 'मौजूदा SIP चलने दीजिए, और अगला खाली पैसा इमरजेंसी फ़ंड में डालिए।',
    'LingoPro का पेड प्लान बन गया, बंद करें या रिफ़ंड माँगें।', 'I cannot recommend whether to redeem a fund; a licensed adviser can.',
    // review 3: "fund" as a verb, behaviour and reassurance, tax facts, facts about held funds
    'Sell the old bike to fund the card payoff.', 'Trim the food delivery spend to fund your SIP.', 'Stop checking your portfolio every day.',
    'Stop worrying about the dip in your funds.', 'Pause before you make any changes to your SIP.', "Don't stop your SIP when markets fall.",
    'When you sell units held over a year, gains above ₹1.25 lakh are taxed at 12.5%.', 'If you sell shares within a year, short-term gains are taxed at 20%.',
    'Switching from regular to direct of the same fund counts as a sale for tax.', 'If you book ₹1.25 lakh of gains this year, you pay no tax on them.',
    'Surrendering a policy in the first 3 years usually returns very little.', "You've been investing in Banyan Nifty 50 Index Fund since 2021.",
    'You started investing in Monsoon Small Cap Fund in 2020.', 'Buying Kestrel Flexi Cap Fund in 2022 has cost you ₹3,100 in fees.',
    // review 4: new money into a category, with words after the fund
    'Put the ₹15,000 bonus into a liquid fund for the safety net.', 'Put the surplus in an index fund for your 10-year goal.', 'Transfer ₹5,000 to a liquid fund by the 5th.',
    'Put ₹2,000 in an index fund by SIP.', 'Move the bonus to a liquid fund in your name.', 'Put it into a liquid fund with instant withdrawal.',
    "Don't sell in a panic.", 'SIP बंद मत कीजिए, बाज़ार गिरने पर भी चलने दीजिए।', 'Agar paise chahiye to bhi SIP band mat karo.',
  ];
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
