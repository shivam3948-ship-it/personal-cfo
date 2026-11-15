import { describe, it, expect } from 'vitest';
import { tellsToExit } from '@/lib/agent/tradeWords';

// D-107 review: a verdict to keep a holding is advice too
const held = ['Monsoon Small Cap Fund', 'Monsoon Small Cap'];
describe('hold calls on a holding are caught (D-107)', () => {
  it.each([
    'Keep your small cap fund.',
    'Stay invested in your small cap fund.',
    'Your small cap fund is down. Ride it out.',
    'Continue your SIP in the small cap fund.',
    'स्मॉल कैप फंड मत बेचिए, बने रहिए।',
    'स्मॉल कैप फंड रखे रहें।',
    'Monsoon Small Cap ko hold karo.',
  ])('%s', (a) => expect(tellsToExit(a, held)).toBe(true));
  it.each([
    'Whether to stay invested depends on when you need this money.',
    'The choice to keep or sell your small cap fund is yours.',
    'Don\'t stop your SIP just because the market fell.',
    'Don\'t redeem your funds just because the market fell this week.', // advice not to act in a panic: allowed (guard golden set)
    'Keep your safety net in a savings account.',
    'Your small cap fund is worth ₹92,440 against ₹1,10,373 in a plain index fund on the same dates.',
    'अगर पैसा 5 साल बाद चाहिए तो फ़ैसला आपका है।',
    'Keep track of your card bill.',
    'Keep your safety net in a liquid fund or a sweep-in FD.', // red team fa-safetynet
    'Keep the money you need within 3 years in a liquid fund.',
  ])('not a verdict: %s', (a) => expect(tellsToExit(a, held)).toBe(false));
});
