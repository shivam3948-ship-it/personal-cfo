'use client';
import { loadCas } from './cas';
import { pfFrom, xrayFrom, xrsFrom, gateXR } from '@/lib/views/portfolioBlocks';
import type { AdviceMode } from '@/lib/advice';
import { myDataset, loadStatements } from './statements';
import { buildSpendsMain } from '@/lib/views/spendsMain';
import { buildTransactions, buildCategory } from '@/lib/views/spends';
import { buildToday } from '@/lib/views/today';
import { buildTodayMine } from '@/lib/views/todayMine';
import { getProfile } from './profile';
import { emptyDataset } from '@core/types';
// Fold your on-phone CAS into the Invest and X-ray view models, in the browser, with the same code the server uses for the
// sample family. Overlap needs each fund's holdings, which we don't have for real funds yet (D-OPEN-3), so that card hides.

type View = Record<string, unknown>;
export async function withMyCasInvest(v: View): Promise<View> {
  const c = await loadCas(); if (!c) return v;
  return { ...v, PF: pfFrom(c), XRS: xrsFrom(xrayFrom(c, {}, 'no fund holdings yet')), CAS_SRC: 'yours', _mine: true };
}
export async function withMyCasXray(v: View): Promise<View> {
  const c = await loadCas(); if (!c) return v;
  const x = xrayFrom(c, {}, 'no fund holdings yet');
  return { ...v, PF: pfFrom(c), XR: gateXR(x.XR, (v.MODE as AdviceMode) ?? 'guided'), X3: x.X3, CAS_SRC: 'yours', _mine: true };
}

// ---- your bank and card statements → Spends, Transactions, Category (computed here, never sent) ----

const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (iso?: string) => (iso ? `${+iso.slice(8, 10)} ${MON3[+iso.slice(5, 7) - 1]}` : '');
export async function withMyStatementsSpends(v: View): Promise<View> {
  const ds = await myDataset();
  if (!ds) { // chose your own data, none added yet: the get-started state, dated today rather than the sample's month
    const now = new Date();
    return getProfile()?.start === 'mine' ? { ...v, META: { ...(v.META as object), cur: now.getMonth(), day: now.getDate() }, _state: 'empty', _mine: true } : v;
  }
  const built = buildSpendsMain(ds, { reportFrom: null });
  const files = (await loadStatements()).sort((a, b) => (a.period?.from ?? '').localeCompare(b.period?.from ?? '')).map((s) => ({
    name: `${s.account.label} · ${dmy(s.period?.from)}–${dmy(s.period?.to)}`, what: `${s.txns.length} transactions`,
    check: s.account.kind === 'bank' ? '✓ Balance matches on every line · opening + credits − debits = closing' : '✓ The bill’s total due matches' }));
  return { ...v, ...built, META: { ...built.META, files }, _mine: true };
}
export async function withMyStatementsTx(v: View): Promise<View> { const ds = await myDataset(); return ds ? { ...v, ...buildTransactions(ds), RULES0: 0, _mine: true } : v; }
export async function withMyStatementsCat(v: View): Promise<View> { const ds = await myDataset(); return ds ? { ...v, ...buildCategory(ds), _mine: true } : v; }

// ---- Today on your data (D-049) ----
// `_mine` tells Screen this view now shows your data (no Sample tag); `_state: 'empty'` shows the get-started state.
export async function withMyToday(v: View): Promise<View> {
  const p = getProfile();
  const [ds, cas] = await Promise.all([myDataset(), loadCas()]);
  if (!ds && !cas) return p?.start === 'mine' ? { ...v, NAME: p.name ?? '', _state: 'empty', _mine: true } : v;
  const mine = ds ?? emptyDataset('Your statements');
  if (cas) mine.portfolio = { asOf: cas.asOf, holdings: cas.holdings, checks: [], source: 'Your CAS' };
  const t = buildToday(mine, { kind: 'user', memberLabel: 'Me', displayName: p?.name ?? null });
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], now = new Date();
  const td = buildTodayMine(ds ?? mine);
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (td.bill && td.bill.dueIso < todayIso) td.bill = null; // its due date has passed on this phone's calendar
  return { ...v, ...t, NAME: p?.name ?? '', TD: { ...td, inv: !!cas, dateLine: `${DAYS[now.getDay()]}, ${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]}` }, _mine: true };
}
