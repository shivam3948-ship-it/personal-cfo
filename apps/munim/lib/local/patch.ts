'use client';
import { loadCas } from './cas';
import { pfFrom, xrayFrom, xrsFrom, gateXR } from '@/lib/views/portfolioBlocks';
import type { AdviceMode } from '@/lib/advice';
import { myDataset, loadStatements } from './statements';
import { buildSpendsMain } from '@/lib/views/spendsMain';
import { buildTransactions, buildCategory } from '@/lib/views/spends';
// Fold your on-phone CAS into the Invest and X-ray view models, in the browser, with the same code the server uses for the
// sample family. Overlap needs each fund's holdings, which we don't have for real funds yet (D-OPEN-3), so that card hides.

type View = Record<string, unknown>;
export async function withMyCasInvest(v: View): Promise<View> {
  const c = await loadCas(); if (!c) return v;
  return { ...v, PF: pfFrom(c), XRS: xrsFrom(xrayFrom(c, {}, 'no fund holdings yet')), CAS_SRC: 'yours' };
}
export async function withMyCasXray(v: View): Promise<View> {
  const c = await loadCas(); if (!c) return v;
  const x = xrayFrom(c, {}, 'no fund holdings yet');
  return { ...v, PF: pfFrom(c), XR: gateXR(x.XR, (v.MODE as AdviceMode) ?? 'guided'), X3: x.X3, CAS_SRC: 'yours' };
}

// ---- your bank and card statements → Spends, Transactions, Category (computed here, never sent) ----

const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (iso?: string) => (iso ? `${+iso.slice(8, 10)} ${MON3[+iso.slice(5, 7) - 1]}` : '');
export async function withMyStatementsSpends(v: View): Promise<View> {
  const ds = await myDataset(); if (!ds) return v;
  const built = buildSpendsMain(ds, { reportFrom: null });
  const files = (await loadStatements()).sort((a, b) => (a.period?.from ?? '').localeCompare(b.period?.from ?? '')).map((s) => ({
    name: `${s.account.label} · ${dmy(s.period?.from)}–${dmy(s.period?.to)}`, what: `${s.txns.length} transactions`,
    check: s.account.kind === 'bank' ? '✓ Balance matches on every line · opening + credits − debits = closing' : '✓ The bill’s total due matches' }));
  return { ...v, ...built, META: { ...built.META, files } };
}
export async function withMyStatementsTx(v: View): Promise<View> { const ds = await myDataset(); return ds ? { ...v, ...buildTransactions(ds), RULES0: 0 } : v; }
export async function withMyStatementsCat(v: View): Promise<View> { const ds = await myDataset(); return ds ? { ...v, ...buildCategory(ds) } : v; }
