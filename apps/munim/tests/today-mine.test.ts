import { describe, expect, it } from 'vitest';
import { loadDemo } from '@core/demo';
import { emptyDataset } from '@core/types';
import { buildToday } from '@/lib/views/today';
import { buildTodayMine } from '@/lib/views/todayMine';
import { cleanName } from '@/lib/local/profile';

// Today on your own statements (D-049): anyone's data, no sample-family facts, the greeting uses your name or none.
describe('Today on your statements', async () => {
  const { renderToString } = await import('react-dom/server');
  const { createElement } = await import('react');
  const Today = (await import('@/screens/Today')).default;
  const s = await loadDemo();
  const bankOnly = { ...emptyDataset('b'), accounts: s.accounts.filter((a) => a.kind === 'bank'), txns: s.txns.filter((t) => t.account.startsWith('bank:')) };
  const july = { ...bankOnly, txns: bankOnly.txns.filter((t) => t.date < '2026-08-01') };
  const user = { kind: 'user' as const, memberLabel: 'Me', displayName: 'Asha' };
  const render = (data: Record<string, unknown>, state = 'ready') => renderToString(createElement(Today, { theme: 'light', state, data }));

  for (const [name, ds] of [['bank only', bankOnly], ['ends in July', july]] as const) {
    it(`${name}: latest-day card and one fix from the data, greeting by name`, () => {
      const td = buildTodayMine(ds);
      const html = render({ ...buildToday(ds, user), NAME: 'Asha', TD: td });
      expect(html).not.toMatch(/NaN|undefined|Infinity|Rohan|Zomato ₹626|cult\.fit unused since 12 July|Yesterday, 14 Oct|14\.2% a year|due 24 Oct|Last Sunday|SMS alerts|Loans outstanding \(2\)/);
      expect(html).toContain('Asha, here’s your money today');
      expect(html).toContain('Step 2: Last day');
      expect(html).toContain(td.dateLine);
      expect(td.day.label).toMatch(/^Your last spending day, \d+ \w{3}$/);
      expect(td.day.spent).toBeGreaterThan(0); // the card shows a day you actually spent
      const ef = /Emergency fund: ₹([\d,]+) of ₹([\d,]+)/.exec(html); // never "₹2,49,056 of ₹36,216": a full fund moves on to the next step
      if (ef) expect(Number(ef[1].replace(/,/g, ''))).toBeLessThan(Number(ef[2].replace(/,/g, '')));
    });
  }
  it('a CAS but no bank statement: no made-up day, no bill', () => {
    const td = buildTodayMine(emptyDataset('none'));
    expect(td.day.none).toBe(true); expect(td.bill).toBeNull(); expect(td.fix).toBeNull();
    expect(render({ ...buildToday(emptyDataset('none'), user), NAME: 'Asha', TD: { ...td, inv: true, dateLine: 'Monday, 1 Jan' } })).not.toMatch(/NaN|undefined|Rohan/);
  });
  it('the latest day adds up from its own rows', () => {
    const td = buildTodayMine(bankOnly);
    expect(td.day.spent).toBeGreaterThanOrEqual(0);
    expect(td.day.top.reduce((a, [, r]) => a + r, 0)).toBeLessThanOrEqual(td.day.spent + 2); // top two merchants are part of the day (rounding to rupees)
  });
  it('no name: a greeting without one; no statements: the get-started state by name', () => {
    expect(render({ ...buildToday(bankOnly, user), NAME: '', TD: buildTodayMine(bankOnly) })).toContain('Here’s your money today');
    const empty = render({ ...buildToday(bankOnly, user), NAME: 'Asha', TD: null }, 'empty');
    expect(empty).toContain('Welcome, Asha'); expect(empty).not.toContain('Rohan');
  });
  it('the sample family still reads as before', async () => {
    const { getSession } = await import('@/lib/session');
    expect(render(buildToday(s, await getSession(new Request('http://local/'))))).toContain('Rohan, your money’s okay today');
  });
  it('names are cleaned: letters in any script, short, nothing else', () => {
    expect(cleanName('  shivam  ')).toBe('shivam'); expect(cleanName('आशा')).toBe('आशा');
    expect(cleanName('<script>x</script>')).toBe('scriptxscript'); expect(cleanName('12345')).toBeNull();
    expect(cleanName('A'.repeat(40))!.length).toBe(24);
  });
});
