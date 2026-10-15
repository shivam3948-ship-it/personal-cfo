// Email drafts filled from computed facts (no LLM), so every number in a draft is exact. The user reviews and sends.
import { inr } from './money';
import { spokenDate } from './dates';

export type DraftKind = 'cancel_subscription' | 'refund_request' | 'dispute_charge' | 'rate_reduction' | 'claim_intimation' | 'fee_waiver';

export interface DraftInput {
  kind: DraftKind;
  merchant?: string; amount?: number; date?: string; refundBy?: string; to?: string;
  cardLast4?: string; accountLast4?: string;
  loan?: { lender: string; last4: string; ratePct: number; outstanding: number; monthsLeft: number };
  offer?: { lender: string; ratePct: number; validTill?: string | null };
  saving?: number; score?: number;
  claim?: { insurer: string; policyLast4: string; member: string; condition: string; admission: string; admitDate: string; tpa?: string; documents: string[] };
  fees?: string[];
}

const sig = '\n\nRegards,\n[Your name]\n[Registered mobile]';

export function draftEmail(x: DraftInput): { to: string; subject: string; body: string } {
  switch (x.kind) {
    case 'cancel_subscription':
      return { to: x.to ?? `support@${slug(x.merchant)}.example`, subject: `Please cancel my ${x.merchant} membership`, body: `Hello ${x.merchant} team,\n\nPlease cancel my ${x.merchant} membership and stop all future auto-debits${x.amount ? ` of ${inr(x.amount, 'auto')}` : ''} with immediate effect. Please confirm the cancellation in writing.${sig}` };
    case 'refund_request':
      return { to: x.to ?? `billing@${slug(x.merchant)}.example`, subject: `Cancel and refund: ${x.merchant} charge of ${inr(x.amount ?? 0, 'auto')}`, body: `Hello ${x.merchant} team,\n\nMy free trial converted to a paid plan and ${inr(x.amount ?? 0, 'auto')} was charged${x.cardLast4 ? ` to my card ending ${x.cardLast4}` : ''}${x.date ? ` on ${spokenDate(x.date)}` : ''}. I did not intend to continue. As your email allows${x.refundBy ? ` cancellation with a full refund until ${spokenDate(x.refundBy)}` : ' cancellation within the refund window'}, please cancel the plan and refund the full amount to the original payment method.\n\nPlease confirm the refund reference.${sig}` };
    case 'dispute_charge':
      return { to: x.to ?? 'care@saffronbank.example', subject: `Duplicate debit of ${inr(x.amount ?? 0, 'auto')} to ${x.merchant}${x.date ? ` on ${spokenDate(x.date)}` : ''}`, body: `Dear Customer Care,\n\nMy account${x.accountLast4 ? ` ending ${x.accountLast4}` : ''} was debited twice for the same ${x.merchant} payment of ${inr(x.amount ?? 0, 'auto')}${x.date ? ` on ${spokenDate(x.date)}` : ''}. I authorised only one payment. Please raise a dispute for the duplicate debit and reverse ${inr(x.amount ?? 0, 'auto')} to my account.\n\nPlease share the complaint reference number.${sig}` };
    case 'rate_reduction': {
      const l = x.loan!; const o = x.offer;
      return { to: x.to ?? `care@${slug(l.lender)}.example`, subject: `Request to reduce the interest rate on loan XXXX${l.last4}`, body: `Dear ${l.lender} team,\n\nI have repaid every EMI on time on my loan ending ${l.last4} (current rate ${l.ratePct}% p.a., outstanding about ${inr(l.outstanding)}, ${l.monthsLeft} EMIs left).${x.score ? ` My credit score is ${x.score}.` : ''}${o ? ` I have a pre-approved offer from ${o.lender} at ${o.ratePct}% p.a.${o.validTill ? ` valid till ${spokenDate(o.validTill)}` : ''}.` : ''}\n\nI would prefer to stay with you. Please review my loan and reduce the rate${o ? ` to ${o.ratePct}% p.a.` : ''}${x.saving ? `; at that rate my interest over the remaining tenure falls by about ${inr(x.saving)}` : ''}. Please let me know the process and any charges.${sig}` };
    }
    case 'claim_intimation': {
      const c = x.claim!;
      return { to: x.to ?? 'claims@tpa.example', subject: `Claim intimation: policy XXXX${c.policyLast4}, ${c.member}, ${c.admission} hospitalisation`, body: `Dear ${c.tpa ?? 'Claims team'},\n\nI am intimating a ${c.admission} hospitalisation under ${c.insurer} policy ending ${c.policyLast4}.\n\nPatient: ${c.member} (insured member)\nReason: ${c.condition}\nAdmission date: ${spokenDate(c.admitDate)}\nHospital: [hospital name, city]\n\nPlease register the claim and share the claim reference and cashless pre-authorisation steps. Documents I will keep ready: ${c.documents.join('; ')}.${sig}` };
    }
    case 'fee_waiver':
      return { to: x.to ?? 'care@saffronbank.example', subject: 'Request to waive account charges', body: `Dear Customer Care,\n\nThe following charges were debited from my account${x.accountLast4 ? ` ending ${x.accountLast4}` : ''}: ${(x.fees ?? []).join('; ')}. I have been a regular customer with salary credits every month. Please waive and reverse these charges as a goodwill gesture.${sig}` };
  }
}
const slug = (s?: string) => (s ?? 'merchant').toLowerCase().replace(/[^a-z0-9]+/g, '');
