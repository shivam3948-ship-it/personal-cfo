// The server accepts only this shape from the browser's CAS parser: no free text beyond scheme/AMC names, no identifiers.
import type { CasCheck, Holding } from './cas';
import type { PortfolioData } from '../types';

const PAN = /[A-Z]{5}\d{4}[A-Z]/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max && !PAN.test(v) ? v : null);
const fin = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const int = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) ? v : null);

export function validatePortfolio(body: unknown): { ok: true; data: PortfolioData } | { ok: false; error: string } {
  const b = body as { asOf?: unknown; holdings?: unknown; checks?: unknown; source?: unknown };
  if (!b || typeof b !== 'object') return { ok: false, error: 'Bad body' };
  if (typeof b.asOf !== 'string' || !DATE.test(b.asOf)) return { ok: false, error: 'asOf must be YYYY-MM-DD' };
  if (!Array.isArray(b.holdings) || b.holdings.length === 0 || b.holdings.length > 100) return { ok: false, error: '1–100 holdings' };
  const holdings: Holding[] = [];
  for (const raw of b.holdings as Record<string, unknown>[]) {
    const isin = str(raw.isin, 12); const scheme = str(raw.scheme, 200); const amc = str(raw.amc ?? '', 120); const category = str(raw.category, 40);
    const plan = raw.plan === 'Direct' || raw.plan === 'Regular' ? raw.plan : null;
    const asset = ['equity', 'debt', 'hybrid', 'gold', 'other'].includes(raw.asset as string) ? (raw.asset as Holding['asset']) : null;
    const units = fin(raw.units); const nav = fin(raw.nav); const cost = int(raw.cost); const value = int(raw.value);
    const navDate = typeof raw.navDate === 'string' && (raw.navDate === '' || DATE.test(raw.navDate)) ? raw.navDate : null;
    if (!isin || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) || !scheme || amc === null || !category || !plan || !asset || units === null || nav === null || cost === null || value === null || navDate === null) return { ok: false, error: `Bad holding ${String(raw.isin ?? '')}` };
    if (!Array.isArray(raw.flows) || raw.flows.length > 2000) return { ok: false, error: 'Bad flows' };
    const flows = [];
    for (const f of raw.flows as Record<string, unknown>[]) {
      const amount = int(f.amount);
      if (typeof f.date !== 'string' || !DATE.test(f.date) || amount === null) return { ok: false, error: 'Bad flow' };
      flows.push({ date: f.date, amount });
    }
    holdings.push({ isin, scheme, amc, plan, category, asset, units, nav, navDate, cost, value, flows });
  }
  const checks: CasCheck[] = Array.isArray(b.checks) ? (b.checks as Record<string, unknown>[]).slice(0, 300).map((c) => ({ id: String(c.id ?? '').slice(0, 40), label: String(c.label ?? '').slice(0, 200), ok: c.ok === true, detail: String(c.detail ?? '').slice(0, 200) })).filter((c) => !PAN.test(c.label + c.detail)) : [];
  return { ok: true, data: { asOf: b.asOf, holdings, checks, source: str(b.source, 60) ?? 'Your CAS' } };
}
