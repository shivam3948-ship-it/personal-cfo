import { describe, expect, it } from 'vitest';
import { forLlm, cleanString } from '../src/privacy/forLlm';

// D-050 (option A): only tool results leave the phone, and only after this filter.
describe('forLlm: what may reach the AI', () => {
  it('keeps computed figures and plain labels', () => {
    const r = { month: 'September', total: '₹92,510', categories: [{ category: 'Food delivery', amount: '₹5,241', merchants: ['Swiggy', 'Zomato'] }], rate: '9.5%', ends: '2029-03-05', last4: '••4521' };
    expect(forLlm(r)).toEqual(r);
  });
  it('turns bank descriptors and UPI handles into a neutral label (payee names live there)', () => {
    expect(cleanString('UPI-RAHUL KUMAR-rahul.k@okaxis-HDFC0001234-512345678901-PAYMENT')).toBe('a UPI payment');
    expect(cleanString('UPI/DR/612345678901/ASHA SHARMA/SBIN/asha@ybl/UPI')).toBe('a UPI payment');
    expect(cleanString('NEFT CR-EXAMPLE EMPLOYER-N123456')).toBe('a bank transfer');
    expect(cleanString('pay to someone@paytm')).toBe('a UPI payment');
  });
  it('removes identifiers anywhere in a string', () => {
    expect(cleanString('PAN ABCPE1234F, card 4111 1111 1111 1111, acct 50100012345678, mail a.b@gmail.com, call 9876543210'))
      .toBe('PAN [PAN], card [CARD], acct [NUMBER], mail [EMAIL], call [PHONE]');
    expect(cleanString('Paid by Asha Verma', ['Asha Verma'])).toBe('Paid by [NAME]');
  });
  it('drops file and raw-row keys, and caps long lists', () => {
    const r = forLlm({ items: Array.from({ length: 80 }, (_, i) => ({ amount: `₹${i}`, evidence: ['stmt.pdf#3'], source_file: 'hdfc_aug.pdf', desc: 'UPI-X' })) });
    expect(r.items).toHaveLength(30);
    expect(JSON.stringify(r)).not.toMatch(/evidence|source_file|desc|stmt\.pdf|hdfc_aug/);
  });
});
