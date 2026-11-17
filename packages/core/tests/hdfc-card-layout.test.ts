import { describe, it, expect } from 'vitest';
import { detectFormat, readBank, deglue } from '../src/ingest/banks';
import { emptyDataset } from '../src/types';
import { finalise } from '../src/ingest/finalise';
import { cardBills } from '../src/finance/cards';

// D-092: the owner's real HDFC card statement (Oct 2026), rebuilt with made-up rows. Its PDF splits the summary headings over
// lines, prints the limits a few lines under them, runs words together and tags EMI-eligible purchases with a leading "EMI".
const LINES = [
  'Example Bank Credit Card Statement', 'Credit Card No. 412345XXXXXX8747', 'Statement Date 16 Oct, 2026', 'Billing Period 17 Sep, 2026 - 16 Oct, 2026',
  'PREVIOUS STATEMENT DUES PAYMENTS/CREDITS PURCHASES/DEBIT FINANCE CHARGES TOTAL AMOUNT DUE', '_',
  'C10,000.00 C10,100.00 + C12,094.00 + C0.00 = C11,994.00',
  'TOTAL CREDIT LIMIT', 'AVAILABLE CREDIT LIMIT AVAILABLE CASH LIMIT MINIMUM DUE DUE DATE', '(Including Cash)',
  'C600.00 05 Nov, 2026', 'C5,00,000 C4,88,006 C2,00,000',
  'Past Dues OVER LIMIT 3 MONTHS + 2 MONTHS 1 MONTH CURRENT DUES MINIMUM DUES',
  'Domestic Transactions', 'DATE & TIME TRANSACTION DESCRIPTION AMOUNT PI',
  '18/09/2026| 20:15 SWIGGY FOODBANGALORE C 650.00 l',
  '19/09/2026| 09:10 Swiggy InstamartBENGALURU C 899.00 l',
  '24/09/2026| 15:36 EMI PYU*NIKEMumbai C 9,995.00 l',
  '25/09/2026| 11:00 NETFLIXMUMBAI C 550.00 l',
  '05/10/2026| 10:00 CREDIT CARD PAYMENTNet Banking (Ref# ST123) + C 10,000.00 l',
  '06/10/2026| 18:00 10% Swiggy CashBack + C 100.00 l',
];

describe('HDFC card in its real layout (D-092)', () => {
  const r = readBank(LINES, 'hdfc.pdf')!;
  it('reads the format, the limits and every check', () => {
    expect(detectFormat(LINES)).toBe('hdfc_card');
    expect(r.stmt).toMatchObject({ limit: 50000000, available: 48800600, totalDue: 1199400, minDue: 60000, dueDate: '2026-11-05' });
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });
  it('a squashed "CREDIT CARD PAYMENTNet Banking" is the bill payment, not income; EMI-eligible is a purchase, not a loan', () => {
    const ds = { ...emptyDataset(), accounts: [r.account], cardStatements: [r.stmt!], txns: r.txns }; finalise(ds);
    const cat = (re: RegExp) => ds.txns.find((t) => re.test(t.desc))!.category;
    expect(cat(/CREDIT CARD PAYMENT Net Banking/)).toBe('Card bill payment');
    expect(cat(/NIKE/)).toBe('Shopping');
    expect(cat(/Instamart/)).toBe('Quick commerce');
    expect(cat(/SWIGGY FOOD/)).toBe('Food delivery');
    expect(cat(/NETFLIX MUMBAI/)).toBe('Subscriptions');
    expect(ds.txns.some((t) => t.category === 'Loan EMI' || t.category === 'Other income')).toBe(false);
    expect(cardBills(ds, '2026-10-16')[0].usedPct).toBe(2.4);
  });
  it('unglues words but keeps a real EMI instalment line', () => {
    expect(deglue('EMI PYU*NIKEMumbai')).toBe('PYU*NIKE Mumbai');
    expect(deglue('SwiggyBENGALURU')).toBe('Swiggy BENGALURU');
    expect(deglue('EMI 3/12 SMARTEMI PRINCIPAL')).toBe('EMI 3/12 SMARTEMI PRINCIPAL');
  });
});
