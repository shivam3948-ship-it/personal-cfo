// Today view model: the money figures and safety-net numbers the compiled Today screen (designs/Main) reads.
// Same names as the design's sample data (M0, ESS, EMG); every figure from @munim/core, so Today and Invest always agree.
import type { Dataset } from '@core/types';
import type { Session } from '../session';
import { inr } from '@core/money';
import { safetyNet } from '@core/finance/essentials';
import { portfolioView } from '@core/portfolio/engine';
import { buildHome } from './home';

const rupees = (p: number) => Math.round(p / 100);

export function buildToday(ds: Dataset, s: Session) {
  const home = buildHome(ds, s);
  const nw = home.netWorth;
  const pv = ds.portfolio?.holdings.length ? portfolioView(ds.portfolio.holdings, ds.portfolio.asOf) : null;
  const sn = safetyNet(ds, 6);
  return {
    M0: {
      card: home.top.find((t) => t.id === 'due')?.amount ?? '₹0',
      total: nw?.total.text ?? '₹0', inv: nw?.investments.text ?? '₹0', bank: nw?.bank.text ?? '₹0', loans: nw?.loans.text ?? '₹0',
      gain: pv ? inr(pv.value - pv.cost) : '₹0',
    },
    ESS: rupees(sn.essentialsPerMonth),                       // the design works in whole rupees
    EMG: { saved: rupees(sn.have), target: rupees(sn.target) },
  };
}
