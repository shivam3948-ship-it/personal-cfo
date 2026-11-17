import { describe, it, expect } from 'vitest';
import { cardBills, matchRefunds, merchantKey } from '../src/finance/cards';
import { emptyDataset, type CardStatement, type Txn } from '../src/types';

// D-092: shaped like the owner's two October card statements (amounts from his Spend Analyser reports, ₹ in paise)
const stmt = (x: Partial<CardStatement>): CardStatement => ({ account: 'card:8747', file: 'hdfc.pdf', periodStart: '2026-09-17', periodEnd: '2026-10-16', dueDate: '2026-11-05',
  prevBalance: 3275808, payments: 3480757, purchases: 3068900, credits: 0, charges: 0, totalDue: 2864000, minDue: 144000, limit: 50000000, ...x });
let n = 0;
const tx = (x: Partial<Txn>): Txn => ({ id: `t${++n}`, date: '2026-10-01', desc: 'X', amount: 100, dir: 'debit', account: 'bank:1234', source: 'card_statement', sourceFile: 'b.pdf', ...x });
const ds = (cards: CardStatement[], txns: Txn[]) => ({ ...emptyDataset(), cardStatements: cards, txns });

describe('card bills', () => {
  it('a bill still ahead with no payment is due; limit used comes from the statement', () => {
    const [b] = cardBills(ds([stmt({})], [tx({ date: '2026-10-20' })]), '2026-10-20');
    expect(b.status).toBe('due'); expect(b.usedPct).toBe(5.7); expect(b.last4).toBe('8747');
  });
  it('paying only the minimum is called out, not treated as paid', () => {
    const [b] = cardBills(ds([stmt({})], [tx({ date: '2026-11-02', amount: 144000, category: 'Card bill payment' })]), '2026-11-10');
    expect(b.status).toBe('paid_min'); expect(b.paid).toBe(144000);
  });
  it('the total, rounded to the rupee, is paid in full; less than the minimum is a part payment', () => {
    expect(cardBills(ds([stmt({ totalDue: 2863951 })], [tx({ date: '2026-11-02', amount: 2864000, category: 'Card bill payment' })]), '2026-11-10')[0].status).toBe('paid_full');
    expect(cardBills(ds([stmt({})], [tx({ date: '2026-11-02', amount: 50000, category: 'Card bill payment' })]), '2026-11-10')[0].status).toBe('paid_part');
  });
  it('past the due date: never "missed" (not even after a card SMS); bank statements covering it say not seen', () => {
    expect(cardBills(ds([stmt({})], [tx({ account: 'card:8747', source: 'sms', date: '2026-11-08' })]), '2026-11-08')[0].status).toBe('unknown');
    expect(cardBills(ds([stmt({})], [tx({ date: '2026-11-08' })]), '2026-11-08')[0].status).toBe('not_seen'); // paid from another account? CRED?
    expect(cardBills(ds([stmt({})], [tx({ date: '2026-10-30' })]), '2026-11-08')[0].status).toBe('unknown');
  });
  it('minimum or part paid before the due date is not yet past due', () => {
    const [b] = cardBills(ds([stmt({})], [tx({ date: '2026-10-25', amount: 144000, category: 'Card bill payment' })]), '2026-10-28');
    expect(b).toMatchObject({ status: 'paid_min', pastDue: false });
  });
  it('a payment on the statement day counts', () => {
    expect(cardBills(ds([stmt({})], [tx({ date: '2026-10-16', amount: 2864000, category: 'Card bill payment' })]), '2026-10-20')[0].status).toBe('paid_full');
  });
  it('with two cards due, a payment matching neither bill is credited to neither', () => {
    const icici = stmt({ account: 'card:7001', file: 'icici.pdf', periodEnd: '2026-10-18', totalDue: 774355, minDue: 39000 });
    const bills = cardBills(ds([stmt({}), icici], [tx({ date: '2026-11-03', amount: 1000000, category: 'Card bill payment' })]), '2026-11-04');
    expect(bills.map((b) => b.status)).toEqual(['due', 'due']);
  });
  it('with two cards due together, a bank payment counts towards the card whose bill it matches', () => {
    const icici = stmt({ account: 'card:7001', file: 'icici.pdf', periodEnd: '2026-10-18', totalDue: 774355, minDue: 39000, limit: 30000000 });
    const bills = cardBills(ds([stmt({}), icici], [tx({ date: '2026-11-03', amount: 774355, category: 'Card bill payment' })]), '2026-11-04');
    expect(bills.find((b) => b.last4 === '7001')!.status).toBe('paid_full');
    expect(bills.find((b) => b.last4 === '8747')!.status).toBe('due'); // not swallowed by the other card's payment
    expect(bills).toHaveLength(2); // both cards, not only the latest
  });
  it('the card’s own later statement is the best evidence', () => {
    const next = tx({ account: 'card:8747', dir: 'credit', date: '2026-11-04', amount: 2864000, category: 'Card bill payment' });
    expect(cardBills(ds([stmt({})], [next]), '2026-11-16')[0].status).toBe('paid_full');
  });
});

describe('refunds', () => {
  it('matches a part refund to the earlier booking, and a full refund to the same amount', () => {
    const booking = tx({ account: 'card:7001', date: '2026-07-30', desc: 'IBIBO GROUP PVT LTD GURGAON', amount: 1960000, category: 'Travel' });
    const refund = tx({ account: 'card:7001', dir: 'credit', date: '2026-09-24', desc: 'IBIBO GROUP PRIVATE LIMITED', amount: 855100, category: 'Travel' });
    const shoe = tx({ account: 'card:8747', date: '2026-10-02', desc: 'NIKE INDIA', amount: 999500 });
    const back = tx({ account: 'card:8747', dir: 'credit', date: '2026-10-09', desc: 'NIKE INDIA REFUND', amount: 999500, category: 'Refund' });
    const pay = tx({ account: 'card:7001', dir: 'credit', date: '2026-10-06', desc: 'BBPS PAYMENT RECEIVED', amount: 1210157, category: 'Card bill payment' });
    const m = matchRefunds(ds([], [booking, refund, shoe, back, pay]));
    expect(m).toHaveLength(2); // the bill payment is not a refund
    expect(m[0]).toMatchObject({ kind: 'partial', purchase: { id: booking.id } });
    expect(m[1]).toMatchObject({ kind: 'full', purchase: { id: shoe.id } });
    expect(merchantKey(booking)).toBe('ibibo');
  });
  it('a CRED credit is a payment, and a bank-side debit is never the purchase', () => {
    const credBank = tx({ date: '2026-10-01', desc: 'CRED CLUB', amount: 500000, category: 'Card bill payment' });
    const credCard = tx({ account: 'card:7001', dir: 'credit', date: '2026-10-02', desc: 'CRED', amount: 500000 });
    const shopBank = tx({ date: '2026-09-01', desc: 'ACME STORE', amount: 90000, category: 'Shopping' });
    const backCard = tx({ account: 'card:7001', dir: 'credit', date: '2026-09-05', desc: 'ACME STORE', amount: 90000, category: 'Refund' });
    const m = matchRefunds(ds([], [credBank, credCard, shopBank, backCard]));
    expect(m).toHaveLength(1); expect(m[0]).toMatchObject({ kind: 'full', purchase: { id: shopBank.id } }); // only the ACME refund, matched to its purchase on the bank
  });
  it('says so when no purchase matches, and never matches a later or smaller purchase', () => {
    const later = tx({ account: 'card:1', date: '2026-10-10', desc: 'ACME STORE', amount: 50000 });
    const small = tx({ account: 'card:1', date: '2026-09-01', desc: 'ACME STORE', amount: 10000 });
    const r = tx({ account: 'card:1', dir: 'credit', date: '2026-10-01', desc: 'ACME STORE', amount: 20000, category: 'Refund' });
    expect(matchRefunds(ds([], [later, small, r]))[0].kind).toBe('none');
  });
});

// ICICI prints one combined Payments/Credits figure: a merchant refund must not be swallowed as a bill payment (D-092)
import { finalise } from '../src/ingest/finalise';
describe('a refund on a card with a combined payments figure', () => {
  it('stays a refund, the worded payments stay payments, and the unworded "Click to Pay" is found by the combined total', () => {
    const card = 'card:7001';
    const d = ds([stmt({ account: card, file: 'icici.pdf', periodStart: '2026-09-19', periodEnd: '2026-10-18', payments: 2420314, totalDue: 774355, minDue: 39000 })], [
      tx({ account: card, sourceFile: 'icici-jul.pdf', date: '2026-07-30', desc: 'IBIBO GROUP PVT LTD GURGAON', amount: 1960000 }),
      tx({ account: card, sourceFile: 'icici.pdf', dir: 'credit', date: '2026-09-24', desc: 'IBIBO GROUP PRIVATE LIMITED', amount: 855100 }),
      tx({ account: card, sourceFile: 'icici.pdf', dir: 'credit', date: '2026-10-06', desc: 'BBPS PAYMENT RECEIVED 12345', amount: 1210157 }),
      tx({ account: card, sourceFile: 'icici.pdf', dir: 'credit', date: '2026-10-05', desc: 'CLICK TO PAY', amount: 355057 }),
    ]);
    finalise(d);
    const cat = (desc: string) => d.txns.find((t) => t.desc === desc)!.category;
    expect(cat('IBIBO GROUP PRIVATE LIMITED')).toBe('Refund');
    expect(cat('BBPS PAYMENT RECEIVED 12345')).toBe('Card bill payment');
    expect(cat('CLICK TO PAY')).toBe('Card bill payment');
  });
  it('the phone’s date decides whether the due date has passed', () => {
    const [b] = cardBills(ds([stmt({})], [tx({ date: '2026-10-20' })]), '2026-10-20', '2026-11-08');
    expect(b).toMatchObject({ status: 'unknown', pastDue: true });
  });
  it('an unworded Amazon refund on a card with a combined Payments/Credits figure stays a refund', () => {
    const card = 'card:7001';
    const d = ds([stmt({ account: card, file: 'icici.pdf', periodEnd: '2026-10-18', payments: 1500000 + 249900 })], [
      tx({ account: card, sourceFile: 'icici-sep.pdf', date: '2026-09-02', desc: 'AMAZON PAY INDIA PRIVATE LIMITED', amount: 499900 }),
      tx({ account: card, sourceFile: 'icici.pdf', dir: 'credit', date: '2026-10-01', desc: 'AMAZON PAY INDIA PRIVATE LIMITED', amount: 249900 }),
      tx({ account: card, sourceFile: 'icici.pdf', dir: 'credit', date: '2026-10-06', desc: 'BBPS PAYMENT RECEIVED', amount: 1500000 }),
    ]);
    finalise(d);
    expect(d.txns.find((t) => t.dir === 'credit' && t.desc.startsWith('AMAZON'))!.category).toBe('Refund');
    expect(cardBills(d, '2026-10-20')[0].paid).toBe(0); // the refund isn't counted as a payment towards this bill
  });
  it('an unworded CRED credit is never relabelled a refund', () => {
    const card = 'card:8747';
    const d = ds([stmt({ payments: 500000 })], [
      tx({ date: '2026-09-20', desc: 'CRED CLUB', amount: 500000 }),
      tx({ account: card, sourceFile: 'hdfc.pdf', dir: 'credit', date: '2026-10-05', desc: 'CRED', amount: 500000 }),
    ]);
    finalise(d);
    expect(d.txns.find((t) => t.desc === 'CRED')!.category).toBe('Card bill payment'); // found by the printed payments total
  });
});
