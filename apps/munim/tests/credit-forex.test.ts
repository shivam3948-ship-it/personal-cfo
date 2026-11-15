import { describe, it, expect } from 'vitest';
import { emptyDataset, type Dataset } from '@core/types';
import { finalise } from '@core/ingest/finalise';
import { cardForex } from '@core/finance/forex';
import { buildCredit } from '@/lib/views/credit';

// D-096: the Credit tab's mark-up line shows the engine's figure, on a small month shaped like the primary user's card use.
const ds = (label: string): Dataset => {
  const d = { ...emptyDataset(), accounts: [{ id: 'card:1234', kind: 'card' as const, label, last4: '1234' }],
    cardStatements: [{ account: 'card:1234', file: 'c.pdf', periodStart: '2026-09-19', periodEnd: '2026-10-18', dueDate: '2026-11-05', prevBalance: 0, payments: 0, purchases: 225430, credits: 0, charges: 0, totalDue: 225430, minDue: 18000 }],
    txns: [
      { id: 'a', date: '2026-09-20', desc: 'EXAMPLE AI SUB', amount: 100000, dir: 'debit' as const, account: 'card:1234', source: 'card_statement' as const, sourceFile: 'c.pdf', fx: { currency: 'USD', minor: 1000 } },
      { id: 'b', date: '2026-09-26', desc: 'KIRANA STORE', amount: 125430, dir: 'debit' as const, account: 'card:1234', source: 'card_statement' as const, sourceFile: 'c.pdf' },
    ] };
  finalise(d); return d;
};

describe('Credit tab: foreign-currency spend and the hidden mark-up', () => {
  it('shows the engine’s rupees and fee, with the rate it assumed, in English and Hindi', () => {
    const d = ds('ICICI credit card ••1234');
    const fee = cardForex(d)[0].fee!.amount; // 1,000 × 413 / 10,413 = ₹39.66
    expect(fee).toBe(3966);
    const k = (buildCredit(d, undefined, '2026-10-20').CR as { cards: { fx: string; fxHi: string; hasFx: boolean }[] }).cards[0];
    expect(k.hasFx).toBe(true);
    expect(k.fx).toContain('₹1,000 spent in USD');
    expect(k.fx).toContain('about ₹40');
    expect(k.fx).toContain('if your card charges 3.5% + GST (ICICI Sapphiro');
    expect(k.fxHi).toContain('USD में ₹1,000');
  });
  it('without a listed rate it says the mark-up is inside the amount, with no figure', () => {
    const k = (buildCredit(ds('Example Bank credit card ••1234'), undefined, '2026-10-20').CR as { cards: { fx: string }[] }).cards[0];
    expect(k.fx).toBe("₹1,000 spent in USD · the bank's mark-up is inside this amount");
  });
});
