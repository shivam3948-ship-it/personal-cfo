import { describe, expect, it } from 'vitest';
import { foundationPlan, RULES } from '@core/finance/advice';
import { demo } from './helpers';

describe('foundation-first guidance (D-021)', () => {
  it('orders steps debt → buffer → protection → invest, and picks the first real gap', async () => {
    const p = foundationPlan(await demo());
    expect(p.steps.map((s) => s.id)).toEqual(['cash_flow', 'card_debt', 'high_interest_loans', 'emergency_fund', 'health_cover', 'life_cover', 'savings_policies', 'invest_surplus']);
    expect(p.steps.find((s) => s.id === 'card_debt')!.status).toBe('done');
    expect(p.firstGap!.id).toBe('high_interest_loans');
    expect(p.firstGap!.recommendation).toContain('20 December'); // personal loan lock-in from the document
    expect(p.firstGap!.numbers.best_prepay_now).toBe('car loan'); // only loans prepayable now are ranked
  });
  it('numbers come from the engine: emergency gap and life-cover shortfall reconcile', async () => {
    const p = foundationPlan(await demo());
    const ef = p.steps.find((s) => s.id === 'emergency_fund')!.numbers;
    expect(ef.target_amount).toBe((ef.monthly_outflow as number) * RULES.emergencyTargetMonths);
    expect(ef.gap_amount).toBe((ef.target_amount as number) - 14176365);
    const lc = p.steps.find((s) => s.id === 'life_cover')!.numbers;
    expect(lc.shortfall).toBe((lc.target_cover as number) - (lc.term_cover as number));
  });
  it('detects revolving card debt when a bill is not paid in full', async () => {
    const ds = structuredClone(await demo());
    ds.cardStatements[2] = { ...ds.cardStatements[2], payments: ds.cardStatements[2].prevBalance - 500000, charges: 61200 };
    const card = foundationPlan(ds).steps.find((s) => s.id === 'card_debt')!;
    expect(card.status).toBe('todo'); expect(card.numbers.cycles_revolving).toBe(1); expect(foundationPlan(ds).firstGap!.id).toBe('card_debt');
  });
  it('never names a product and never says "surrender this policy"', async () => {
    const text = JSON.stringify(foundationPlan(await demo()).steps).toLowerCase();
    for (const bad of ['surrender it', 'surrender this policy', 'parag parikh', 'hdfc', 'sbi bluechip', 'icici prudential']) expect(text).not.toContain(bad);
  });
});
