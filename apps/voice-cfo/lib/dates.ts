const MON: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');

/** Parse common Indian document dates to ISO: 05/07/2026, 05-07-2026, 05-Jul-26, 05-Jul-2026, 5 Jul 2026, 2026-07-05, "18 October 2026". */
export function toIso(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return `${year(m[3])}-${pad(+m[2])}-${pad(+m[1])}`;
  m = t.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s,-]+(\d{2,4})$/);
  if (m) {
    const mo = MON[m[2].toLowerCase().slice(0, 3)];
    if (mo) return `${year(m[3])}-${pad(mo)}-${pad(+m[1])}`;
  }
  return null;
}
function year(y: string) { return y.length === 2 ? `20${y}` : y; }

/** Find the first date-looking token in free text. */
export function findDate(text: string): string | null {
  const re = /(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}[\s-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[\s,-]+\d{2,4})/i;
  const m = text.match(re);
  return m ? toIso(m[1]) : null;
}

export const addDays = (iso: string, d: number) => new Date(Date.parse(iso + 'T00:00:00Z') + d * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
export function addMonths(iso: string, k: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + k + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + k, Math.min(d, last))).toISOString().slice(0, 10);
}
export const monthKey = (iso: string) => iso.slice(0, 7);
export function monthsBetween(a: string, b: string) { // whole months from a to b
  const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
export function spokenDate(iso: string, lang: 'hi' | 'en' = 'en') {
  const [, m, d] = iso.split('-').map(Number);
  return lang === 'hi' ? `${d} ${MONTH_HI[m - 1]}` : `${d} ${MONTH_EN[m - 1]}`;
}
export function monthName(key: string, lang: 'hi' | 'en' = 'en') {
  const m = Number(key.slice(5, 7));
  return lang === 'hi' ? MONTH_HI[m - 1] : MONTH_EN[m - 1];
}
