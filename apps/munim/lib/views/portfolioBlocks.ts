// Portfolio blocks for Invest and X-ray (PF, XR, X3, XRS), from holdings alone. Pure: no Node APIs, so the phone can
// compute them from a CAS read on the device (lib/local) with the same code the server uses for the sample family.
import type { Holding } from '@core/portfolio/cas';
import { portfolioView, fundGrowth, investingHabits } from '@core/portfolio/engine';
import { xrayInsights, overlap, fdComparison } from '@core/portfolio/insights';
import { namesFunds, type AdviceMode } from '../advice';

export interface Portfolio { asOf: string; holdings: Holding[] }
export type Weights = Record<string, Record<string, number>>; // fund short name → stock → % of the fund

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (s: string) => s.replace(/ Fund$/, '');

/** PF block: portfolio value, cost, XIRR and per fund [name, plan, category, asset, value, your XIRR, first buy, NAV then, NAV now, extra fee/yr]. */
export function pfFrom(p: Portfolio) {
  const v = portfolioView(p.holdings, p.asOf);
  const habits = investingHabits(p.holdings);
  const byIsin = new Map(p.holdings.map((h) => [h.isin, h]));
  return {
    asOf: p.asOf, value: v.value, cost: v.cost, xirr: v.xirrPct, sipGaps: habits.sipGaps, sells: habits.sells,
    since: habits.since ? `${MON[Number(habits.since.slice(5, 7)) - 1]} ${habits.since.slice(0, 4)}` : null,
    funds: v.funds.map((f) => { const g = fundGrowth(byIsin.get(f.isin)!, p.asOf);
      return [short(f.shortName), f.plan, f.category, f.asset, f.value, f.xirrPct, g?.firstDate ?? null, g?.navThen ?? null, g?.navNow ?? null, f.estExtraCostPerYear]; }),
  };
}

/** X-ray blocks. `weights` are fund holdings for the overlap card (sample only today; real disclosures later: D-OPEN-3). */
export function xrayFrom(p: Portfolio, weights: Weights, weightsLabel: string) {
  const x = xrayInsights(p.holdings, p.asOf);
  const o = overlap(p.holdings, weights);
  const fd = fdComparison(p.holdings, p.asOf);
  const c = x.harvest.combo, months = 3;
  return {
    XR: { harvest: x.harvest, regular: x.regular, elss: x.elss, vsIndex: x.vsIndex },
    X3: { overlap: { ...o, asOf: weightsLabel }, fd,
      // "Did it work?" preview: what the tax and costs cards would show 3 months after acting (labelled Preview; no actions tracked yet)
      did: { months, movedPaise: c.value, feeSavedSoFar: Math.round((c.feeSavedYr * months) / 12), futureTax: c.futureTax, sipDirect: x.regular.sipReg * months } },
    // same conditions as the X-ray screen uses to show each card
    count: [x.harvest.harvest > 0, x.regular.feeTotal > 0, o.pairs.some((q) => q[2] > 0), !!x.elss?.freeValue, Object.keys(x.vsIndex).length > 0].filter(Boolean).length,
  };
}

/** Outside demo/internal/advised the named-fund plan never leaves the server or the engine (docs/12 rung 3). */
export function gateXR<T extends { harvest: { combo: { funds: string[] } } }>(XR: T, mode: AdviceMode): T {
  return namesFunds(mode) ? XR : { ...XR, harvest: { ...XR.harvest, combo: { ...XR.harvest.combo, funds: [] } } };
}

/** The Invest summary row for the X-ray. */
export const xrsFrom = (xr: ReturnType<typeof xrayFrom>) => ({ count: xr.count, taxSave: xr.XR.harvest.taxSavedLater, feeYr: xr.XR.regular.feeTotal, fdExtra: xr.X3.fd.extra });
