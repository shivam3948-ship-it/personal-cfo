import { describe, expect, it } from 'vitest';
import { checkNumbers } from '@core/agent/guard';
import { holderNames, maskCounterparty, redact } from '@core/privacy/redact';
import { detectLang, forSpeech, parseAmountRupees } from '@core/agent/lang';

describe('number guard', () => {
  const results = [{ spend: '₹92,510', saving: '₹6,739', rate: '11.25%', months: 5, outstanding: '₹2,24,000' }];
  it('accepts figures that come from tool results, incl. lakh forms and small counts', () => {
    expect(checkNumbers('You spent ₹92,510; switching saves ₹6,739 at 11.25%, about 2.24 lakh left, 5 EMIs.', results).ok).toBe(true);
    expect(checkNumbers('आपने ₹92,510 खर्च किए, 11.25 प्रतिशत पर।', results).ok).toBe(true);
  });
  it('flags invented numbers', () => {
    const r = checkNumbers('You could save ₹15,000 a year.', results);
    expect(r.ok).toBe(false); expect(r.unverified).toEqual(['₹15,000']);
  });
  it('ignores years', () => { expect(checkNumbers('By 2027 you will be fine.', results).ok).toBe(true); });
});

describe('privacy', () => {
  it('redacts PAN, phone, email, account numbers, UPI handles and holder names', () => {
    const t = 'Name: Rohan Mehta PAN ABCPE1234F call 9876543210 mail rohan@gmail.com a/c 123456789012 upi rajesh.k@okaxis';
    const r = redact(t, { names: holderNames([t]) });
    for (const bad of ['ABCPE1234F', '9876543210', 'rohan@gmail.com', '123456789012', 'rajesh.k@okaxis', 'Rohan', 'Mehta']) expect(r).not.toContain(bad);
    expect(redact('write to billing@lingopro.example')).toContain('billing@lingopro.example'); // fictional business contacts stay
  });
  it('masks person-to-person counterparties', () => {
    expect(maskCounterparty('UPI/P2P/RAJESH KUMAR/rajesh.k@okaxis/House rent')).toContain('[PERSON]');
  });
});

describe('language helpers', () => {
  it('detects Hindi in Devanagari and Hinglish', () => {
    expect(detectLang('मेरा पैसा कहाँ जा रहा है?')).toBe('hi');
    expect(detectLang('mera paisa kahan ja raha hai')).toBe('hi');
    expect(detectLang('Where is my money going?')).toBe('en');
    expect(detectLang('anything', 'en')).toBe('en');
  });
  it('parses spoken amounts', () => {
    expect(parseAmountRupees('50 hazaar prepay')).toBe(50000);
    expect(parseAmountRupees('1.5 lakh')).toBe(150000);
    expect(parseAmountRupees('५० हज़ार')).toBe(50000);
    expect(parseAmountRupees('₹40,000')).toBe(40000);
    expect(parseAmountRupees('kya main loan jaldi chuka sakta hoon')).toBeNull();
  });
  it('makes text speakable', () => {
    expect(forSpeech('EMI ₹10,181 on 2026-10-20, rate 13.5%', 'en')).toBe('EMI 10,181 rupees on 20 October, rate 13.5 percent');
    expect(forSpeech('**₹12,601** बचेंगे', 'hi')).toBe('12,601 रुपये बचेंगे');
  });
});
