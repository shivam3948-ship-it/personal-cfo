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
