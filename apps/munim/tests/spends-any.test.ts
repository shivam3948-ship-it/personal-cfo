import { describe, expect, it } from 'vitest';
import { loadDemo } from '@core/demo';
import { emptyDataset, type Dataset } from '@core/types';
import { buildSpendsMain } from '@/lib/views/spendsMain';
import { buildTransactions, buildCategory } from '@/lib/views/spends';

// Spends must work on anyone's statements, not just the sample family: fewer months, no salary, no loans, no notices.
async function variants(): Promise<[string, Dataset][]> {
  const s = await loadDemo();
  const bankOnly = { ...emptyDataset('bank only'), accounts: s.accounts.filter((a) => a.kind === 'bank'), txns: s.txns.filter((t) => t.account.startsWith('bank:')) };
  const noSalary = { ...bankOnly, txns: bankOnly.txns.filter((t) => t.category !== 'Salary') };
  const oneMonth = { ...bankOnly, txns: bankOnly.txns.filter((t) => t.date >= '2026-09-01') };
  const cardOnly = { ...emptyDataset('card only'), accounts: s.accounts.filter((a) => a.kind === 'card'), txns: s.txns.filter((t) => t.account.startsWith('card:')), cardStatements: s.cardStatements };
  const firstMonth = { ...bankOnly, txns: bankOnly.txns.filter((t) => t.date >= '2026-10-01') }; // nothing earlier to compare with
  const july = { ...bankOnly, txns: bankOnly.txns.filter((t) => t.date < '2026-08-01') }; // a statement set that ends in July, not October
  // a year of card statements starting late in a month: "this month" must be the latest month, not that first partial one
  const yearCard = { ...emptyDataset('year'), txns: s.txns.filter((t) => t.account.startsWith('card:')).concat([{ id: 'old#1', date: '2025-10-30', desc: 'LINKEDIN PREMIUM ANNUAL', amount: 999900, dir: 'debit', account: 'card:9012', source: 'card_statement', sourceFile: 'old.pdf', category: 'Subscriptions', merchant: 'LinkedIn Premium' }]), cardStatements: s.cardStatements };
  return [['year of card', yearCard], ['bank only', bankOnly], ['no salary', noSalary], ['one month', oneMonth], ['card only', cardOnly], ['first month', firstMonth], ['ends in July', july]];
}

describe('Spends on any statements', async () => {
  const { renderToString } = await import('react-dom/server');
  const { createElement } = await import('react');
  const Spends = (await import('@/screens/Spends')).default;
  const Transactions = (await import('@/screens/Transactions')).default;
  const Category = (await import('@/screens/Category')).default;
  for (const [name, ds] of await variants()) {
    it(`${name}: builds, renders, no NaN or undefined on screen`, () => {
      const v = buildSpendsMain(ds, { reportFrom: null });
      const html = renderToString(createElement(Spends, { theme: 'light', state: 'ready', data: v }));
      expect(html).not.toMatch(/NaN|undefined|Infinity/);
      expect(html).not.toMatch(/₹-|−₹-|usual \(₹0\)/); // never a negative amount to save, never a ₹0 "usual"
      if (name === 'year of card') { expect(v.META.cur).toBe(9); expect(html).not.toContain('LinkedIn Premium’s yearly'); } // October 2026, not the year-old charge
      if (v.META.pastN === 0) expect(html).not.toMatch(/(above|below) your usual pace|Save the ₹|vs a usual month/);
      expect(html).not.toMatch(/cult\.fit unused|Ask Orbit|••4521|Includes LingoPro/); // sample-family facts (from its emails and loans) never appear on someone else's screen
      const t = buildTransactions(ds);
      const th = renderToString(createElement(Transactions, { theme: 'light', state: 'ready', data: t }));
      expect(th).not.toMatch(/NaN|undefined/);
      const mon3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number((t.TX[0]?.[0] as string ?? '2026-10').slice(5, 7)) - 1];
      if (t.TX.length) expect(th, 'day headers carry the data month').toContain(' ' + mon3);
      const c = buildCategory(ds);
      expect(Object.keys(c.DATA).length).toBeGreaterThan(0);
      const day = c.META.day, mon = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][c.META.cur];
      for (const cat of Object.keys(c.DATA)) for (const variant of ['standard', 'bharat']) {
        const h = renderToString(createElement(Category, { theme: 'light', cat, variant, data: c }));
        expect(h, cat).not.toMatch(/NaN|undefined|Infinity|usual \(₹0\)|आम \(₹0\)/);
        if (variant === 'standard') expect(h, cat).toContain(`${mon} 1–${day}`); // the month and day come from the statements, not the sample's October 15
      }
    });
  }
});

// A real statement (29 Oct demo check): most of a tier-2/3 saver's money goes over UPI to people and small shops Munim
// doesn't recognise. Those debits are "uncategorised" spending and must count in the month's total and in what's left;
// the screen used to start that total at zero and show only the recognised merchants.
describe('uncategorised UPI spending counts (synthetic statement)', async () => {
  const { renderToString } = await import('react-dom/server');
  const { createElement } = await import('react');
  const Spends = (await import('@/screens/Spends')).default;
  const { finalise } = await import('@core/ingest/finalise');
  it('the total and "left after spending" include it', () => {
    const acc = 'bank:1111';
    const tx = (id: string, date: string, desc: string, rupees: number, dir: 'debit' | 'credit') => ({ id, date, desc, amount: rupees * 100, dir, account: acc, source: 'bank_statement' as const, sourceFile: 'synthetic.pdf' });
    const ds: Dataset = { ...emptyDataset('synthetic'), accounts: [{ id: acc, kind: 'bank', last4: '1111', label: 'Bank ••1111' }],
      txns: [tx('a', '2026-08-03', 'UPI/DR/123/RAMESH K/SBIN/ramesh@ok/UPI', 1200, 'debit'), tx('b', '2026-08-09', 'UPI/DR/124/SUNITA V/UTIB/sv@ok/UPI', 300, 'debit'),
        tx('c', '2026-08-30', 'UPI/DR/125/IRCTC/YESB/irctc@yes/Paym', 500, 'debit'), tx('d', '2026-08-05', 'NEFT*RELATIVE NAME*', 2500, 'credit')] };
    finalise(ds); ds.today = '2026-08-31';
    const v = buildSpendsMain(ds, { reportFrom: null });
    expect(v.UNCAT).toBe(150000); // ₹1,500 to people and a shop Munim doesn't know
    const html = renderToString(createElement(Spends, { theme: 'light', state: 'ready', data: v }));
    expect(html).toContain('₹2,000'); // ₹1,500 uncategorised + ₹500 travel, not ₹500
    expect(html).not.toMatch(/left after spending[^₹]*₹2,500/); // money in ₹2,500 minus ₹2,000 out, never minus ₹500
  });
});

// The invariant that would have caught D-076 (29 Oct): what the screen says was spent is exactly what the engine counted,
// bucket by bucket, on every dataset, including a UPI-heavy one shaped like the primary user's month (people, small
// shops, unknown payees). Checking that the screen renders was not enough.
describe('the screen total equals the engine (every dataset)', async () => {
  const { renderToString } = await import('react-dom/server');
  const { createElement } = await import('react');
  const Spends = (await import('@/screens/Spends')).default;
  const { finalise } = await import('@core/ingest/finalise');
  const acc = 'bank:2222';
  const tx = (id: string, date: string, desc: string, rupees: number, dir: 'debit' | 'credit') => ({ id, date, desc, amount: rupees * 100, dir, account: acc, source: 'bank_statement' as const, sourceFile: 'synthetic.pdf' });
  const upiHeavy: Dataset = { ...emptyDataset('upi heavy'), accounts: [{ id: acc, kind: 'bank', last4: '2222', label: 'Bank ••2222' }], txns: [
    tx('1', '2026-08-02', 'UPI/DR/1/MOHAN L/SBIN/mohan@ok/UPI', 240, 'debit'), tx('2', '2026-08-04', 'UPI/DR/2/AUTO RAJU/PUNB/raju@ok/UPI', 60, 'debit'),
    tx('3', '2026-08-06', 'UPI/DR/3/GUPTA STORE/BARB/gs@ok/UPI', 1180, 'debit'), tx('4', '2026-08-10', 'UPI/DR/4/SELF/HDFC/me@ok/own a/c', 5000, 'debit'),
    tx('5', '2026-08-12', 'UPI/DR/5/Swiggy/ICIC/swiggy@icici/UPI', 389, 'debit'), tx('6', '2026-08-15', 'UPI/DR/6/MAA/SBIN/maa@ok/UPI', 3000, 'debit'),
    tx('7', '2026-08-20', 'UPI/DR/7/PRAKASH M/SBIN/pm@ok/UPI', 950, 'debit'), tx('8', '2026-08-01', 'NEFT*EMPLOYER PVT LTD*SALARY', 18000, 'credit'),
    tx('9', '2026-08-25', 'UPI/CR/9/RAVI/SBIN/ravi@ok/UPI', 500, 'credit')] };
  finalise(upiHeavy); upiHeavy.today = '2026-08-31';
  const rupees = (html: string, label: string) => { const m = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(new RegExp(label + '[^₹]*₹([\\d,]+)')); return m ? Number(m[1].replace(/,/g, '')) : null; };
  const all: [string, Dataset][] = [['upi heavy', upiHeavy], ...(await variants())];
  for (const [name, ds] of all) it(`${name}: total spent on screen = everyday + fixed + family + uncategorised`, () => {
    const v = buildSpendsMain(ds, { reportFrom: null });
    const engine = Object.values(v.CAT as Record<string, number>).reduce((a, b) => a + b, 0) + v.FIXED + v.FAMILY + v.UNCAT;
    const html = renderToString(createElement(Spends, { theme: 'light', state: 'ready', data: v }));
    expect(rupees(html, 'Spent, 1'), name).toBe(Math.round(engine / 100)); // the headline is the total (29 Oct)
    if (name === 'upi heavy') {
      // and the buckets plus "not counted" account for every rupee that went out (no refunds in this month)
      const out = ds.txns.filter((t) => t.dir === 'debit' && t.date.startsWith('2026-08')).reduce((a, t) => a + t.amount, 0);
      expect(engine + v.NOTCOUNTED).toBe(out);
      expect(v.UNCAT).toBeGreaterThan(0);
    }
  });
});
