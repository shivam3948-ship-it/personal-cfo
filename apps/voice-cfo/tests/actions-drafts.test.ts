import { describe, expect, it } from 'vitest';
import { addAction, clearActions, listActions, removeAction, toIcs, gcalLink } from '@/lib/actions';
import { runTool } from '@/lib/agent/tools';
import { demo } from './helpers';

describe('actions', () => {
  it('reminder → valid ICS with an alarm, and a Google Calendar link', () => {
    clearActions('t-ics');
    const a = addAction('t-ics', { kind: 'reminder', title: 'Pay card bill, ₹36,343', reminder: { date: '2026-10-23', notes: 'min due; full due' } });
    const ics = toIcs(a);
    expect(ics).toContain('BEGIN:VCALENDAR'); expect(ics).toContain('DTSTART;VALUE=DATE:20261023'); expect(ics).toContain('DTEND;VALUE=DATE:20261024');
    expect(ics).toContain('SUMMARY:Pay card bill\\, ₹36\\,343'); expect(ics).toContain('TRIGGER:-P1D'); expect(ics.split('\r\n').length).toBeGreaterThan(10);
    expect(gcalLink(a)).toContain('dates=20261023%2F20261024');
    expect(removeAction('t-ics', a.id)).toBe(true); expect(listActions('t-ics')).toEqual([]);
  });
  it('drafts carry exact figures from the engine', async () => {
    const ds = await demo(); clearActions('t-draft');
    const ctx = { ds, sid: 't-draft', lang: 'en' as const };
    const refund = await runTool('draft_email', { kind: 'refund_request', merchant: 'LingoPro' }, ctx);
    expect(refund.action!.email!.to).toBe('billing@lingopro.example');
    expect(refund.action!.email!.body).toContain('₹4,999'); expect(refund.action!.email!.body).toContain('25 October');
    const dispute = await runTool('draft_email', { kind: 'dispute_charge', merchant: 'Netflix' }, ctx);
    expect(dispute.action!.email!.body).toContain('₹649'); expect(dispute.action!.email!.body).toContain('18 September');
    const rate = await runTool('draft_email', { kind: 'rate_reduction', loan: 'personal' }, ctx);
    expect(rate.action!.email!.to).toBe('care@orbitfinserv.example');
    expect(rate.action!.email!.body).toMatch(/13\.5% p\.a\..*Neem Bank at 11\.25% p\.a\./s);
    expect(rate.action!.email!.body).toContain('768');
    const claim = await runTool('draft_email', { kind: 'claim_intimation', member: 'mother', condition: 'dengue', admission: 'emergency', admit_date: '2026-10-16' }, ctx);
    expect(claim.action!.email!.to).toBe('claims@carelink-tpa.example');
    expect(listActions('t-draft').length).toBe(4);
  });
  it('savings goal and prepayment plan', async () => {
    const ds = await demo(); clearActions('t-goal');
    const ctx = { ds, sid: 't-goal', lang: 'en' as const };
    const g = await runTool('create_savings_goal', { name: 'Goa trip', target_rupees: 60000, by_date: '2027-03-31' }, ctx);
    expect(g.result).toMatchObject({ done: true, months: 6, monthly_needed: '₹10,000' });
    const p = await runTool('save_prepayment_plan', { loan: 'car', amount_rupees: 50000, date: '2026-11-01' }, ctx);
    expect(p.result).toMatchObject({ done: true, allowed_now: true, date: '2026-11-01' });
    expect(toIcs(p.action!)).toContain('DTSTART;VALUE=DATE:20261101');
  });
});
