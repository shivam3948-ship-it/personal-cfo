// Every demo document also parses when it arrives as a PDF (generated with `npm run demo:pdfs`).
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ingest } from '@/lib/ingest';

const dir = 'demo-pdfs';
if (!fs.existsSync(dir)) execSync('node scripts/make-pdfs.mjs');
describe('PDF route', () => {
  it('all PDFs parse with rules and every check passes', async () => {
    const files = fs.readdirSync(dir).map((f) => ({ name: f, bytes: new Uint8Array(fs.readFileSync(`${dir}/${f}`)) }));
    files.push({ name: 'bank.csv', bytes: new Uint8Array(fs.readFileSync('data/demo/bank_statement_saffron_jul-sep-2026.csv')) });
    const ds = await ingest(files, 'pdf', { useLlm: false });
    expect(ds.log.filter((l) => !l.ok).map((l) => `${l.file}: ${l.summary} ${l.checks.filter((c) => !c.ok).map((c) => c.detail).join(';')}`)).toEqual([]);
    expect(ds.txns.filter((t) => t.source === 'sms').length).toBe(30);
  });
});
