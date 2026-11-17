// Run the statement readers on your own PDFs, on your own computer, and print only pass/fail (D-047, D-053).
// No amounts, dates, names, narrations or file names are printed: each file is a number, its format, its row count and
// each check's id with ✓ or ✗. Password-protected files are skipped (the password is never asked for here).
// Build: npx esbuild tools/check-my-statements.ts --bundle --platform=node --format=esm --outfile=<somewhere>/check.mjs
//        (run from apps/munim so the @core alias resolves; see tsconfig paths)
// Run:   node check.mjs <folder> [<folder>…]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pdfLines, PdfPasswordError } from '@core/ingest/pdfLines';
import { readBank } from '@core/ingest/banks';

const files = process.argv.slice(2).flatMap((d) => (statSync(d).isDirectory() ? readdirSync(d).map((f) => join(d, f)) : [d])).filter((f) => /\.pdf$/i.test(f));
let n = 0, passed = 0, read = 0;
for (const f of files) {
  n++;
  try {
    const { lines } = await pdfLines(new Uint8Array(readFileSync(f)));
    const r = readBank(lines, `file${n}.pdf`);
    if (!r) { console.log(`#${n} not a supported bank or card statement`); continue; }
    read++;
    const ok = r.txns.length > 0 && r.checks.every((c) => c.ok);
    if (ok) passed++;
    console.log(`#${n} ${r.format} rows=${r.txns.length} ${ok ? 'PASS' : 'FAIL'} ${r.checks.map((c) => `${c.id}${c.ok ? '✓' : '✗'}`).join(' ')}`);
    // a date check that fails: how far off, in days (no dates themselves)
    if (r.period && (r.txns.some((t) => t.date < r.period!.from || t.date > r.period!.to) || r.checks.some((c) => c.id === 'in_period' && !c.ok))) {
      const day = (d: string) => Date.parse(d + 'T00:00:00Z') / 864e5;
      const before = r.txns.filter((t) => t.date < r.period!.from).map((t) => day(r.period!.from) - day(t.date));
      const after = r.txns.filter((t) => t.date > r.period!.to).map((t) => day(t.date) - day(r.period!.to));
      console.log(`   period ${day(r.period.to) - day(r.period.from) + 1} days; ${before.length} rows before it (up to ${Math.max(0, ...before)} days), ${after.length} after it (up to ${Math.max(0, ...after)} days)`);
    }
    if (r.checks.some((c) => c.id === 'order' && !c.ok)) {
      const day = (d: string) => Date.parse(d + 'T00:00:00Z') / 864e5;
      const back = r.txns.slice(1).map((t, i) => day(r.txns[i].date) - day(t.date)).filter((x) => x > 0);
      console.log(`   ${back.length} of ${r.txns.length - 1} steps go back in time (up to ${Math.max(...back)} days); first row ${day(r.txns[0].date) > day(r.txns.at(-1)!.date) ? 'after' : 'before'} last row`);
    }
  } catch (e) {
    console.log(`#${n} ${e instanceof PdfPasswordError ? 'password-protected, skipped' : 'could not be read'}`);
  }
}
console.log(`${read} statements read, ${passed} pass every check (${n} PDFs looked at)`);
