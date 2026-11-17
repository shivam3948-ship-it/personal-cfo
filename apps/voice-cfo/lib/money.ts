import type { Paise } from './types';

/** Rupees (string or number as printed on a document) -> integer paise. Accepts "1,25,000.00", "Rs 649", "INR 4,999.00", "₹12,500". */
export function parseMoney(s: string | number): Paise | null {
  if (typeof s === 'number') return Number.isFinite(s) ? Math.round(s * 100) : null;
  const m = s.replace(/[₹]|rs\.?|inr/gi, '').replace(/\s+/g, '').match(/^-?\d[\d,]*(\.\d{1,2})?$/);
  if (!m) return null;
  const v = Number(m[0].replace(/,/g, ''));
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

export function assertPaise(p: Paise, what = 'amount'): Paise {
  if (!Number.isSafeInteger(p)) throw new Error(`${what} is not an integer paise value: ${p}`);
  return p;
}

/** Indian digit grouping: 12345678 -> "1,23,45,678". */
export function groupIndian(n: number): string {
  const neg = n < 0;
  let s = String(Math.abs(Math.trunc(n)));
  let out = '';
  if (s.length > 3) {
    out = ',' + s.slice(-3);
    s = s.slice(0, -3);
    while (s.length > 2) { out = ',' + s.slice(-2) + out; s = s.slice(0, -2); }
    out = s + out;
  } else out = s;
  return (neg ? '-' : '') + out;
}

/** Paise -> "₹1,25,000" (rupees, rounded) or "₹649.50" when paise matter and decimals='auto'. */
export function inr(p: Paise, decimals: 'auto' | 0 | 2 = 0): string {
  const neg = p < 0;
  const a = Math.abs(p);
  const showPaise = decimals === 2 || (decimals === 'auto' && a % 100 !== 0);
  const rupees = showPaise ? Math.floor(a / 100) : Math.round(a / 100);
  const body = groupIndian(rupees) + (showPaise ? '.' + String(a % 100).padStart(2, '0') : '');
  return (neg ? '-₹' : '₹') + body;
}

/** Short spoken form: 1,52,000 -> "₹1.52 lakh"; below a lakh returns inr(). */
export function inrShort(p: Paise, lang: 'hi' | 'en' = 'en'): string {
  const r = Math.round(p / 100);
  const abs = Math.abs(r);
  if (abs >= 1_00_00_000) return `₹${trim(r / 1_00_00_000)} ${lang === 'hi' ? 'करोड़' : 'crore'}`;
  if (abs >= 1_00_000) return `₹${trim(r / 1_00_000)} ${lang === 'hi' ? 'लाख' : 'lakh'}`;
  return inr(p);
}
const trim = (x: number) => (Math.round(x * 100) / 100).toString();

export const sum = (xs: Paise[]): Paise => xs.reduce((a, b) => a + b, 0);

/** Percentage with one decimal, computed in code. */
export const pct = (num: number, den: number): number => (den === 0 ? 0 : Math.round((num / den) * 1000) / 10);
