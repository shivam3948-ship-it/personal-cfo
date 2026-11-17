import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { DATA_DIR } from '@core/demo';
import { parseCas } from '@core/portfolio/cas';
import { pdfLines, PdfPasswordError } from '@core/ingest/pdfLines';

// The CAS as a real-looking PDF: transaction rows drawn as separate columns (date, description, amount, units, NAV, balance),
// the way CAMS lays them out. Reading it back by position must give exactly what the text parser gives.
async function casPdf(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Helvetica);
  const TX = /^(\d{2}-[A-Za-z]{3}-\d{4}) (.+?) (\(?-?[\d,]+\.\d{2}\)?) (\(?-?[\d,]+\.\d{3,4}\)?) ([\d,]+\.\d{2,4}) (\(?-?[\d,]+\.\d{3,4}\)?)$/;
  let page = doc.addPage([595, 842]); let y = 810;
  for (const raw of text.split('\n')) {
    if (y < 40) { page = doc.addPage([595, 842]); y = 810; }
    const l = raw.replace(/\s+/g, ' ').trim(); const m = TX.exec(l);
    if (m) {
      const cols: [string, number, 'l' | 'r'][] = [[m[1], 30, 'l'], [m[2], 95, 'l'], [m[3], 360, 'r'], [m[4], 425, 'r'], [m[5], 480, 'r'], [m[6], 560, 'r']];
      for (const [s, x, al] of cols) { const w = font.widthOfTextAtSize(s, 7); page.drawText(s, { x: al === 'r' ? x - w : x, y, size: 7, font }); }
    } else if (l) page.drawText(l.slice(0, 140), { x: 30, y, size: 7, font });
    y -= 10;
  }
  return doc.save();
}

describe('CAS PDF read on the device', () => {
  const text = fs.readFileSync(path.join(DATA_DIR, 'demo-cas', 'sample_cas_rohan.txt'), 'utf8');
  it('reading the PDF by position gives the same holdings, flows and checks as the text', async () => {
    const { lines, pages } = await pdfLines(await casPdf(text));
    expect(pages).toBeGreaterThan(1);
    const fromPdf = parseCas(lines.join('\n')), fromText = parseCas(text);
    expect(fromPdf.kind).toBe('detailed');
    expect(fromPdf.holdings).toEqual(fromText.holdings);
    expect(fromPdf.checks.every((c) => c.ok)).toBe(true);
    expect(fromPdf.checks.map((c) => c.id)).toEqual(fromText.checks.map((c) => c.id));
  }, 30000);
  it('a garbage file is not a CAS', async () => {
    await expect(pdfLines(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
  it('PdfPasswordError says whether the password was missing or wrong', () => {
    expect(new PdfPasswordError('needed').message).toMatch(/needs a password/);
    expect(new PdfPasswordError('wrong').message).toMatch(/didn’t open/);
  });
});

describe('readCas on the device (privacy and checks)', () => {
  const text = fs.readFileSync(path.join(DATA_DIR, 'demo-cas', 'sample_cas_rohan.txt'), 'utf8');
  const asFile = (t: string, name = 'cas.txt') => new File([t], name, { type: 'text/plain' });
  it('keeps no name, email, address, folio or advisor code', async () => {
    const { readCas } = await import('@/lib/local/cas');
    const r = await readCas(asFile(text));
    const saved = JSON.stringify(r.cas);
    for (const bad of ['Rohan', 'Saffron', 'Example Road', '@example.com', 'Folio', '1023456', 'ARN-', 'Advisor']) expect(saved).not.toContain(bad);
    expect(r.cas!.holdings).toHaveLength(5);
  });
  it('a fund whose units don’t add up is left out, not guessed', async () => {
    const { readCas } = await import('@/lib/local/cas');
    const r = await readCas(asFile(text.replace('Closing Unit Balance: 26,464.268', 'Closing Unit Balance: 26,484.268')));
    expect(r.cas!.holdings.map((h) => h.scheme)).not.toContain('Kestrel Flexi Cap Fund - Regular Plan - Growth');
    expect(r.cas!.skipped).toEqual(['Kestrel Flexi Cap Fund - Regular Plan - Growth']);
  });
  it('diagnostics carry line shapes and check ids only: no amounts, names or folio numbers', async () => {
    const { readCas } = await import('@/lib/local/cas');
    const d = (await readCas(asFile(text.replace('Closing Unit Balance: 26,464.268', 'Closing Unit Balance: 26,484.268')))).diagnostics;
    for (const bad of ['Rohan', '1023456', '5,000.00', '26,484', 'Kestrel', '@']) expect(d).not.toContain(bad);
    expect(d).toMatch(/failed/);
  });
});

describe('MF Central detailed report layout', () => {
  const head = ['Consolidated Account Statement', 'Example Mutual Fund', 'Folio No: 999 PAN: OK KYC: OK'];
  const scheme = (open: string) => `X01-Example Flexi Cap Fund - Direct Plan - Growth (Advisor: DIRECT) ISIN: INF000X01AB1 Opening Unit Balance: ${open}`;
  const close = 'Closing Unit Balance: 100.000 Nav as on 15-Oct-2026: INR 30.0000 Valuation on 15-Oct-2026 : INR 3,000.00';
  it('a statement that starts mid-way is "partial", not guessed', () => {
    const r = parseCas([...head, scheme('100.000'), close].join('\n'));
    expect(r.kind).toBe('partial'); expect(r.holdings).toHaveLength(0);
    expect(r.checks[0]).toMatchObject({ ok: false, id: 'start:INF000X01AB1' });
  });
  it('from the first investment it reads, with cost from the transactions', () => {
    const rows = ['05-Jan-2025 Purchase 2,000.00 100.000 20.0000 100.000'];
    const r = parseCas([...head, scheme('0.000'), ...rows, close].join('\n'));
    expect(r.kind).toBe('detailed');
    expect(r.holdings[0]).toMatchObject({ units: 100, nav: 30, value: 300000, cost: 200000, plan: 'Direct' });
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });
});
