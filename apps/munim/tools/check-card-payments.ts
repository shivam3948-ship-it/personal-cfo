// Run the card-bill pairing (D-059) on your own statements, on your own computer, and print counts only: no amounts,
// dates, names, narrations or file names. Password-protected files are skipped. Statements that don't reconcile are left
// out, exactly as on the phone.
// Build: npx esbuild tools/check-card-payments.ts --bundle --platform=node --format=esm --outfile=<somewhere>/cards.mjs
// Run:   node cards.mjs <folder> [<folder>…]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pdfLines } from '@core/ingest/pdfLines';
import { readBank } from '@core/ingest/banks';
import { finalise } from '@core/ingest/finalise';
import { categorizeAll } from '@core/finance/categorize';
import { emptyDataset } from '@core/types';

const files = process.argv.slice(2).flatMap((d) => (statSync(d).isDirectory() ? readdirSync(d).map((f) => join(d, f)) : [d])).filter((f) => /\.pdf$/i.test(f));
const ds = emptyDataset('mine'); const seen = new Set<string>();
let bank = 0, card = 0, skipped = 0, n = 0;
for (const f of files) {
  n++;
  try {
    const r = readBank((await pdfLines(new Uint8Array(readFileSync(f)))).lines, `file${n}.pdf`);
    if (!r || !r.txns.length || !r.checks.every((c) => c.ok)) { skipped++; continue; }
    r.account.kind === 'bank' ? bank++ : card++;
    if (!ds.accounts.some((a) => a.id === r.account.id)) ds.accounts.push(r.account);
    if (r.stmt) ds.cardStatements.push(r.stmt);
    for (const t of r.txns) { const k = [t.account, t.date, t.amount, t.dir, t.balance ?? '', t.desc.slice(0, 40)].join('|'); if (!seen.has(k)) { seen.add(k); ds.txns.push(t); } }
  } catch { skipped++; }
}
const before = new Map(categorizeAll(ds.txns.map((t) => ({ ...t, category: undefined, merchant: undefined }))).map((t) => [t.id + t.account, t.category]));
finalise(ds);
const checks = ds.log.find((l) => l.kind === 'cross-check')?.checks?.filter((c) => c.id === 'card_payment_match') ?? [];
const relabelled = ds.txns.filter((t) => t.matched === 'card_payment' && t.account.startsWith('bank:'));
const cardRelabelled = ds.txns.filter((t) => t.matched === 'card_payment' && t.account.startsWith('card:')).length;
const was: Record<string, number> = {};
for (const t of relabelled) { const c = before.get(t.id + t.account) ?? '?'; was[c] = (was[c] ?? 0) + 1; }
const cardPays = ds.txns.filter((t) => t.account.startsWith('card:') && t.dir === 'credit' && t.category === 'Card bill payment').length;
console.log(`statements used: ${bank} bank, ${card} card (${skipped} skipped: password, unsupported or not reconciling)`);
console.log(`card statements: ${ds.cardStatements.length}; card-side payments received: ${cardPays}`);
const cardCredits: Record<string, number> = {};
for (const t of ds.txns) if (t.account.startsWith('card:') && t.dir === 'credit') cardCredits[t.category ?? '?'] = (cardCredits[t.category ?? '?'] ?? 0) + 1;
console.log(`card credits by category: ${JSON.stringify(cardCredits)}; statement summary shows payments: ${ds.cardStatements.map((c) => (c.payments > 0 ? 'yes' : 'no')).join(',')}`);
const firstWords: Record<string, number> = {};
for (const t of ds.txns) if (t.account.startsWith('card:') && t.dir === 'credit') { const w = t.desc.trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12); if (/^(PAYMENT|PAYMENTS|BBPS|NEFT|IMPS|UPI|CRED|NETBANKING|AUTOPAY|CASHBACK|REFUND|REVERSAL|BPPY|THANK|ONLINE|CC)$/.test(w)) firstWords[w] = (firstWords[w] ?? 0) + 1; else firstWords['(other)'] = (firstWords['(other)'] ?? 0) + 1; }
console.log(`card credit narrations start with (fixed keyword list only): ${JSON.stringify(firstWords)}`);
for (const st of ds.cardStatements) {
  const cr = ds.txns.filter((t) => t.account === st.account && t.dir === 'credit');
  const inP = cr.filter((t) => t.date >= st.periodStart && t.date <= st.periodEnd);
  const sum = (xs: typeof cr) => xs.reduce((a, t) => a + t.amount, 0);
  const pay = inP.filter((t) => /\bBPPY\b/i.test(t.desc));
  const nonCb = inP.filter((t) => !['Cashback', 'Refund'].includes(t.category ?? ''));
  const oi = cr.filter((t) => t.category === 'Other income'), oiIn = inP.filter((t) => t.category === 'Other income'), bp = cr.filter((t) => /\bBPPY\b/i.test(t.desc));
  const cb = cr.filter((t) => t.category === 'Cashback');
  console.log(`card stmt (${ds.accounts.find((a) => a.id === st.account)?.label.split(' ')[0]}): BPPY rows ${bp.length} (in period ${bp.filter((t) => inP.includes(t)).length}); Other income rows ${oi.length} (in period ${oiIn.length}); BPPY is Other income: ${bp.every((t) => t.category === 'Other income')}`);
  for (const [name, target] of [['payments', st.payments], ['payments+credits', st.payments + st.credits], ['credits', st.credits]] as const) {
    const xs = cr.slice(0, 20), hits: string[] = [];
    for (let m = 1; m < 1 << xs.length && hits.length < 3; m++) {
      let tot = 0; for (let i = 0; i < xs.length; i++) if (m & (1 << i)) tot += xs[i].amount;
      if (tot !== target) continue;
      const by: Record<string, number> = {}; let outP = 0;
      for (let i = 0; i < xs.length; i++) if (m & (1 << i)) { const k = /\bBPPY\b/i.test(xs[i].desc) ? 'BPPY' : xs[i].category ?? '?'; by[k] = (by[k] ?? 0) + 1; if (!inP.includes(xs[i])) outP++; }
      hits.push(`${JSON.stringify(by)}${outP ? ` (${outP} outside period)` : ''}`);
    }
    console.log(`  subsets of card credits that equal ${name}: ${hits.length ? hits.join(' | ') : 'none'}`);
  }
}
console.log(`payments with bank data covering their date: ${checks.length}`);
console.log(`  matched, bank side already recognised: ${checks.filter((c) => c.ok && !/matched by amount/.test(c.detail ?? '')).length}`);
console.log(`  matched by amount and date (re-labelled): ${relabelled.length}  · were counted as: ${JSON.stringify(was)}`);
console.log(`  card-side payments re-labelled (were read as income or other): ${cardRelabelled}`);
const day = (d: string) => Date.parse(d + 'T00:00:00Z') / 864e5;
for (const p of ds.txns.filter((t) => t.account.startsWith('card:') && t.dir === 'credit' && t.category === 'Card bill payment')) {
  const deb = ds.txns.filter((t) => t.account.startsWith('bank:') && t.dir === 'debit');
  const same = (w: number) => deb.filter((t) => t.amount === p.amount && Math.abs(day(t.date) - day(p.date)) <= w).length;
  const banks = [...new Set(deb.filter((t) => Math.abs(day(t.date) - day(p.date)) <= 3).map((t) => t.account))].length;
  const ccWords = deb.filter((t) => Math.abs(day(t.date) - day(p.date)) <= 10 && /cred|card|cc\b|billpay|bill pay|bbps/i.test(t.desc)).length;
  const cc = deb.filter((t) => Math.abs(day(t.date) - day(p.date)) <= 10 && /cred|card|cc\b|billpay|bill pay|bbps/i.test(t.desc)).map((t) => `${t.category} words:${['cred', 'credit card', 'card', 'cc', 'billpay', 'bill pay', 'bbps', 'autopay', 'upi', 'neft', 'imps', 'netbanking', 'ib', 'hdfc', 'icici', 'axis', 'sbi', 'kotak', 'amex', 'onecard', 'slice', 'si'].filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(t.desc)).join('+')}${t.amount > p.amount ? ' (larger)' : ' (smaller)'}`);
  console.log(`  card-like bank debits near it: ${JSON.stringify(cc)}`);
  console.log(`  payment: same-amount bank debits within 3 days ${same(3)}, 7 days ${same(7)}, 30 days ${same(30)}; bank accounts with rows within 3 days: ${banks}; card-like bank debits within 10 days: ${ccWords}`);
}
console.log(`  not matched (no single bank debit of that amount within 3 days): ${checks.filter((c) => !c.ok).length}`);
