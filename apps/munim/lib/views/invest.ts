// Invest and Portfolio x-ray view models: the data blocks the compiled design screens read (same names and shapes as
// designs/design-data.json), computed from @munim/core. All maths here or in core; screens only format.
import fs from 'node:fs';
import path from 'node:path';
import type { Dataset } from '@core/types';
import { DATA_DIR } from '@core/demo';
import { latestBankBalance } from '@core/finance/picture';
import { essentialsByMonth, monthlyIncome } from '@core/finance/essentials';
import { policyView } from '@core/finance/insurance';
import { portfolioView, fundGrowth, investingHabits } from '@core/portfolio/engine';
import { xrayInsights, overlap, fdComparison } from '@core/portfolio/insights';
import { DISCLAIMER, namesFunds, type Session } from '../session';

type Mode = Pick<Session, 'adviceMode'>;
const SAMPLE: Mode = { adviceMode: 'demo' };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (s: string) => s.replace(/ Fund$/, '');
const sampleHoldings = (): Record<string, Record<string, number>> => {
  const f = path.join(DATA_DIR, 'demo-cas', 'sample_holdings_synthetic.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).funds : {};
};

/** PF block: portfolio value, cost, XIRR and per fund [name, plan, category, asset, value, your XIRR, first buy, NAV then, NAV now, extra fee/yr]. */
export function pfBlock(ds: Dataset) {
  const p = ds.portfolio; if (!p) return null;
  const v = portfolioView(p.holdings, p.asOf);
  const habits = investingHabits(p.holdings);
  const byIsin = new Map(p.holdings.map((h) => [h.isin, h]));
  return {
    value: v.value, cost: v.cost, xirr: v.xirrPct, sipGaps: habits.sipGaps, sells: habits.sells,
    since: habits.since ? `${MON[Number(habits.since.slice(5, 7)) - 1]} ${habits.since.slice(0, 4)}` : null,
    funds: v.funds.map((f) => { const g = fundGrowth(byIsin.get(f.isin)!, p.asOf);
      return [short(f.shortName), f.plan, f.category, f.asset, f.value, f.xirrPct, g?.firstDate ?? null, g?.navThen ?? null, g?.navNow ?? null, f.estExtraCostPerYear]; }),
  };
}

export function buildXrayBlocks(ds: Dataset) {
  const p = ds.portfolio; if (!p) return null;
  const x = xrayInsights(p.holdings, p.asOf);
  const o = overlap(p.holdings, sampleHoldings());
  const fd = fdComparison(p.holdings, p.asOf);
  const c = x.harvest.combo, months = 3;
  return {
    XR: { harvest: x.harvest, regular: x.regular, elss: x.elss, vsIndex: x.vsIndex },
    X3: { overlap: { ...o, asOf: 'synthetic sample holdings' }, fd,
      // "Did it work?" preview: what cards 1–2 would show 3 months after acting (labelled Preview in the UI; no actions are tracked yet)
      did: { months, movedPaise: c.value, feeSavedSoFar: Math.round((c.feeSavedYr * months) / 12), futureTax: c.futureTax, sipDirect: x.regular.sipReg * months } },
    count: [x.harvest.harvest > 0, x.regular.feeTotal > 0, o.pairs.length > 0, !!x.elss?.freeValue, Object.keys(x.vsIndex).length > 0].filter(Boolean).length,
  };
}

export function buildInvest(ds: Dataset, s: Mode = SAMPLE) {
  const term = ds.policies.find((q) => q.kind === 'term');
  const endow = ds.policies.find((q) => q.kind === 'endowment' || q.kind === 'ulip');
  const irr = endow ? policyView(endow, ds.portfolio?.asOf ?? '2026-10-15').projectedReturnPct?.map((r) => r.irr) ?? [] : [];
  const xr = buildXrayBlocks(ds);
  return {
    ESSM: essentialsByMonth(ds),
    BANK: latestBankBalance(ds)?.balance ?? 0,
    PF: pfBlock(ds),
    INCOME_M: monthlyIncome(ds),
    TERM_COVER: term?.sumAssured ?? 0,
    ENDOW: irr.length ? { irrLo: Math.min(...irr), irrHi: Math.max(...irr) } : null,
    SAVED_WITH_MUNIM: 0, // the savings pot: nothing saved through Munim in the sample (no pot data yet)
    XRS: xr ? { count: xr.count, taxSave: xr.XR.harvest.taxSavedLater, feeYr: xr.XR.regular.feeTotal, fdExtra: xr.X3.fd.extra } : null,
    DISC: DISCLAIMER[s.adviceMode].en,
  };
}

export function buildXray(ds: Dataset, s: Mode = SAMPLE) {
  const xr = buildXrayBlocks(ds);
  // Outside demo/internal/advised the named-fund plan never leaves the server (docs/12 rung 3): no fund names in the combo.
  const XR = xr && !namesFunds(s.adviceMode) ? { ...xr.XR, harvest: { ...xr.XR.harvest, combo: { ...xr.XR.harvest.combo, funds: [] } } } : xr?.XR ?? null;
  return { PF: pfBlock(ds), XR, X3: xr?.X3 ?? null, MODE: s.adviceMode, DISC: DISCLAIMER[s.adviceMode].en };
}
