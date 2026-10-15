// Output check: every money/percentage figure in the agent's answer must appear in a tool result from this turn.
export interface NumberCheck { ok: boolean; checked: number; unverified: string[] }

const toNum = (s: string) => Number(s.replace(/,/g, ''));

/** Pull numeric facts out of a tool result (strings like "₹1,25,000", "28.5%", plain numbers). */
export function allowedNumbers(results: unknown[]): number[] {
  const out = new Set<number>();
  const walk = (v: unknown) => {
    if (typeof v === 'number') out.add(v);
    else if (typeof v === 'string') for (const m of v.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) out.add(toNum(m[0]));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  results.forEach(walk);
  const base = [...out];
  for (const n of base) {
    const abs = Math.abs(n);
    out.add(abs);
    if (abs >= 1e5) { out.add(Math.round(abs / 1e3) / 1e2); out.add(Math.round(abs / 1e4) / 10); } // lakh forms: 1.45, 1.5
    if (abs >= 1e7) { out.add(Math.round(abs / 1e5) / 1e2); out.add(Math.round(abs / 1e6) / 10); } // crore forms
  }
  return [...out];
}

/** Figures that matter: ₹ amounts, lakh/crore amounts, percentages, and any number with 4+ digits. Small counts (days, EMIs, months) are allowed. */
export function checkNumbers(answer: string, results: unknown[]): NumberCheck {
  const allowed = allowedNumbers(results);
  const text = answer.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
  const found: string[] = [];
  const re = /(₹\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:lakh|लाख|crore|करोड़|%|प्रतिशत|percent)|\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d{4,}(?:\.\d+)?)/gi;
  for (const m of text.matchAll(re)) {
    const raw = m[0];
    if (/^(19|20)\d{2}$/.test(raw.trim())) continue; // years
    found.push(raw);
  }
  const unverified = found.filter((raw) => {
    const n = toNum(raw.replace(/[^\d.,]/g, ''));
    if (!Number.isFinite(n)) return false;
    return !allowed.some((a) => Math.abs(a - n) <= Math.max(0.011, Math.abs(a) * 0.005));
  });
  return { ok: unverified.length === 0, checked: found.length, unverified };
}
