// Federal Bank savings (2 Nov 2026): a synthetic statement in the layout of a real one (names, numbers and handles invented).
import { describe, expect, it } from 'vitest';
import { detectFormat, readBank } from '../src/ingest/banks';
import { upiPayee } from '../src/finance/categorize';

const head = [
  'Name of Customer', 'Address Last Updated On 01/04/2025 Branch Sol ID 1234', 'Registered Mobile Number 000000000000 Account Number 12345678906789',
  'STATEMENT OF ACCOUNT PERIOD : 01-APR-2025 to 30-APR-2025',
  'Date Value Date Particulars Tran Type Cheque Details Withdrawals Deposits Balance Dr/Cr', 'Opening Balance 0.00',
];
const rows = [
  '01/04/2025 01/04/2025 NEFT/EMPLOYER PVT LTD/XYZN000000000001/SALARY APR TFR 50000.00 50000.00 Cr',
  '02/04/2025 02/04/2025 UPIOUT/500000000001/9876543210@ybl/Tea/1234 TFR 20.00 49980.00 Dr',
  '03/04/2025 03/04/2025 UPIOUT/500000000002/paytm-56505013@ptys/Kirana/1234 TFR 1180.00 48800.00 Dr',
  '05/04/2025 05/04/2025 FT IMPS/P2A/500000000003/RENT APRIL TFR 12000.00 36800.00 Dr',
  '06/04/2025 06/04/2025 UPIOUT/500000000004/mohan.k@okaxis//1234 TFR 300.00 36500.00 Dr',
];
const tail = ['GRAND TOTAL 13500.00 50000.00', 'Page 1 of 1', '*** END OF STATEMENT ***'];

describe('Federal Bank savings', () => {
  it('reads every row and reconciles to the paisa', () => {
    const lines = [...head, ...rows, ...tail];
    expect(detectFormat(lines)).toBe('federal_savings');
    const r = readBank(lines, 'fed.pdf')!;
    expect(r.txns.map((t) => [t.dir, t.amount])).toEqual([['credit', 5000000], ['debit', 2000], ['debit', 118000], ['debit', 1200000], ['debit', 30000]]);
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
    expect(r.account.last4).toBe('6789'); expect(r.account.label).toBe('Federal Bank ••6789');
    expect(r.period).toEqual({ from: '2025-04-01', to: '2025-04-30' });
    expect(r.txns[1].desc).not.toMatch(/TFR$/); // the tran type is dropped from the narration
  });
  it('a misread amount fails the checks instead of saving wrong numbers', () => {
    const bad = [...head, ...rows.map((l, i) => (i === 2 ? l.replace('1180.00 48800.00', '1100.00 48800.00') : l)), ...tail];
    const r = readBank(bad, 'fed.pdf')!;
    expect(r.checks.find((c) => c.id === 'walk')!.ok).toBe(false);
    expect(r.checks.find((c) => c.id === 'totals')!.ok).toBe(false);
  });
  it('UPI payees: phone number and plain handle are people, a Paytm merchant handle is a shop', () => {
    expect(upiPayee(rows[1].split(' ').slice(2).join(' '))).toBe('person');
    expect(upiPayee(rows[2].split(' ').slice(2).join(' '))).toBe('shop');
    expect(upiPayee(rows[4].split(' ').slice(2).join(' '))).toBe('person');
  });
});
