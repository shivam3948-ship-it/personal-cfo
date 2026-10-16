import { describe, expect, it } from 'vitest';
import { hostRespond, type HostState } from '@/lib/host/agent';

const s: HostState = { savedPaise: 1245000, valuePaise: 1302650, dailyPaise: 5000, pausedUntil: null, streakDays: 41, nextDebit: '2026-10-17', monthSavedPaise: 75000, asOf: '2026-10-16' };

describe('embedded voice agent (host app)', () => {
  it('answers status in Hindi with numbers from the host state only', () => {
    const r = hostRespond('मेरा कितना बचा?', s, 'home', null);
    expect(r.lang).toBe('hi'); expect(r.intent).toBe('status');
    expect(r.answer).toContain('₹12,450'); expect(r.answer).toContain('₹13,027');
    expect(r.check.ok).toBe(true);
  });
  it('proposes, never executes, a daily-amount change; executes only on "haan"', () => {
    const p = hostRespond('roz 30 rupaye kar do', s, 'save', null);
    expect(p.intent).toBe('set_daily'); expect(p.proposal).toEqual({ type: 'set_daily', amountPaise: 3000 }); expect(p.executed).toBeNull();
    const y = hostRespond('haan', s, 'save', p.proposal);
    expect(y.executed).toEqual(p.proposal); expect(y.check.ok).toBe(true);
    const n = hostRespond('nahi', s, 'save', p.proposal);
    expect(n.executed).toBeNull(); expect(n.intent).toBe('cancel');
  });
  it('a bare "haan" with nothing pending changes nothing', () => {
    const r = hostRespond('haan', s, 'home', null);
    expect(r.executed).toBeNull();
  });
  it('pause with a duration; out-of-range amounts are refused', () => {
    const p = hostRespond('इस हफ्ते पैसे नहीं हैं, 10 दिन रोक दो', s, 'save', null);
    expect(p.proposal).toEqual({ type: 'pause', days: 10, until: '2026-10-26' });
    expect(hostRespond('make it 50000 daily', s, 'save', null).proposal).toBeNull();
  });
  it('withdrawal and returns questions; English detection', () => {
    const w = hostRespond('When will I get my money if I withdraw?', s, 'withdraw', null);
    expect(w.lang).toBe('en'); expect(w.intent).toBe('withdraw_info'); expect(w.check.ok).toBe(true);
    const r = hostRespond('kitna kamaya?', s, 'home', null);
    expect(r.intent).toBe('returns'); expect(r.answer).toContain('₹577'); // 57,650 paise, rounded to the rupee for speech expect(r.check.ok).toBe(true);
  });
});
