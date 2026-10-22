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
  return [['bank only', bankOnly], ['no salary', noSalary], ['one month', oneMonth], ['card only', cardOnly], ['first month', firstMonth], ['ends in July', july]];
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
