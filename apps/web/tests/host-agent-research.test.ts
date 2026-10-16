import { describe, expect, it } from 'vitest';
import { extraDebits, hostRespond, type HostState } from '@/lib/host/agent';

// Scenarios come from the top Play Store complaint themes for savings apps (docs/26).
const base: HostState = { savedPaise: 1245000, valuePaise: 1302650, dailyPaise: 5000, pausedUntil: null, streakDays: 41, nextDebit: '2026-10-17', monthSavedPaise: 75000, asOf: '2026-10-16',
  withdrawals: [{ id: 'W-1', amountPaise: 50000, requestedOn: '2026-10-15', expectedBy: '2026-10-16', status: 'processing' }],
  debits: [{ date: '2026-10-16', amountPaise: 5000, ref: 'D-7' }, { date: '2026-10-15', amountPaise: 5000, ref: 'D-6' }, { date: '2026-10-14', amountPaise: 5000, ref: 'D-5' }] };

describe('withdrawal status from the host record (theme: withdrawal delayed/stuck)', () => {
  it('on time: says when it arrives, from the record', () => {
    const r = hostRespond('मेरे पैसे अभी तक नहीं आए', base, 'withdraw', null);
    expect(r.intent).toBe('withdrawal_status'); expect(r.answer).toContain('₹500'); expect(r.answer).toContain('16 अक्टूबर'); expect(r.check.ok).toBe(true);
  });
  it('late: apologises with the delay in days and offers a person, not more bot', () => {
    const s = { ...base, asOf: '2026-10-19' };
    const r = hostRespond('paisa nikala tha abhi tak nahi aaya', s, 'home', null);
    expect(r.intent).toBe('withdrawal_late'); expect(r.answer).toContain('3'); expect(r.proposal?.type).toBe('handoff');
    const y = hostRespond('haan', s, 'home', r.proposal);
    expect(y.executed?.type).toBe('handoff'); expect(y.answer).toContain('2 घंटे'); expect(y.check.ok).toBe(true);
  });
  it('paid but "not in my bank": gives the bank reference to check', () => {
    const s: HostState = { ...base, withdrawals: [{ id: 'W-1', amountPaise: 50000, requestedOn: '2026-10-15', expectedBy: '2026-10-16', status: 'paid', paidOn: '2026-10-16', bankRef: 'UTR4417820963' }] };
    const r = hostRespond("withdrawal shows success but money not received", s, 'withdraw', null);
    expect(r.intent).toBe('withdrawal_status'); expect(r.answer).toContain('UTR4417820963'); expect(r.check.ok).toBe(true);
  });
  it('no recent withdrawal: a "when will I get it" question stays general info', () => {
    const r = hostRespond('पैसे कब मिलेंगे?', { ...base, withdrawals: [] }, 'withdraw', null);
    expect(r.intent).toBe('withdraw_info');
  });
});

describe('a person in one step (theme: AI-only support)', () => {
  it('"insaan se baat karao" connects at once, with a case summary the person reads', () => {
    const r = hostRespond('insaan se baat karao', base, 'home', null);
    expect(r.intent).toBe('handoff'); expect(r.executed?.type).toBe('handoff');
    if (r.executed?.type === 'handoff') { expect(r.executed.summary).toContain('₹500'); expect(r.executed.summary).toContain('processing'); }
  });
  it('second miss in a row offers a person instead of repeating help', () => {
    expect(hostRespond('mausam kaisa hai', base, 'home', null, 'auto', { misses: 0 }).intent).toBe('help');
    const r = hostRespond('mausam kaisa hai', base, 'home', null, 'auto', { misses: 1 });
    expect(r.intent).toBe('offer_handoff'); expect(r.proposal?.type).toBe('handoff');
  });
});

describe('extra debits (theme: money debited unexpectedly)', () => {
  it('finds a duplicate daily debit and proposes a refund request', () => {
    const s = { ...base, debits: [{ date: '2026-10-16', amountPaise: 5000, ref: 'D-7' }, { date: '2026-10-16', amountPaise: 5000, ref: 'D-8' }, ...base.debits!.slice(1)] };
    expect(extraDebits(s)).toEqual([{ date: '2026-10-16', extraPaise: 5000, refs: ['D-7', 'D-8'], count: 2 }]);
    const r = hostRespond('aaj do baar paise kat gaye', s, 'home', null);
    expect(r.intent).toBe('extra_debit'); expect(r.proposal).toEqual({ type: 'refund_request', date: '2026-10-16', extraPaise: 5000, refs: ['D-7', 'D-8'] }); expect(r.check.ok).toBe(true);
    const y = hostRespond('haan', s, 'home', r.proposal);
    expect(y.executed?.type).toBe('refund_request'); expect(y.check.ok).toBe(true);
  });
  it('no extra debit: shows the count and total instead of reassurance', () => {
    const r = hostRespond('kya extra paise kate?', base, 'home', null);
    expect(r.intent).toBe('debit_check'); expect(r.answer).toContain('₹150'); expect(r.check.ok).toBe(true);
  });
});

describe('value breakdown (theme: got back less than put in)', () => {
  it('shows put-in, market move and charges as arithmetic', () => {
    const r = hostRespond('kam kyon dikh raha hai?', base, 'home', null);
    expect(r.intent).toBe('value_breakdown'); expect(r.answer).toContain('₹12,450'); expect(r.answer).toContain('₹577'); expect(r.answer).toContain('₹0'); expect(r.check.ok).toBe(true);
  });
  it('fraud worry gets the where-is-my-money answer', () => {
    expect(hostRespond('ye app fraud to nahi?', base, 'home', null).intent).toBe('trust');
  });
});

describe('every suggestion chip in the demo reaches a real answer (regression: two chips fell to "help")', () => {
  const chips = ['कितना बचा?', 'कितना कमाया?', 'अगली बचत कब कटेगी?', 'आज दो बार पैसे कटे?', 'कम क्यों दिख रहा है?', 'इंसान से बात कराओ', 'रोज़ 30 रुपये कर दो', 'इस हफ़्ते पैसे नहीं हैं, 7 दिन रोक दो', 'रोज़ 100 कर दो',
    'मेरे पैसे अभी तक नहीं आए', 'कोई चार्ज लगेगा?', 'ये ऐप फ्रॉड तो नहीं?', 'पैसे कब मिलेंगे?', 'How much have I saved?', 'Was I charged twice today?', 'Why is it showing less?', 'Connect me to a person',
    "My money hasn't arrived yet", 'Is there a charge?', 'Is this app a fraud?', 'Make it ₹30 a day', 'Pause for 7 days', 'Make it ₹100 a day', 'How much did I earn?', 'When is the next debit?'];
  for (const c of chips) it(c, () => {
    const r = hostRespond(c, base, 'withdraw', null);
    expect(r.intent).not.toBe('help'); expect(r.check.ok).toBe(true);
  });
});
