// The Credit tab's view (D-094, 8 Nov): what you owe, what's due next, each card and loan, and the credit score when a report
// exists. Numbers from @core/finance/credit; this file only words them, in English and Hindi. Facts and how card interest
// works, nothing about which product to take (docs/03 §3 is about securities; no lender or card is suggested).
import type { Dataset } from '@core/types';
import { creditPicture } from '@core/finance/credit';
import { inr } from '@core/money';
import { billLines } from './todayMine';
import { cleanMerchant } from './spends';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
const dm = (iso: string) => `${+iso.slice(8, 10)} ${MON[+iso.slice(5, 7) - 1]}`;
const dmHi = (iso: string) => `${+iso.slice(8, 10)} ${MON_HI[+iso.slice(5, 7) - 1]}`;
const my = (iso: string) => `${MON[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const myHi = (iso: string) => `${MON_HI[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const R0 = (p: number) => inr(Math.round(p / 100) * 100); // whole rupees for totals
const ord = (d: number) => `${d}${d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'}`;
const LOAN: Record<string, [string, string]> = { car: ['Car loan', 'कार लोन'], personal: ['Personal loan', 'पर्सनल लोन'], home: ['Home loan', 'होम लोन'], education: ['Education loan', 'एजुकेशन लोन'], other: ['Loan', 'लोन'] };

export function buildCredit(ds: Dataset, _s?: unknown, today?: string) {
  const c = creditPicture(ds, today);
  const cards = c.cards.map((b) => {
    const l = billLines(b, b.label);
    const cost = b.charges > 0 || b.carried > 0
      ? { en: `${b.charges > 0 ? `${R0(b.charges)} in interest and fees on your last ${b.statements} statement${b.statements === 1 ? '' : 's'}` : 'No interest charged'}${b.carried ? ` · ${b.carried} of the last ${b.cyclesChecked} bills not paid in full` : ''}`,
        hi: `${b.charges > 0 ? `पिछले ${b.statements} स्टेटमेंट में ${R0(b.charges)} ब्याज और फ़ीस` : 'कोई ब्याज नहीं लगा'}${b.carried ? ` · पिछले ${b.cyclesChecked} में से ${b.carried} बिल पूरे नहीं भरे` : ''}` }
      : b.cyclesChecked ? { en: `Earlier bills paid in full (${b.cyclesChecked} of ${b.cyclesChecked} we can see), no interest charged`, hi: `पिछले बिल पूरे भरे (जितने दिखते हैं, ${b.cyclesChecked} में से ${b.cyclesChecked}), कोई ब्याज नहीं लगा` } : null;
    return { ...l, nameHi: l.name.replace(/credit card/i, 'क्रेडिट कार्ड'), warnCost: b.charges > 0 || b.carried > 0, cost: cost?.en ?? '', costHi: cost?.hi ?? '', hasCost: !!cost };
  });
  const loans = c.loans.map((l) => ({
    name: l.lender, kind: LOAN[l.type][0], kindHi: LOAN[l.type][1], emi: `${R0(l.emi)} a month`, emiHi: `${R0(l.emi)} हर महीने`,
    left: `${R0(l.outstanding)} left · ${l.emisLeft} EMIs · ends ${my(l.endDate)}`, leftHi: `${R0(l.outstanding)} बाक़ी · ${l.emisLeft} EMI · ${myHi(l.endDate)} तक`,
    rate: `${l.ratePct}% a year`, rateHi: `${l.ratePct}% सालाना`,
    interest: `about ${R0(l.interestLeft)} of interest still to pay, if every EMI is paid on time at today’s rate`, interestHi: `लगभग ${R0(l.interestLeft)} ब्याज और, अगर हर EMI समय पर और इसी दर पर भरें`,
  }));
  const seen = c.seenEmis.map((e) => ({
    name: cleanMerchant(e.payee).replace(/\b\d{6,}\b/g, '').trim(), line: `${R0(e.amount)} every month, around the ${ord(e.day)} · seen in ${e.months} months`, lineHi: `हर महीने क़रीब ${e.day} तारीख़ को ${R0(e.amount)} · ${e.months} महीनों में दिखा`,
  }));
  const due = c.due.map((d) => ({ date: `${d.approx ? '~' : ''}${dm(d.date)}`, dateHi: `${d.approx ? '~' : ''}${dmHi(d.date)}`, label: d.kind === 'emi' && d.approx ? cleanMerchant(d.label).replace(/\b\d{6,}\b/g, '').trim() : d.label, what: d.kind === 'card' ? 'Card bill' : 'EMI', whatHi: d.kind === 'card' ? 'कार्ड बिल' : 'EMI', amount: inr(d.amount, 'auto') }));
  const sc = c.score;
  const score = sc ? {
    score: sc.score, asOf: sc.asOf,
    change: sc.change === null ? '' : sc.change < 0 ? `down ${-sc.change} since the last report` : sc.change > 0 ? `up ${sc.change} since the last report` : 'no change since the last report',
    changeHi: sc.change === null ? '' : sc.change < 0 ? `पिछली रिपोर्ट से ${-sc.change} कम` : sc.change > 0 ? `पिछली रिपोर्ट से ${sc.change} ज़्यादा` : 'पिछली रिपोर्ट जितना',
    down: (sc.change ?? 0) < 0,
    util: sc.utilisationReported !== null ? `Card use on the report: ${sc.utilisationReported}% of your limit` : '', utilHi: sc.utilisationReported !== null ? `रिपोर्ट में कार्ड इस्तेमाल: लिमिट का ${sc.utilisationReported}%` : '',
    enq: sc.enquiriesLast90Days.length ? `${sc.enquiriesLast90Days.length} new loan or card application${sc.enquiriesLast90Days.length === 1 ? '' : 's'} in 90 days` : '',
    enqHi: sc.enquiriesLast90Days.length ? `90 दिन में ${sc.enquiriesLast90Days.length} नए लोन या कार्ड आवेदन` : '',
  } : null;
  return {
    CR: {
      has: cards.length + loans.length + seen.length > 0, anyData: ds.txns.length > 0, unseenLoans: c.owe.unseenLoans,
      owe: R0(c.owe.total), oweCards: R0(c.owe.cards), oweLoans: R0(c.owe.loans), hasLoans: c.owe.loans > 0,
      monthly: c.monthlyEmi ? R0(c.monthlyEmi) : '', share: c.emiShareOfSalary,
      due, cards, loans, seen, score, asOf: c.asOf,
    },
  };
}
