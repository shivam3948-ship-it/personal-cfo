// Mutual fund CAS (CAMS / KFintech detailed statement) → holdings. Runs in the browser and on the server (pure TS, no Node APIs).
// Output carries no PAN, name, email, address or folio number: only scheme, ISIN, units, NAV, value and dated cash flows.
// Every number is reconciled against the statement's own totals; a fund whose units do not walk is flagged, never silently fixed.
import type { Paise } from '../types';

export type AssetClass = 'equity' | 'debt' | 'hybrid' | 'gold' | 'other';
export interface Flow { date: string; amount: Paise; nav?: number } // invest = negative, redeem = positive (XIRR sign convention); nav = the transaction's NAV when the CAS prints it
export interface Holding {
  isin: string; scheme: string; amc: string; plan: 'Direct' | 'Regular';
  category: string; asset: AssetClass;
  units: number; nav: number; navDate: string;
  cost: Paise; value: Paise; flows: Flow[];
}
export interface CasCheck { id: string; label: string; ok: boolean; detail: string }
export interface CasResult { asOf: string; holdings: Holding[]; checks: CasCheck[]; printedTotal: Paise | null; kind: 'detailed' | 'summary' | 'unknown' }

const MON: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
export const casDate = (s: string): string => { const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim()); return m ? `${m[3]}-${MON[m[2].toLowerCase()]}-${m[1]}` : ''; };
/** "(1,234.50)" or "-1,234.50" → -1234.5 */
const num = (s: string): number => { const neg = /^\(.*\)$/.test(s) || s.startsWith('-'); const v = Number(s.replace(/[(),\s-]/g, '')); return neg ? -v : v; };
const paise = (rupees: number): Paise => Math.round(rupees * 100);

/** Category and asset class from the scheme name (SEBI category words). */
export function classify(scheme: string): { category: string; asset: AssetClass } {
  const s = scheme.toLowerCase();
  const rules: [RegExp, string, AssetClass][] = [
    [/\b(liquid|overnight|money market)\b/, 'Liquid', 'debt'],
    [/\b(gilt|short duration|short term|low duration|ultra short|corporate bond|banking (and|&) psu|credit risk|floater|dynamic bond|medium duration|long duration|debt|income|bond)\b/, 'Debt', 'debt'],
    [/\b(arbitrage)\b/, 'Arbitrage', 'hybrid'],
    [/\b(hybrid|balanced|equity savings|multi asset|asset allocation|retirement|children)\b/, 'Hybrid', 'hybrid'],
    [/\b(gold|silver)\b/, 'Gold / silver', 'gold'],
    [/\b(elss|tax saver|tax saving)\b/, 'ELSS', 'equity'],
    [/\b(index|nifty|sensex|etf)\b/, 'Index', 'equity'],
    [/\bsmall ?cap\b/, 'Small cap', 'equity'],
    [/\bmid ?cap\b/, 'Mid cap', 'equity'],
    [/\b(large (and|&) mid ?cap)\b/, 'Large & mid cap', 'equity'],
    [/\b(large ?cap|bluechip|blue chip|top 100)\b/, 'Large cap', 'equity'],
    [/\b(flexi ?cap|multi ?cap|focused|value|contra|dividend yield|equity|opportunities|growth fund|thematic|sectoral|infrastructure|technology|pharma|banking)\b/, 'Equity (other)', 'equity'],
  ];
  for (const [re, category, asset] of rules) if (re.test(s)) return { category: /flexi ?cap/.test(s) ? 'Flexi cap' : category, asset };
  return { category: 'Other', asset: 'other' };
}

const TXN = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+(\(?-?[\d,]+\.\d{2}\)?)\s+(\(?-?[\d,]+\.\d{3,4}\)?)\s+([\d,]+\.\d{2,4})\s+(\(?-?[\d,]+\.\d{3,4}\)?)\s*$/;
const CLOSE = /Closing Unit Balance:\s*([\d,]+\.\d+).*?NAV on (\d{2}-[A-Za-z]{3}-\d{4}):\s*INR\s*([\d,]+\.\d+).*?(?:Total )?Cost Value:\s*([\d,]+\.\d{2}).*?Market Value on (\d{2}-[A-Za-z]{3}-\d{4}):\s*INR\s*([\d,]+\.\d{2})/i;

export function parseCas(text: string): CasResult {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const holdings: Holding[] = []; const checks: CasCheck[] = [];
  let printedTotal: Paise | null = null; let asOf = '';
  let amc = ''; let cur: (Omit<Holding, 'units' | 'nav' | 'navDate' | 'cost' | 'value'> & { walk: number; opening: number }) | null = null;
  const isSummary = /summary/i.test(lines.slice(0, 12).join(' ')) && !lines.some((l) => /Closing Unit Balance/i.test(l));

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const tot = /^Total\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/.exec(l);
    if (tot && printedTotal === null) { printedTotal = paise(num(tot[2])); continue; }
    if (/^Folio No/i.test(l)) { amc = lines[i - 1] && !/ISIN|Folio|Closing/i.test(lines[i - 1]) ? lines[i - 1] : amc; continue; }
    const isinM = /ISIN:\s*([A-Z]{2}[A-Z0-9]{9}\d)/.exec(l);
    if (isinM) {
      const raw = l.slice(0, l.indexOf('ISIN:')).replace(/\s*-\s*$/, '');
      const scheme = raw.replace(/^[A-Z0-9]{2,12}-(?=\S)/, '').trim(); // drop the RTA scheme code prefix
      const plan: Holding['plan'] = /\bdirect\b/i.test(scheme) || /\(Advisor:\s*DIRECT/i.test(l) ? 'Direct' : 'Regular';
      cur = { isin: isinM[1], scheme, amc, plan, ...classify(scheme), flows: [], walk: 0, opening: 0 };
      continue;
    }
    if (!cur) continue;
    const ob = /^Opening Unit Balance:\s*([\d,]+\.\d+)/i.exec(l);
    if (ob) { cur.opening = num(ob[1]); cur.walk = cur.opening; continue; }
    const t = TXN.exec(l);
    if (t) {
      const desc = t[2]; const amount = num(t[3]); const units = num(t[4]);
      const out = units < 0 || /redemption|switch[- ]?out|withdrawal|swp|stp out/i.test(desc);
      cur.walk += units;
      cur.flows.push({ date: casDate(t[1]), amount: paise(out ? Math.abs(amount) : -Math.abs(amount)), nav: num(t[5]) });
      continue;
    }
    if (/^\d{2}-[A-Za-z]{3}-\d{4}\s+\*+\s*(stamp duty|stt)/i.test(l)) continue; // statutory charges: no units
    const c = CLOSE.exec(l);
    if (c) {
      const units = num(c[1]); const nav = num(c[3]); const value = paise(num(c[6]));
      asOf = casDate(c[5]) > asOf ? casDate(c[5]) : asOf;
      const h: Holding = { isin: cur.isin, scheme: cur.scheme, amc: cur.amc, plan: cur.plan, category: cur.category, asset: cur.asset, units, nav, navDate: casDate(c[2]), cost: paise(num(c[4])), value, flows: cur.flows };
      const walkOk = Math.abs(cur.walk - units) < 0.002 * Math.max(1, cur.flows.length);
      checks.push({ id: `units:${h.isin}`, label: `${h.scheme}: unit balance walk`, ok: walkOk, detail: walkOk ? `${cur.flows.length} transactions add up to ${units.toFixed(3)} units` : `transactions add up to ${cur.walk.toFixed(3)} units, statement says ${units.toFixed(3)}` });
      const valOk = Math.abs(Math.round(units * nav * 100) - value) <= 100; // ₹1 tolerance (rounding)
      checks.push({ id: `value:${h.isin}`, label: `${h.scheme}: units × NAV = market value`, ok: valOk, detail: `${units.toFixed(3)} × ${nav} vs ₹${(value / 100).toFixed(2)}` });
      if (units > 0.0005) holdings.push(h);
      cur = null;
    }
  }
  if (printedTotal !== null) {
    const sumV = holdings.reduce((s, h) => s + h.value, 0);
    const ok = Math.abs(sumV - printedTotal) <= 100 * Math.max(1, holdings.length);
    checks.push({ id: 'total', label: 'Fund values add up to the statement total', ok, detail: `₹${(sumV / 100).toFixed(2)} vs printed ₹${(printedTotal / 100).toFixed(2)}` });
  }
  return { asOf, holdings, checks, printedTotal, kind: holdings.length ? 'detailed' : isSummary ? 'summary' : 'unknown' };
}
