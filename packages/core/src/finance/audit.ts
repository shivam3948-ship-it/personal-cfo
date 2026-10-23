// "What am I missing? Where am I wrong? What can I do better?" — the money audit (D-051).
// One ranked list of what is costing the user money, in rupees a year, from what the engine already detects:
//   spending: unused memberships, duplicate and trial charges, price rises, bank fees, card finance charges, spikes
//   funds:    regular-plan fees, unbooked tax-free gains, funds trailing a plain index fund on the same dates
//   all:      both, plus the foundation gaps (cash flow, card debt, costly loans, safety net, cover)
// Pure and deterministic: the numbers are computed here, never by a model. Fund names only when `nameFunds` is true
// (test builds); real users get categories ("2 funds in regular plans").
import type { Dataset, Paise } from '../types';
import { sum } from '../money';
import { leaks, unusual } from './picture';
import { foundationPlan } from './advice';
import { xrayInsights } from '../portfolio/insights';
import { investingHabits } from '../portfolio/engine';
import { spokenDate } from '../dates';

export type AuditScope = 'all' | 'spending' | 'funds';
export interface Finding {
  area: 'spending' | 'card' | 'funds' | 'foundation';
  kind: string;
  what: string; whatHi: string;
  perYear: Paise | null;   // recurring cost, rupees a year (null when the cost isn't recurring)
  oneTime: Paise | null;   // a one-off amount at stake
  oneTimeLabel?: { en: string; hi: string }; // what that amount is: "behind", "less tax later"…
  fix: string; fixHi: string;
}
export interface Audit { scope: AuditScope; findings: Finding[]; checked: string[]; clean: string[] }

const byImpact = (a: Finding, b: Finding) => (b.perYear ?? 0) - (a.perYear ?? 0) || (b.oneTime ?? 0) - (a.oneTime ?? 0);

export function moneyAudit(ds: Dataset, scope: AuditScope, opts: { nameFunds: boolean } = { nameFunds: false }): Audit {
  const out: Finding[] = []; const checked: string[] = []; const clean: string[] = [];

  if (scope !== 'funds' && ds.txns.length) {
    checked.push('subscriptions and charges', 'card bills', 'spending spikes');
    const lk = leaks(ds).filter((l) => l.kind !== 'subscription'); // a plain subscription isn't a mistake; unused, duplicate, trial, price rise and fees are
    for (const l of lk) out.push({ area: 'spending', kind: l.kind, what: l.title, whatHi: l.titleHi, perYear: l.kind === 'duplicate' ? null : l.annualCost, oneTime: l.kind === 'duplicate' ? l.amount : null, oneTimeLabel: { en: 'charged twice', hi: 'दो बार कटे' },
      fix: l.actionHint === 'cancel' ? 'cancel it' : l.kind === 'duplicate' ? 'ask for the second charge back' : l.kind === 'trial_charge' ? 'cancel or ask for a refund' : l.kind === 'price_rise' ? 'decide if it is still worth it, or move to a cheaper plan' : 'ask the bank to waive or reverse it',
      fixHi: l.actionHint === 'cancel' ? 'इसे बंद करें' : l.kind === 'duplicate' ? 'दूसरी बार कटा पैसा वापस माँगें' : l.kind === 'trial_charge' ? 'बंद करें या रिफ़ंड माँगें' : l.kind === 'price_rise' ? 'देखें कि अब भी फ़ायदे का है, या सस्ता प्लान लें' : 'बैंक से माफ़ करने को कहें' });
    if (!lk.length) clean.push('no unused memberships, duplicate charges or bank fees');
    const fin = ds.cardStatements.filter((c) => c.charges > 0);
    if (fin.length) {
      const total = sum(fin.map((c) => c.charges));
      out.push({ area: 'card', kind: 'card_charges', what: `Card interest and fees: ${fin.length} bill${fin.length > 1 ? 's' : ''} with finance charges`, whatHi: `कार्ड पर ब्याज और फ़ीस: ${fin.length} बिल में फ़ाइनेंस चार्ज`,
        perYear: Math.round((total / ds.cardStatements.length) * 12), oneTime: null, fix: 'pay the full card bill by the due date', fixHi: 'कार्ड का पूरा बिल ड्यू डेट तक भरें' });
    } else if (ds.cardStatements.length) clean.push('card bills paid without interest');
    const spikes = unusual(ds).filter((u) => u.kind === 'category_spike' && u.baseline !== undefined).sort((a, b) => (b.amount - (b.baseline ?? 0)) - (a.amount - (a.baseline ?? 0))).slice(0, 2);
    for (const u of spikes) out.push({ area: 'spending', kind: 'spike', what: u.title, whatHi: u.titleHi, perYear: null, oneTime: u.amount - (u.baseline ?? 0), oneTimeLabel: { en: 'more than usual', hi: 'आम से ज़्यादा' },
      fix: `check what drove ${u.category} up`, fixHi: `देखें ${u.category} क्यों बढ़ा` });
  }

  const p = ds.portfolio;
  if (scope !== 'spending' && p?.holdings.length) {
    checked.push('plan type (regular vs direct)', 'tax-free gains', 'returns vs an index fund', 'SIP gaps');
    const x = xrayInsights(p.holdings, p.asOf);
    const regFunds = x.regular.rows.map((r) => r.fund);
    if (x.regular.feeTotal > 0) out.push({ area: 'funds', kind: 'regular_plans',
      what: `${regFunds.length} fund${regFunds.length > 1 ? 's' : ''} in regular plans${opts.nameFunds ? ` (${regFunds.join(', ')})` : ''}, paying extra commission`,
      whatHi: `${regFunds.length} फ़ंड रेगुलर प्लान में${opts.nameFunds ? ` (${regFunds.join(', ')})` : ''}, ज़्यादा कमीशन`,
      perYear: x.regular.feeTotal, oneTime: null,
      fix: 'move new SIPs to the direct plan of the same fund; switch old units when the tax works out', fixHi: 'नई SIP उसी फ़ंड के डायरेक्ट प्लान में करें; पुराने यूनिट टैक्स देखकर बदलें' });
    else clean.push('all funds in direct plans');
    if (x.harvest.harvest > 0 && x.harvest.usedKnown) out.push({ area: 'funds', kind: 'tax_free_gains', what: `Tax-free gains not booked this year, before ${spokenDate(x.harvest.deadline)}`, whatHi: `इस साल के टैक्स-फ़्री फ़ायदे अभी बुक नहीं, ${spokenDate(x.harvest.deadline, 'hi')} से पहले`,
      perYear: null, oneTime: x.harvest.taxSavedLater, oneTimeLabel: { en: 'less tax later', hi: 'बाद में कम टैक्स' }, fix: 'book long-term gains up to the tax-free limit before 31 March', fixHi: '31 मार्च से पहले टैक्स-फ़्री सीमा तक फ़ायदा बुक करें' });
    const behind = Object.entries(x.vsIndex).filter(([, z]) => z.diff < 0).sort((a, b) => a[1].diff - b[1].diff);
    if (behind.length) out.push({ area: 'funds', kind: 'trailing_index', what: `${behind.length} fund${behind.length > 1 ? 's' : ''}${opts.nameFunds ? ` (${behind.map(([k]) => k).join(', ')})` : ''} behind a plain index fund bought on the same dates`,
      whatHi: `${behind.length} फ़ंड${opts.nameFunds ? ` (${behind.map(([k]) => k).join(', ')})` : ''} उन्हीं तारीख़ों पर लिए इंडेक्स फ़ंड से पीछे`,
      perYear: null, oneTime: -sum(behind.map(([, z]) => z.diff)), oneTimeLabel: { en: 'behind', hi: 'पीछे' }, fix: 'compare its costs and style before adding more money to it', fixHi: 'इसमें और पैसा डालने से पहले खर्च और स्टाइल देखें' });
    const habits = investingHabits(p.holdings);
    if (habits.sipGaps > 0) out.push({ area: 'funds', kind: 'sip_gaps', what: `${habits.sipGaps} missed or paused SIP month${habits.sipGaps > 1 ? 's' : ''}`, whatHi: `${habits.sipGaps} महीने SIP छूटी`,
      perYear: null, oneTime: null, fix: 'keep SIPs running through market falls', fixHi: 'बाज़ार गिरने पर भी SIP चालू रखें' });
  } else if (scope === 'funds') checked.push('no mutual fund statement yet');

  if (scope === 'all') {
    checked.push('cash flow, debt, safety net and cover');
    for (const s of foundationPlan(ds).steps.filter((st) => st.status === 'todo').slice(0, 2))
      out.push({ area: 'foundation', kind: s.id, what: s.finding, whatHi: s.finding, perYear: null, oneTime: null, fix: s.recommendation, fixHi: s.recommendation });
  }

  // money first (recurring, then one-off), then the rest in the order found
  const money = out.filter((f) => f.perYear || f.oneTime).sort(byImpact), rest = out.filter((f) => !f.perYear && !f.oneTime);
  return { scope, findings: [...money, ...rest], checked, clean };
}

/** Future value of a regular investment: every day/month/year (paid at the start of each period) or once, at a fixed
 *  annual return compounded per period. Illustration only: real returns vary. */
export function sipValue(amount: Paise, every: 'day' | 'month' | 'year' | 'once', years: number, annualPct = 12): { invested: Paise; value: Paise; gain: Paise } {
  const r = annualPct / 100;
  if (every === 'once') { const value = Math.round(amount * Math.pow(1 + r, years)); return { invested: amount, value, gain: value - amount }; }
  const per = every === 'day' ? 365 : every === 'month' ? 12 : 1, n = Math.round(per * years);
  const i = Math.pow(1 + r, 1 / per) - 1;
  const value = Math.round(amount * ((Math.pow(1 + i, n) - 1) / i) * (1 + i));
  return { invested: amount * n, value, gain: value - amount * n };
}
