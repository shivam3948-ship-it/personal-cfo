import { describe, expect, it } from 'vitest';
import { claimPlan, irrMonthlyToMaturity, policyView } from '@/lib/finance/insurance';
import { demo } from './helpers';

describe('insurance', () => {
  it('IRR: getting back exactly what you paid is ~0%, more is positive', () => {
    expect(Math.abs(irrMonthlyToMaturity(500000, 240, 500000 * 240))).toBeLessThan(0.01);
    expect(irrMonthlyToMaturity(500000, 240, 195000000)).toBeGreaterThan(4);
  });
  it('endowment return comes from the insurer’s own illustration', async () => {
    const ds = await demo();
    const v = policyView(ds.policies.find((p) => p.kind === 'endowment')!, '2026-10-15');
    expect(v.annualPremium).toBe(6000000);
    expect(v.projectedReturnPct!.map((x) => x.assumed)).toEqual([4, 8]);
    expect(v.nextDue).toBe('2026-11-10');
  });
  it('claim helper: father’s cataract surgery is inside the 24-month waiting period', async () => {
    const ds = await demo();
    const h = ds.policies.find((p) => p.kind === 'health')!;
    const c = claimPlan(h, 'Papa', 'मोतियाबिंद का ऑपरेशन', 'planned', '2026-10-20');
    expect(c).toMatchObject({ member: 'father', memberCovered: true, condition: 'cataract', coveredNow: 'no', waitingEnds: '2027-07-10', copayPct: 0, roomRentCapPerDay: 1000000, intimateWithinHours: 48 });
  });
  it('claim helper: mother with dengue, emergency → covered, 24h intimation', async () => {
    const ds = await demo();
    const c = claimPlan(ds.policies.find((p) => p.kind === 'health')!, 'mummy', 'dengue', 'emergency', '2026-10-16');
    expect(c).toMatchObject({ coveredNow: 'yes', intimateWithinHours: 24, tpa: 'CareLink TPA' });
    expect(c.documents.length).toBeGreaterThan(5);
  });
  it('claim helper: a member not on the policy', async () => {
    const ds = await demo();
    expect(claimPlan(ds.policies.find((p) => p.kind === 'health')!, 'wife', 'fever', 'emergency', '2026-10-16')).toMatchObject({ memberCovered: false, coveredNow: 'no' });
  });
});
