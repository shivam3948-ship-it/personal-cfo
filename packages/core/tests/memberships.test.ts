import { describe, expect, it } from 'vitest';
import { categorizeAll } from '../src/finance/categorize';
import { leaks, subscriptionsToConfirm } from '../src/finance/picture';
import { moneyAudit } from '../src/finance/audit';
import { emptyDataset, type Dataset, type Txn } from '../src/types';

// D-052: what statements can say about subscriptions. Fixture: Swiggy One every month and no Swiggy order since July;
// Uber One every month with rides; a yearly app renewing within 30 days; Netflix every month (usage invisible).
const row = (id: string, date: string, desc: string, rupees: number): Txn => ({ id, date, desc, amount: rupees * 100, dir: 'debit', account: 'card:1234', source: 'card_statement' });
function fixture(answers?: Dataset['subAnswers']): Dataset {
  const t: Txn[] = [];
  for (const [i, m] of ['2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05'].entries()) {
    t.push(row(`so${i}`, m, 'SWIGGY ONE MEMBERSHIP BANGALORE', 299), row(`uo${i}`, m.replace('-05', '-07'), 'UBER ONE MEMBERSHIP', 149), row(`nf${i}`, m.replace('-05', '-09'), 'NETFLIX.COM', 649));
  }
  t.push(row('sw1', '2026-07-20', 'SWIGGY BANGALORE', 450));                          // last Swiggy order: 20 July
  for (const d of ['2026-09-20', '2026-10-02', '2026-10-12']) t.push(row(`ub${d}`, d, 'UBER INDIA SYSTEMS', 300)); // Uber is used
  t.push(row('ya1', '2025-10-30', 'LINKEDIN PREMIUM ANNUAL', 9999));                 // renews 30 Oct 2026
  t.push(row('end', '2026-10-15', 'DMART BANGALORE', 1200));                         // statements end 15 Oct
  return { ...emptyDataset('fixture'), txns: categorizeAll(t), subAnswers: answers };
}

describe('memberships, renewals and answers', () => {
  it('Swiggy One with no Swiggy order in 60 days is flagged; Uber One with rides is not', () => {
    const l = leaks(fixture());
    const sw = l.find((x) => x.kind === 'membership_unused' && x.merchant === 'Swiggy One')!;
    expect(sw.title).toBe('Swiggy One, but no Swiggy orders in your statements since 20 July');
    expect(sw.annualCost).toBe(299 * 12 * 100);
    expect(l.some((x) => x.kind === 'membership_unused' && x.merchant === 'Uber One')).toBe(false);
    expect(l.some((x) => x.merchant === 'Netflix' && x.kind === 'membership_unused')).toBe(false); // usage invisible: never claimed
  });
  it('a membership charge is a subscription, not a food order', () => {
    const t = fixture().txns.find((x) => x.id === 'so0')!;
    expect([t.category, t.merchant]).toEqual(['Subscriptions', 'Swiggy One']);
  });
  it('a yearly charge renewing within 30 days is flagged with its date', () => {
    const r = leaks(fixture()).find((x) => x.kind === 'renewal')!;
    expect(r.title).toBe('LinkedIn Premium is due to renew around 30 October, for about ₹9,999');
    expect(leaks(fixture({ 'LinkedIn Premium': { answer: 'later', at: '2026-10-14T00:00:00Z' } })).some((x) => x.kind === 'renewal')).toBe(false); // later = a week of quiet
  });
  it('"Yes, I use it" silences it for 90 days; "No" then a new charge is flagged', () => {
    expect(leaks(fixture({ 'Swiggy One': { answer: 'yes', at: '2026-10-14T10:00:00Z' } })).some((x) => x.merchant === 'Swiggy One' && x.kind !== 'subscription')).toBe(false);
    expect(leaks(fixture({ 'Swiggy One': { answer: 'no', at: '2026-10-14T10:00:00Z' } })).some((x) => x.merchant === 'Swiggy One' && x.kind !== 'subscription')).toBe(false); // cancelling: quiet
    const again = leaks(fixture({ 'Netflix': { answer: 'no', at: '2026-09-01T10:00:00Z' } })).find((x) => x.kind === 'still_charged')!;
    expect(again.title).toMatch(/Netflix charged again on 9 October, after you decided to cancel/);
  });
  it('asks about each recurring charge once; "later" comes back after a week', () => {
    expect(subscriptionsToConfirm(fixture()).map((r) => r.merchant)).toEqual(expect.arrayContaining(['Swiggy One', 'Uber One', 'Netflix']));
    expect(subscriptionsToConfirm(fixture({ Netflix: { answer: 'later', at: '2026-10-12T00:00:00Z' } })).some((r) => r.merchant === 'Netflix')).toBe(false);
    expect(subscriptionsToConfirm(fixture({ Netflix: { answer: 'later', at: '2026-10-01T00:00:00Z' } })).some((r) => r.merchant === 'Netflix')).toBe(true);
  });
  it('the audit leads with them, in rupees a year', () => {
    const f = moneyAudit(fixture(), 'spending').findings;
    expect(f[0].what).toMatch(/LinkedIn|Swiggy One/);
    expect(f.some((x) => x.kind === 'membership_unused' && x.fix === 'cancel it')).toBe(true);
    expect(f.find((x) => x.kind === 'renewal')!.fix).toMatch(/before it renews/);
  });
  it('no proof without the data: one month of statements and a single charge only get the question (review, 23 Oct)', () => {
    const one: Dataset = { ...emptyDataset('one'), txns: categorizeAll([row('a', '2026-09-20', 'SWIGGY ONE MEMBERSHIP', 299), row('b', '2026-10-15', 'DMART', 500)]) };
    expect(leaks(one).some((x) => x.kind === 'membership_unused')).toBe(false);
    const month: Dataset = { ...emptyDataset('m'), txns: categorizeAll([row('a', '2026-09-20', 'SWIGGY ONE MEMBERSHIP', 299), row('c', '2026-10-05', 'SWIGGY ONE MEMBERSHIP', 299), row('b', '2026-10-15', 'DMART', 500)]) };
    expect(leaks(month).some((x) => x.kind === 'membership_unused')).toBe(false); // monthly, but statements reach back 25 days, not 60
  });
  it('quiet windows count from today on the phone, and "yes" is asked again after 90 days', () => {
    const f = { ...fixture({ Netflix: { answer: 'yes', at: '2026-06-01T00:00:00Z' } }), today: '2026-10-20' };
    expect(subscriptionsToConfirm(f).some((r) => r.merchant === 'Netflix')).toBe(true);
    const later = { ...fixture({ 'LinkedIn Premium': { answer: 'later', at: '2026-10-14T00:00:00Z' } }), today: '2026-10-22' };
    expect(leaks(later).some((x) => x.kind === 'renewal')).toBe(true); // 8 days after "later", by today's date
  });
});
