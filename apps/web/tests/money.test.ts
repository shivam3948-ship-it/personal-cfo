import { describe, expect, it } from 'vitest';
import { groupIndian, inr, inrShort, parseMoney, pct } from '@/lib/money';
import { toIso, addMonths, findDate } from '@/lib/dates';

describe('money', () => {
  it('parses Indian money strings to paise', () => {
    expect(parseMoney('1,25,000.00')).toBe(12500000);
    expect(parseMoney('Rs 649')).toBe(64900);
    expect(parseMoney('INR 4,999.00')).toBe(499900);
    expect(parseMoney('₹17.70')).toBe(1770);
    expect(parseMoney('abc')).toBeNull();
  });
  it('formats with lakh/crore grouping', () => {
    expect(groupIndian(12345678)).toBe('1,23,45,678');
    expect(inr(12500000)).toBe('₹1,25,000');
    expect(inr(470830, 'auto')).toBe('₹4,708.30');
    expect(inr(-996393)).toBe('-₹9,964');
    expect(inrShort(14500000, 'en')).toBe('₹1.45 lakh');
    expect(inrShort(1000000000, 'hi')).toBe('₹1 करोड़');
    expect(pct(1, 3)).toBe(33.3);
  });
  it('parses document dates', () => {
    expect(toIso('05/07/2026')).toBe('2026-07-05');
    expect(toIso('05-Oct-26')).toBe('2026-10-05');
    expect(toIso('18 October 2026')).toBe('2026-10-18');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(findDate('cancel within 14 days (by 25 October 2026)')).toBe('2026-10-25');
  });
});
