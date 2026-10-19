import { describe, expect, it } from 'vitest';
import { loadDemo } from '@core/demo';
import { emptyDataset } from '@core/types';
import { buildHome } from '@/lib/views/home';

const s = { kind: 'sample' as const, memberLabel: 'Me', displayName: 'Rohan' };

describe('Home view model', () => {
  it('sample family: net worth adds up from its parts and lists its sources', async () => {
    const v = buildHome(await loadDemo(), s);
    expect(v.greeting).toBe('Namaste, Rohan');
    const nw = v.netWorth!;
    expect(nw.total.paise).toBe(nw.investments.paise! + nw.bank.paise! + nw.loans.paise!);
    expect(nw.total.text).toBe('₹8,58,754');
    expect(nw.total.math!.sources.length).toBeGreaterThanOrEqual(3);
  });
  it('top 3: the due comes first, then costs ordered by rupees per year', async () => {
    const v = buildHome(await loadDemo(), s);
    expect(v.top.length).toBe(3);
    expect(v.top[0].reason).toBe('due');
    expect(v.top.map((t) => t.title)).toEqual(['Credit card bill due 24 Oct', 'cult.fit membership unused since 12 July', '3 funds in regular plans']);
  });
  it('empty data: no net worth, tiles ask for documents instead of showing zeros', () => {
    const v = buildHome(emptyDataset(), { kind: 'user', memberLabel: 'Me', displayName: null });
    expect(v.netWorth).toBeNull(); expect(v.top).toEqual([]); expect(v.greeting).toBe('Namaste');
    expect(v.tiles.every((t) => t.empty)).toBe(true);
  });
});
