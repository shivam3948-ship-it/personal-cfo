// Invest and Portfolio x-ray view models: the data blocks the compiled design screens read (same names and shapes as
// designs/design-data.json), computed from @munim/core. All maths here or in core; screens only format.
import fs from 'node:fs';
import path from 'node:path';
import type { Dataset } from '@core/types';
import { DATA_DIR } from '@core/demo';
import { latestBankBalance } from '@core/finance/picture';
import { essentialsByMonth, monthlyIncome } from '@core/finance/essentials';
import { policyView } from '@core/finance/insurance';
import { DISCLAIMER, type Session } from '../session';
import { pfFrom, xrayFrom, xrsFrom, gateXR } from './portfolioBlocks';

type Mode = Pick<Session, 'adviceMode'>;
const SAMPLE: Mode = { adviceMode: 'demo' };

const sampleHoldings = (): Record<string, Record<string, number>> => {
  const f = path.join(DATA_DIR, 'demo-cas', 'sample_holdings_synthetic.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).funds : {};
};

export const pfBlock = (ds: Dataset) => (ds.portfolio ? pfFrom(ds.portfolio) : null);
export const buildXrayBlocks = (ds: Dataset) => (ds.portfolio ? xrayFrom(ds.portfolio, sampleHoldings(), 'synthetic sample holdings') : null);

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
    XRS: xr ? xrsFrom(xr) : null,
    DISC: DISCLAIMER[s.adviceMode].en,
    CAS_SRC: 'sample',
  };
}

export function buildXray(ds: Dataset, s: Mode = SAMPLE) {
  const xr = buildXrayBlocks(ds);
  const XR = xr ? gateXR(xr.XR, s.adviceMode) : null;
  return { PF: pfBlock(ds), XR, X3: xr?.X3 ?? null, MODE: s.adviceMode, DISC: DISCLAIMER[s.adviceMode].en, CAS_SRC: 'sample' };
}
