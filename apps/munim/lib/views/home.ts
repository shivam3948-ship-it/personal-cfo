import type { Dataset } from '@core/types';
import { inr, sum } from '@core/money';
import { asOfDate, cashflowCheck, creditView, latestBankBalance, leaks, recurring } from '@core/finance/picture';
import { loanStatus } from '@core/finance/loans';
import { annualPremium } from '@core/finance/insurance';
import { portfolioView } from '@core/portfolio/engine';
import { fig } from '../figure';
import type { Session } from '../session';
import type { HomeView, Tile, TopItem } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const day = (iso: string) => { const d = new Date(iso + 'T00:00:00Z'); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const dateLabel = (iso: string) => `${DAYS[new Date(iso + 'T00:00:00Z').getUTCDay()]}, ${day(iso)}`;

export function buildHome(ds: Dataset, s: Pick<Session, 'kind' | 'memberLabel' | 'displayName'>): HomeView {
  const asOf = asOfDate(ds);
  const pv = ds.portfolio?.holdings.length ? portfolioView(ds.portfolio.holdings, ds.portfolio.asOf) : null;
  const bank = latestBankBalance(ds);
  const loans = ds.loans.map((l) => ({ l, st: loanStatus(l, asOf) }));
  const owed = sum(loans.map((x) => x.st.outstanding));
  const hasAny = !!pv || !!bank || loans.length > 0;

  const inv = pv?.value ?? 0; const bal = bank?.balance ?? 0; const total = inv + bal - owed;
  const bankFile = ds.txns.filter((t) => t.account.startsWith('bank:') && t.balance !== undefined).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.sourceFile;
  const netWorth = hasAny ? {
    total: fig(inr(total), total, {
      formula: 'Investments + Bank − Loans outstanding',
      parts: [{ label: 'Investments', text: inr(inv) }, { label: 'Bank', text: inr(bal) }, { label: 'Loans outstanding', text: `−${inr(owed)}` }],
      sources: [ds.portfolio?.source, bankFile, ...loans.map((x) => x.l.file)].filter((x): x is string => !!x),
      asOf,
    }),
    investments: fig(inr(inv), inv), bank: fig(inr(bal), bal), loans: fig(owed ? `−${inr(owed)}` : inr(0), -owed),
    notIncluded: 'Property, gold, PF/PPF, FDs and accounts you have not added.',
  } : null;

  // Top 3: the biggest due before salary first (it has a date), then leaks and plan costs by rupees per year.
  const cf = cashflowCheck(ds);
  const top: TopItem[] = [];
  const bigDue = [...cf.dues].sort((a, b) => b.amount - a.amount)[0];
  if (bigDue) top.push({ id: 'due', reason: 'due', title: `${bigDue.title} due ${day(bigDue.date)}`, amount: inr(bigDue.amount), tone: 'neutral', href: '/money',
    sub: cf.balanceAfterDues === null ? 'Add a bank statement to check it is covered' : cf.balanceAfterDues >= 0 ? `Bank covers it; ${inr(cf.balanceAfterDues)} left after all dues` : `Bank falls short by ${inr(-cf.balanceAfterDues)} before salary` });
  const costs: (TopItem & { perYear: number })[] = leaks(ds).filter((l) => l.kind !== 'subscription').map((l, i) => ({
    id: `leak-${i}`, reason: 'leak', title: l.title, sub: l.deadline ? `Act by ${day(l.deadline)}` : 'Still charging every month',
    amount: `${inr(l.annualCost)}/yr`, tone: 'bad', href: '/money/subscriptions', perYear: l.annualCost }));
  if (pv?.regular.funds) costs.push({ id: 'regular', reason: 'fees', title: `${pv.regular.funds} ${pv.regular.funds === 1 ? 'fund' : 'funds'} in regular plans`, sub: 'Extra cost vs direct plans (estimate)',
    amount: `~${inr(pv.regular.estExtraCostPerYear)}/yr`, tone: 'bad', href: '/invest', perYear: pv.regular.estExtraCostPerYear });
  for (const c of costs.sort((a, b) => b.perYear - a.perYear)) { if (top.length >= 3) break; const { perYear: _drop, ...item } = c; void _drop; top.push(item); }

  const cr = creditView(ds);
  const subs = recurring(ds).filter((r) => r.category === 'Subscriptions' || r.category === 'Fitness');
  const tiles: Tile[] = [
    { label: `Loans · ${ds.loans.length}`, value: ds.loans.length ? `${inr(sum(ds.loans.map((l) => l.emi)))}/mo` : 'Add loan papers', href: '/loans', empty: !ds.loans.length },
    { label: `Insurance · ${ds.policies.length}`, value: ds.policies.length ? `${inr(sum(ds.policies.map(annualPremium)))}/yr` : 'Add policies', href: '/protect', empty: !ds.policies.length },
    cr ? { label: 'Credit score', value: String(cr.score), href: '/credit', ...(typeof cr.change === 'number' && cr.change !== 0 ? { delta: { text: `${cr.change > 0 ? '+' : ''}${cr.change}`, tone: cr.change < 0 ? 'bad' as const : 'good' as const } } : {}) }
       : { label: 'Credit score', value: 'Add a report', href: '/credit', empty: true },
    { label: `Subscriptions · ${subs.length}`, value: subs.length ? `${inr(sum(subs.map((x) => x.annualCost)))}/yr` : 'None found', href: '/money/subscriptions', empty: !subs.length },
  ];

  return {
    asOf, dateLabel: dateLabel(asOf), greeting: s.displayName ? `Namaste, ${s.displayName}` : 'Namaste',
    memberLabel: s.memberLabel, isSample: s.kind === 'sample', netWorth, top, tiles,
  };
}
