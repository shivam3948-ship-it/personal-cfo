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
  it('a product the user named themselves may be discussed', () => {
    expect(strangerProducts('Star Health covers day-care procedures.', knownProducts([], [], [], ['Is Star Health any good?']))).toEqual([]);
  });
  it('a removed product gets a product-neutral line, not "can\'t name funds"', () => {
    expect(guardAnswer('Take a term plan from HDFC Life. Cover of ₹1 crore costs less at 30.', 'guided', funds, known, 'en')).toBe(`Cover of ₹1 crore costs less at 30. ${NO_PRODUCT.en}`);
  });
});
