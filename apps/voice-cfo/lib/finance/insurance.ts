import type { Paise, Policy } from '../types';
import { addMonths, daysBetween } from '../dates';

export const annualPremium = (p: Policy): Paise => p.premium * (p.premiumFreq === 'monthly' ? 12 : p.premiumFreq === 'quarterly' ? 4 : 1);

/** Annual IRR (%) of equal monthly payments for `months` months followed by a single maturity amount one month later. Bisection. */
export function irrMonthlyToMaturity(monthly: Paise, months: number, maturity: Paise): number {
  const fv = (r: number) => { let s = 0; for (let i = 0; i < months; i++) s += monthly * Math.pow(1 + r, months - i); return s; };
  let lo = -0.01, hi = 0.05;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (fv(mid) > maturity) hi = mid; else lo = mid; }
  const mr = (lo + hi) / 2;
  return Math.round((Math.pow(1 + mr, 12) - 1) * 10000) / 100; // e.g. 4.37
}

export interface PolicyView {
  id: string; insurer: string; kind: Policy['kind']; name: string; cover: Paise; annualPremium: Paise; nextDue: string | null;
  daysToDue: number | null; projectedReturnPct?: { assumed: number; irr: number }[]; note?: string;
}

export function policyView(p: Policy, asOf: string): PolicyView {
  const v: PolicyView = {
    id: p.id, insurer: p.insurer, kind: p.kind, name: p.name, cover: p.sumAssured, annualPremium: annualPremium(p),
    nextDue: nextDueDate(p, asOf), daysToDue: null,
  };
  if (v.nextDue) v.daysToDue = daysBetween(asOf, v.nextDue);
  if ((p.kind === 'endowment' || p.kind === 'ulip') && p.illustrations?.length && p.termYears) {
    const months = p.termYears * 12;
    const monthly = p.premiumFreq === 'monthly' ? p.premium : Math.round(annualPremium(p) / 12);
    v.projectedReturnPct = p.illustrations.map((il) => ({ assumed: il.ratePct, irr: irrMonthlyToMaturity(monthly, months, il.value) }));
    v.note = "Return is computed from the insurer's own benefit illustration in this document; it is not guaranteed.";
  }
  return v;
}

export function nextDueDate(p: Policy, asOf: string): string | null {
  if (p.premiumFreq === 'monthly' && p.startDate) {
    let d = p.startDate; let k = 0;
    while (d <= asOf && k < 1200) { k++; d = addMonths(p.startDate, k); }
    return d;
  }
  return p.nextDue ?? null;
}

// ---- Claim helper (diagnosis of the policy's own terms; not a coverage guarantee) ----
const ILLNESS_ALIASES: [RegExp, string][] = [
  [/cataract|motiyabind|मोतियाबिंद/i, 'cataract'], [/hernia|हर्निया/i, 'hernia'], [/kidney stone|pathri|पथरी/i, 'kidney stones'],
  [/gall ?bladder|पित्त/i, 'gall bladder stones'], [/piles|bawaseer|बवासीर/i, 'piles'], [/sinus/i, 'sinusitis'], [/tonsil/i, 'tonsillectomy'],
  [/knee|घुटने/i, 'knee replacement'], [/joint replacement|hip replacement/i, 'joint replacement'],
  [/blood pressure|hypertension|\bbp\b|बीपी/i, 'hypertension'], [/dengue|डेंगू/i, 'dengue'], [/accident|दुर्घटना|fracture/i, 'accident'],
];

export interface ClaimPlan {
  policyId: string; insurer: string; member: string; memberCovered: boolean; condition: string;
  coveredNow: 'yes' | 'no' | 'check'; reasons: string[]; waitingEnds?: string;
  roomRentCapPerDay?: Paise; icuCapPerDay?: Paise; copayPct: number; sumInsured: Paise;
  intimateWithinHours?: number; intimationType: 'planned' | 'emergency'; tpa?: string; helpline?: string; claimsEmail?: string;
  documents: string[]; steps: string[];
}

export function normaliseCondition(text: string): string {
  for (const [re, name] of ILLNESS_ALIASES) if (re.test(text)) return name;
  return text.trim().toLowerCase() || 'unspecified';
}

export function claimPlan(p: Policy, memberText: string, conditionText: string, admission: 'planned' | 'emergency', admitDate: string): ClaimPlan {
  const h = p.health;
  if (!h) throw new Error('Not a health policy');
  const rel = normaliseRelation(memberText);
  const m = h.members.find((x) => x.relation.toLowerCase() === rel);
  const cond = normaliseCondition(conditionText);
  const reasons: string[] = [];
  let covered: ClaimPlan['coveredNow'] = m ? 'yes' : 'no';
  let waitingEnds: string | undefined;
  if (!m) reasons.push(`${cap(rel)} is not listed as an insured member on this policy.`);
  const start = h.firstStartDate ?? p.startDate;
  if (m && start) {
    if (cond !== 'accident' && h.initialWaitingDays && daysBetween(start, admitDate) < h.initialWaitingDays) {
      covered = 'no'; reasons.push(`Initial ${h.initialWaitingDays}-day waiting period has not ended.`);
    }
    if (h.specificIllnesses.some((x) => x.toLowerCase() === cond) && h.specificWaitingMonths) {
      waitingEnds = addMonths(start, h.specificWaitingMonths);
      if (admitDate < waitingEnds) { covered = 'no'; reasons.push(`${cap(cond)} has a ${h.specificWaitingMonths}-month waiting period; it ends on ${waitingEnds}.`); }
      else reasons.push(`${cap(cond)} waiting period of ${h.specificWaitingMonths} months is over.`);
    }
    if (h.pedDeclared && h.pedDeclared.toLowerCase().includes(cond) && h.pedWaitingMonths) {
      waitingEnds = addMonths(start, h.pedWaitingMonths);
      if (admitDate < waitingEnds) { covered = 'no'; reasons.push(`Declared pre-existing condition; ${h.pedWaitingMonths}-month waiting ends on ${waitingEnds}.`); }
    }
    if (covered === 'yes' && !h.specificIllnesses.some((x) => x.toLowerCase() === cond) && cond !== 'accident' && cond !== 'dengue') {
      covered = 'check'; reasons.push('Not in the policy\'s waiting-period lists; the TPA confirms admissibility at pre-authorisation.');
    }
  }
  const copay = m && h.copayAgeAbove !== undefined && m.age > h.copayAgeAbove ? h.copayPct ?? 0 : 0;
  const hours = admission === 'planned' ? h.intimationPlannedHours : h.intimationEmergencyHours;
  return {
    policyId: p.id, insurer: p.insurer, member: rel, memberCovered: !!m, condition: cond, coveredNow: covered, reasons, waitingEnds,
    roomRentCapPerDay: h.roomRentPctPerDay ? Math.round((p.sumAssured * h.roomRentPctPerDay) / 100) : undefined,
    icuCapPerDay: h.icuPctPerDay ? Math.round((p.sumAssured * h.icuPctPerDay) / 100) : undefined,
    copayPct: copay, sumInsured: p.sumAssured, intimateWithinHours: hours, intimationType: admission,
    tpa: h.tpa, helpline: h.helpline, claimsEmail: h.claimsEmail, documents: h.documents,
    steps: [
      admission === 'planned' ? `Inform the TPA at least ${hours ?? 48} hours before admission.` : `Inform the TPA within ${hours ?? 24} hours of admission.`,
      'At a network hospital, show the health card at the insurance desk and ask for cashless pre-authorisation.',
      'Choose a room within the room-rent limit, or the whole bill is reduced proportionately.',
      `Keep every original document; for reimbursement, file within ${h.reimbursementDays ?? 30} days of discharge.`,
    ],
  };
}

export function normaliseRelation(t: string): string {
  const s = t.toLowerCase();
  if (/papa|father|dad|पिता|पापा/.test(s)) return 'father';
  if (/mummy|mother|mom|maa|माँ|मम्मी|मां/.test(s)) return 'mother';
  if (/wife|husband|spouse|पत्नी|पति/.test(s)) return 'spouse';
  if (/self|me|myself|main|मैं|खुद/.test(s)) return 'self';
  return s.trim() || 'self';
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
