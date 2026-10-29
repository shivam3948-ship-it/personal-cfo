// Essentials and the emergency fund (D-040). Essentials are the costs a hard month can't pause:
// fixed costs (rent, EMIs, insurance), family support, groceries, utilities, mobile & internet, fuel.
// Food delivery, dining, shopping, subscriptions and travel are left out because they can be paused.
import type { Dataset, Paise } from '../types';
import { monthPictures, latestBankBalance } from './picture';
import { annualPremium } from './insurance';
import { monthName } from '../dates';
import { sum } from '../money';

export const ESSENTIALS: Record<string, string[]> = {
  'Fixed costs': ['Rent', 'Loan EMI', 'Insurance', 'Regular payments'],
  'Family support': ['Family support'],
  Groceries: ['Groceries'],
  Utilities: ['Utilities'],
  'Mobile & internet': ['Mobile & internet'],
  Fuel: ['Fuel'],
};

/** Every policy's premium as a monthly amount: yearly and quarterly premiums are spread over 12 months, so the month a
 *  yearly premium happens to land in doesn't inflate the average. */
export const monthlyPremiums = (ds: Dataset): Paise => sum(ds.policies.map((p) => Math.round(annualPremium(p) / 12)));

/** Essentials by complete month ("Jul" → group → paise). Insurance uses the spread premiums when policy documents exist,
 *  otherwise what the statement shows. */
export function essentialsByMonth(ds: Dataset): Record<string, Record<string, Paise>> {
  const prem = ds.policies.length ? monthlyPremiums(ds) : null;
  const out: Record<string, Record<string, Paise>> = {};
  for (const p of monthPictures(ds).filter((m) => m.complete)) {
    const row: Record<string, Paise> = {};
    for (const [g, cats] of Object.entries(ESSENTIALS)) row[g] = sum(cats.map((c) => (c === 'Insurance' && prem !== null ? prem : p.byCategory[c] ?? 0)));
    out[monthName(p.key, 'en').slice(0, 3)] = row;
  }
  return out;
}

export interface EmergencyFund {
  bank: Paise; debtFunds: Paise; have: Paise; essentialsPerMonth: Paise; target: Paise; gap: Paise; months: number | null; targetMonths: number; basis: string;
}

/** Emergency fund ("safety net") = 6 months of essentials (D-040). Supersedes picture.emergencyFund, which divides by every outflow. Bank balance plus debt and liquid funds (they can be withdrawn in a few days, shown separately). */
export function safetyNet(ds: Dataset, targetMonths = 6): EmergencyFund {
  const ess = Object.values(essentialsByMonth(ds));
  const perMonth = ess.length ? Math.round(sum(ess.map((r) => sum(Object.values(r)))) / ess.length) : 0;
  const bank = latestBankBalance(ds)?.balance ?? 0;
  // Debt and liquid funds, plus arbitrage funds (equity-taxed but hedged, liquid-like): all withdrawable in 1–3 working days.
  const debtFunds = sum((ds.portfolio?.holdings ?? []).filter((h) => h.asset === 'debt' || h.category === 'Arbitrage').map((h) => h.value));
  const have = bank + debtFunds, target = perMonth * targetMonths;
  return {
    bank, debtFunds, have, essentialsPerMonth: perMonth, target, gap: Math.max(0, target - have), targetMonths,
    months: perMonth ? Math.round((have / perMonth) * 10) / 10 : null,
    basis: `bank balance + debt/liquid funds ÷ average essentials over ${ess.length} complete month(s); yearly premiums spread over 12 months`,
  };
}

/** Average monthly salary over the complete months (null when there is no salary credit). Planning uses salary, not interest or refunds. */
export function monthlyIncome(ds: Dataset): Paise | null {
  const pics = monthPictures(ds).filter((m) => m.complete && (m.byCategory.Salary ?? 0) > 0);
  return pics.length ? Math.round(sum(pics.map((m) => m.byCategory.Salary ?? 0)) / pics.length) : null;
}
