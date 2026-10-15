// Foundation-first guidance (D-021): debt → emergency fund → protection → invest the surplus.
// Deterministic: every recommendation and number comes from the user's documents plus disclosed rules of thumb.
// Category-level only: never names a fund, stock or insurance product.
import type { Dataset, Paise } from '../types';
import { asOfDate, emergencyFund, monthPictures, unusual } from './picture';
import { loanStatus, simulatePrepayment } from './loans';
import { annualPremium, policyView } from './insurance';
import { addMonths, spokenDate } from '../dates';
import { inr, sum } from '../money';

export const RULES = {
  highInterestPct: 12, // loans at or above this annual rate are "high-interest" (our threshold, disclosed)
  emergencyTargetMonths: 6, // upper end of the common 3–6 month rule; one salary, so we use 6
  emergencyMinMonths: 3,
  termCoverTimesIncome: 10, // a commonly cited rule of thumb, not a regulation
  copayWarnYears: 2,
} as const;

export const DISCLAIMER = {
  en: 'Guidance from your own documents and common rules of thumb. Not SEBI-registered investment advice; registered advice comes only after an RIA licence. Insurance points are general, not a policy recommendation.',
  hi: 'यह आपके दस्तावेज़ों और आम नियमों पर आधारित सलाह है, SEBI-रजिस्टर्ड निवेश सलाह नहीं। बीमा के बारे में बातें सामान्य हैं, किसी पॉलिसी की सिफ़ारिश नहीं।',
};

export type StepId = 'cash_flow' | 'card_debt' | 'high_interest_loans' | 'emergency_fund' | 'health_cover' | 'life_cover' | 'savings_policies' | 'invest_surplus';
export interface Step {
  id: StepId; order: number; status: 'done' | 'todo' | 'review' | 'unknown';
  finding: string; recommendation: string; basis: string;
  numbers: Record<string, Paise | number | string | null>;
}

export function foundationPlan(ds: Dataset) {
  const asOf = asOfDate(ds);
  const steps: Step[] = [];
  const pics = monthPictures(ds).filter((p) => p.complete);
  const avgIncome = pics.length ? Math.round(sum(pics.map((p) => p.income)) / pics.length) : null;
  const avgSurplus = pics.length ? Math.round(sum(pics.map((p) => p.surplus)) / pics.length) : null;

  // 0. Spending vs income: the base of everything else.
  const negMonths = pics.filter((p) => p.surplus < 0);
  const bigOneOff = unusual(ds).find((u) => u.kind === 'large_txn');
  const deficitHeavy = negMonths.length >= 2 || (avgSurplus !== null && avgIncome !== null && avgSurplus < -0.05 * avgIncome);
  steps.push({
    id: 'cash_flow', order: 0, status: avgSurplus === null ? 'unknown' : deficitHeavy ? 'todo' : negMonths.length ? 'review' : 'done',
    finding: avgSurplus === null ? 'No complete month of bank data.' : `Average monthly surplus ${inr(avgSurplus)} over ${pics.length} months; ${negMonths.length} month(s) spent more than income${bigOneOff ? ` (largest one-off: ${bigOneOff.merchant} ${inr(bigOneOff.amount)})` : ''}.`,
    recommendation: negMonths.length ? 'Plan big purchases ahead and keep monthly spending below income; a surplus is what every later step runs on.' : 'Spending stays below income; keep it that way.',
    basis: 'complete months of bank and card data; income minus true spend and committed outflows',
    numbers: { average_monthly_surplus: avgSurplus, deficit_months: negMonths.length, months_checked: pics.length },
  });

  // 1. Revolving credit card debt: paid less than the previous balance, or finance charges.
  const cards = [...ds.cardStatements].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const revolving = cards.filter((s, i) => i > 0 && (s.charges > 0 || s.payments < s.prevBalance));
  const cardRate = ds.docs.map((d) => d.text.match(/([\d.]+)\s*%\s*per month/i)?.[1]).find(Boolean) ?? null;
  steps.push({
    id: 'card_debt', order: 1, status: !cards.length ? 'unknown' : revolving.length ? 'todo' : 'done',
    finding: !cards.length ? 'No card statements uploaded.' : revolving.length ? `Card balance carried over in ${revolving.length} of ${cards.length - 1} cycles.` : `Card paid in full in all ${cards.length - 1} cycles with no finance charges.`,
    recommendation: revolving.length ? 'Pay the full card bill every month before anything else; card interest is the most expensive debt you can carry.' : 'Keep paying the card in full.',
    basis: `card statements${cardRate ? `; statement interest rate ${cardRate}% per month` : ''}`,
    numbers: { cycles_checked: Math.max(0, cards.length - 1), cycles_revolving: revolving.length, finance_charges: sum(cards.map((s) => s.charges)), card_rate_per_month_pct: cardRate ? Number(cardRate) : null },
  });

  // 2. High-interest loans, ranked by net saving per rupee prepaid now (or when allowed).
  const probe = 5000000; // ₹50,000 probe amount for ranking
  const loans = ds.loans.map((l) => ({ l, st: loanStatus(l, asOf), sim: simulatePrepayment(l, probe, asOf) })).filter((x) => x.st.outstanding > 0);
  const high = loans.filter((x) => x.l.ratePct >= RULES.highInterestPct || x.l.type === 'personal');
  const best = loans.filter((x) => x.sim.allowed).sort((a, b) => b.sim.netSaving - a.sim.netSaving)[0];
  const offer = [...ds.offers].sort((a, b) => a.ratePct - b.ratePct)[0];
  steps.push({
    id: 'high_interest_loans', order: 2, status: !ds.loans.length ? 'unknown' : high.length ? 'todo' : 'done',
    finding: high.length ? high.map((x) => `${x.l.lender} ${x.l.type} loan at ${x.l.ratePct}%, outstanding ${inr(x.st.outstanding)}`).join('; ') : 'No loans at or above the high-interest threshold.',
    recommendation: high.length
      ? [
          ...high.map((x) => (x.sim.allowed ? `Prepay the ${x.l.type} loan first when you have spare cash; it is your costliest debt.` : `The ${x.l.type} loan can't be part-prepaid until ${spokenDate(x.sim.allowedFrom!)}; until then${offer && offer.ratePct < x.l.ratePct ? ` ask ${x.l.lender} to match the ${offer.ratePct}% offer, and` : ''} put spare cash into the emergency fund or the ${best && best.l.id !== x.l.id ? best.l.type + ' loan' : 'next-costliest loan'}.`)),
        ].join(' ')
      : 'No action needed on loans.',
    basis: `loan documents; threshold ${RULES.highInterestPct}% p.a. or any personal loan; ranking by net interest saved on a ₹50,000 prepayment after charges`,
    numbers: {
      best_prepay_now: best ? `${best.l.type} loan` : null, best_prepay_net_saving_per_50k: best?.sim.netSaving ?? null,
      ...Object.fromEntries(high.map((x) => [`${x.l.type}_rate_pct`, x.l.ratePct])),
      ...Object.fromEntries(high.map((x) => [`${x.l.type}_prepay_allowed_from`, x.sim.allowedFrom])),
      ...Object.fromEntries(high.map((x) => [`${x.l.type}_lender`, x.l.lender])),
      offer_rate_pct: offer && high.some((x) => offer.ratePct < x.l.ratePct) ? offer.ratePct : null,
    },
  });

  // 3. Emergency fund.
  const ef = emergencyFund(ds);
  const target = ef.monthlyOutflow * RULES.emergencyTargetMonths;
  const gap = ef.liquid === null ? null : Math.max(0, target - ef.liquid);
  steps.push({
    id: 'emergency_fund', order: 3,
    status: ef.months === null ? 'unknown' : ef.months >= RULES.emergencyTargetMonths ? 'done' : ef.otherAccountsSeen ? 'review' : 'todo',
    finding: ef.months === null ? 'No bank balance found.' : `Uploaded account covers ${ef.months} ${ef.months === 1 ? 'month' : 'months'} of outflow${ef.otherAccountsSeen ? '; another own account receives regular transfers but is not uploaded' : ''}.`,
    recommendation: ef.months !== null && ef.months < RULES.emergencyTargetMonths ? `Build a buffer of ${RULES.emergencyTargetMonths} months of outflow in a savings account, sweep-in FD or liquid fund before investing more.${ef.otherAccountsSeen ? ' Count the other account first; it may already cover part of this.' : ''}` : 'Buffer is in place; keep it separate from investments.',
    basis: `rule of thumb: ${RULES.emergencyMinMonths}–${RULES.emergencyTargetMonths} months of essential expenses; we use spend + committed outflows (conservative)`,
    numbers: { months_now: ef.months, target_months: RULES.emergencyTargetMonths, monthly_outflow: ef.monthlyOutflow, target_amount: target, gap_amount: gap },
  });

  // 4. Health cover: facts from the policy that change soon (co-pay age, waiting periods).
  const health = ds.policies.find((p) => p.kind === 'health');
  if (!health) steps.push({ id: 'health_cover', order: 4, status: 'todo', finding: 'No health policy found in the documents.', recommendation: 'Get a family health policy before investing; check whether an employer cover would end with the job.', basis: 'policy documents', numbers: {} });
  else {
    const h = health.health;
    const soon = (h?.members ?? []).filter((m) => h?.copayAgeAbove !== undefined && m.age <= h.copayAgeAbove && h.copayAgeAbove + 1 - m.age <= RULES.copayWarnYears);
    const older = (h?.members ?? []).filter((m) => m.age >= 55);
    steps.push({
      id: 'health_cover', order: 4, status: soon.length || older.length ? 'review' : 'done',
      finding: `${health.insurer} floater of ${inr(health.sumAssured)} for ${(h?.members ?? []).length} people${soon.length ? `; ${soon.map((m) => m.relation).join(' and ')} ${soon.length === 1 ? 'crosses' : 'cross'} the co-pay age of ${h?.copayAgeAbove} within ${RULES.copayWarnYears} years (${h?.copayPct}% co-pay after that)` : ''}.`,
      recommendation: older.length ? 'With parents near 60 sharing one floater, consider a super top-up and price separate senior-citizen cover before the co-pay starts; also check that the cover does not depend on an employer.' : 'Cover looks in place; review the sum insured each renewal.',
      basis: 'policy schedule (members, ages, co-pay rule); suggestion is general, not a product recommendation',
      numbers: { sum_insured: health.sumAssured, members: (h?.members ?? []).length, copay_age_above: h?.copayAgeAbove ?? null, copay_pct: h?.copayPct ?? null, members_near_copay: soon.length },
    });
  }

  // 5. Life cover vs income.
  const termCover = sum(ds.policies.filter((p) => p.kind === 'term').map((p) => p.sumAssured));
  const multiple = avgIncome ? Math.round((termCover / (avgIncome * 12)) * 10) / 10 : null;
  const neededCover = avgIncome ? avgIncome * 12 * RULES.termCoverTimesIncome : null;
  steps.push({
    id: 'life_cover', order: 5, status: multiple === null ? 'unknown' : multiple >= RULES.termCoverTimesIncome ? 'done' : 'todo',
    finding: termCover ? `Term cover ${inr(termCover)} = ${multiple}× annual income.` : 'No term life cover found.',
    recommendation: multiple !== null && multiple < RULES.termCoverTimesIncome ? `Consider raising pure term cover towards ${RULES.termCoverTimesIncome}× annual income; compare quotes from several insurers.` : 'Life cover meets the rule of thumb.',
    basis: `rule of thumb: ${RULES.termCoverTimesIncome}× annual income (commonly cited; actual need depends on dependants and loans)`,
    numbers: { term_cover: termCover, times_income: multiple, rule_times: RULES.termCoverTimesIncome, target_cover: neededCover, shortfall: neededCover === null ? null : Math.max(0, neededCover - termCover) },
  });

  // 6. Savings-type insurance: return per the insurer's own illustration.
  const savingPolicies = ds.policies.filter((p) => p.kind === 'endowment' || p.kind === 'ulip').map((p) => ({ p, v: policyView(p, asOf) }));
  steps.push({
    id: 'savings_policies', order: 6, status: savingPolicies.length ? 'review' : 'done',
    finding: savingPolicies.length ? savingPolicies.map(({ p, v }) => `${p.insurer} ${p.kind}: ${inr(annualPremium(p))} a year; illustrated return ${v.projectedReturnPct?.map((x) => `${x.irr}%`).join(' to ') ?? 'unknown'}`).join('; ') : 'No savings-type insurance policies.',
    recommendation: savingPolicies.length ? "Before deciding anything, ask the insurer for this policy's surrender value and paid-up value; compare them with the illustrated return and with keeping cover through a pure term plan. Stopping early usually loses money, so decide with the numbers in hand." : 'Nothing to review.',
    basis: "insurer's benefit illustration in the policy document; surrender and paid-up values are not in the documents",
    numbers: Object.fromEntries(savingPolicies.flatMap(({ p, v }) => [[`${p.kind}_premium_per_year`, annualPremium(p)], [`${p.kind}_irr_low_pct`, v.projectedReturnPct?.[0]?.irr ?? null], [`${p.kind}_irr_high_pct`, v.projectedReturnPct?.at(-1)?.irr ?? null]])),
  });

  // 7. Invest the surplus, by goal horizon (category level only).
  const sip = sum(ds.txns.filter((t) => t.category === 'Investments' && t.dir === 'debit' && pics.length && t.date >= pics[pics.length - 1].from && t.date <= pics[pics.length - 1].to).map((t) => t.amount));
  const gapsBefore = steps.filter((s) => s.status === 'todo').map((s) => s.id);
  steps.push({
    id: 'invest_surplus', order: 7, status: avgSurplus === null ? 'unknown' : gapsBefore.length ? 'review' : 'todo',
    finding: avgSurplus === null ? 'No complete month of bank data.' : `SIP of ${inr(sip)} a month already running; average surplus after it ${inr(avgSurplus)}.`,
    recommendation: `${gapsBefore.length ? 'Fix the earlier steps first, then ' : ''}match money to when you need it: goals within 3 years in FDs or liquid funds; 3–7 years in hybrid or short-duration debt funds; 7+ years in equity funds through SIPs (index or diversified). Keep the existing SIP running through market falls.`,
    basis: 'horizon buckets (0–3 / 3–7 / 7+ years) are a general allocation rule, category level only, no specific funds',
    numbers: { current_sip: sip, steps_to_fix_first: gapsBefore.length },
  });

  const firstGap = steps.find((s) => s.status === 'todo') ?? steps.find((s) => s.status === 'review') ?? null;
  return { asOf, steps, firstGap, disclaimer: DISCLAIMER, rules: RULES, nextReview: addMonths(asOf, 1) };
}
