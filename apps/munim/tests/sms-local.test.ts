import { describe, expect, it } from 'vitest';
import { readBankSms } from '@core/ingest/sms';
import { categorizeAll } from '@core/finance/categorize';
import { emptyDataset, type Txn } from '@core/types';
import { mergeSms } from '@/lib/local/sms';
import { buildSpendsMain } from '@/lib/views/spendsMain';
import { buildTodayMine } from '@/lib/views/todayMine';

const t = (id: string, account: string, date: string, amount: number, dir: Txn['dir'] = 'debit'): Txn => ({ id, account, date, amount, dir, desc: id, source: 'bank_statement', sourceFile: 'f' });

describe('SMS rows on the phone (D-055)', () => {
  it('a statement covering the account and date wins; same-row duplicates drop; 3-digit endings join their account', () => {
    const stmt = [t('s1', 'bank:4521', '2026-10-05', 5000)];
    const periods = [{ account: 'bank:4521', from: '2026-10-01', to: '2026-10-10' }];
    const sms = [
      { ...t('m1', 'bank:4521', '2026-10-06', 9900), source: 'sms' as const },  // inside the statement period: dropped
      { ...t('m2', 'bank:4521', '2026-10-12', 9900), source: 'sms' as const },  // after it: kept
      { ...t('m3', 'bank:521', '2026-10-13', 1000), source: 'sms' as const },   // "XX521": joins bank:4521
      { ...t('m4', 'card:5566', '2026-10-13', 1000), source: 'sms' as const },  // another account: kept
    ];
    expect(mergeSms(stmt, periods, sms).map((x) => [x.id, x.account])).toEqual([['m2', 'bank:4521'], ['m3', 'bank:4521'], ['m4', 'card:5566']]);
  });
  it('Spends and Today work on SMS alone (a saver with no statement PDF)', () => {
    const msgs = [
      'Sent Rs.250.00 From HDFC Bank A/C *4521 To ASHA KIRANA On 02/10/26 Ref 1 Not You?',
      'Sent Rs.120.00 From HDFC Bank A/C *4521 To SWIGGY On 03/10/26 Ref 2 Not You?',
      'INR 9,000.00 credited to A/c no. XX4521 on 01-10-26 by NEFT from EXAMPLE SHOP. Avl Bal INR 12,000.00',
      'Sent Rs.80.00 From HDFC Bank A/C *4521 To TEA STALL On 25/10/26 Ref 3 Not You?',
    ].map((body) => ({ body }));
    const ds = emptyDataset('Your statements');
    ds.txns = categorizeAll(readBankSms(msgs, 'p', '2026-10-26').txns);
    ds.accounts.push({ id: 'bank:4521', kind: 'bank', last4: '4521', label: 'Bank account ••4521 (from SMS)' });
    ds.today = '2026-10-26';
    expect(() => buildSpendsMain(ds, { reportFrom: null })).not.toThrow();
    const td = buildTodayMine(ds);
    expect(td.day.none).toBeFalsy();
    expect(td.day.date).toBe('2026-10-25'); // the tea stall counts as everyday spending (Dining)
  });
});
