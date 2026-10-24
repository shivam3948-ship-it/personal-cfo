import { describe, expect, it } from 'vitest';
import { detectFormat, readBank, dateChecks } from '@core/ingest/banks';
import { FORMATS, synth, type Fmt } from './synth/statements';

// D-053: every reader on 40 synthetic statements per layout (seeded, so a failure reproduces), scored the way FinAnalyzer
// scores extraction: "value" = date, direction, amount and balance all right; "narration" = the payee survives in the text.
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const yearBack = (d: string) => `${+d.slice(0, 4) - 1}${d.slice(4)}`;

describe.each(FORMATS)('%s on synthetic statements', (fmt: Fmt) => {
  it('reads every row exactly and passes every check', () => {
    let rows = 0, value = 0, narration = 0;
    for (const seed of SEEDS) {
      const s = synth(fmt, seed);
      expect(detectFormat(s.lines), `seed ${seed}`).toBe(fmt);
      const r = readBank(s.lines, 'x.pdf')!;
      expect(r.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`), `seed ${seed}`).toEqual([]);
      expect(r.txns.length, `seed ${seed}`).toBe(s.rows.length);
      s.rows.forEach((x, i) => {
        const t = r.txns[i]; rows++;
        if (t.date === x.date && t.dir === x.dir && t.amount === x.amount && (x.balance === undefined || t.balance === x.balance)) value++;
        if (t.desc.toUpperCase().includes(x.payee)) narration++;
      });
    }
    expect(value / rows).toBe(1);
    expect(narration / rows).toBe(1);
  });

  it('a dropped row fails a check', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const s = synth(fmt, seed), drop = Math.floor(s.rows.length / 2);
      expect(readBank(synth(fmt, seed, { drop }).lines, 'x.pdf')!.checks.some((c) => !c.ok), `seed ${seed}`).toBe(true);
    }
  });

  it('a misread year: the money still reconciles, the date check catches it', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const s = synth(fmt, seed), row = Math.floor(s.rows.length / 2);
      const r = readBank(synth(fmt, seed, { date: { row, to: yearBack(s.rows[row].date) } }).lines, 'x.pdf')!;
      const money = r.checks.filter((c) => !['dates', 'in_period', 'order'].includes(c.id));
      expect(money.every((c) => c.ok), `seed ${seed}`).toBe(true);
      // Axis prints no statement period, so a wrong year there can't be caught from the statement alone (a known gap)
      expect(r.checks.some((c) => !c.ok), `seed ${seed}`).toBe(fmt !== 'axis_card');
    }
  });
});

describe('date order in bank accounts', () => {
  it.each(['hdfc_savings', 'sbi_savings', 'canara_savings'] as Fmt[])('%s: a day misread earlier than the row above fails "order" only', (fmt) => {
    for (const seed of SEEDS.slice(0, 10)) {
      const s = synth(fmt, seed);
      // a row whose neighbour above is at least a week into the month, printed as the 1st (beyond ORDER_SLACK_DAYS)
      const row = s.rows.findIndex((x, i) => i > 0 && s.rows[i - 1].date >= s.period.from.replace(/\d{2}$/, '08'));
      const r = readBank(synth(fmt, seed, { date: { row, to: s.period.from } }).lines, 'x.pdf')!;
      expect(r.checks.filter((c) => !c.ok).map((c) => c.id), `seed ${seed}`).toEqual(['order']);
    }
  });
});

describe('dateChecks margins (from real statements, D-053)', () => {
  const t = (date: string) => ({ id: date, date, desc: '', amount: 100, dir: 'debit' as const, account: 'a', source: 'bank_statement' as const, sourceFile: 'f' });
  const period = { from: '2026-09-01', to: '2026-09-30' };
  const ok = (kind: 'bank' | 'card', ...dates: string[]) => dateChecks(dates.map(t), period, kind).every((c) => c.ok);
  it('a bank row a day after the period is fine; a month or a year off is not', () => {
    expect(ok('bank', '2026-09-01', '2026-10-01')).toBe(true);
    expect(ok('bank', '2026-09-01', '2026-10-31')).toBe(false);
    expect(ok('bank', '2025-09-15')).toBe(false);
  });
  it('a card purchase made weeks before its billing period is fine; a year off is not', () => {
    expect(ok('card', '2026-08-13', '2026-09-10')).toBe(true);
    expect(ok('card', '2025-09-10')).toBe(false);
  });
  it('a bank row a day before the row above is fine (a real Canara quirk); a week before is not', () => {
    const order = (...dates: string[]) => dateChecks(dates.map(t), period, 'bank').find((c) => c.id === 'order')!.ok;
    expect(order('2026-09-10', '2026-09-09', '2026-09-12')).toBe(true);
    expect(order('2026-09-20', '2026-09-11')).toBe(false);
  });
  it('an impossible date fails', () => expect(ok('card', '2026-02-30')).toBe(false));
  it('no printed period: only the date itself is checked', () => expect(dateChecks([t('2026-09-02')], undefined, 'card').map((c) => c.id)).toEqual(['dates']));
});
