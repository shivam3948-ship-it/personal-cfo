import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { pdfLines } from '@/lib/portfolio/pdf-lines';
import { parseCas } from '@/lib/portfolio/cas';

describe('CAS from a PDF (same path the browser uses)', () => {
  it('rebuilds lines from the PDF and parses the same holdings as the text file', async () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'data', 'demo-cas', 'sample_cas_rohan.txt'), 'utf8');
    const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = text.split('\n'); let page = doc.addPage([842, 595]); let y = 570;
    for (const l of lines) {
      if (y < 30) { page = doc.addPage([842, 595]); y = 570; }
      // split into two runs to mimic column layout: date/desc on the left, numbers on the right
      const m = /^(\d{2}-\w{3}-\d{4} .+?) ([\d,().-]+ [\d,().-]+ [\d.]+ [\d,().-]+)$/.exec(l);
      if (m) { page.drawText(m[1], { x: 30, y, size: 8, font }); page.drawText(m[2], { x: 420, y, size: 8, font }); }
      else if (l) page.drawText(l, { x: 30, y, size: 8, font });
      y -= 11;
    }
    const bytes = await doc.save();
    const r = parseCas(await pdfLines(new Uint8Array(bytes)));
    const t = parseCas(text);
    expect(r.holdings.map((h) => [h.isin, h.units, h.value])).toEqual(t.holdings.map((h) => [h.isin, h.units, h.value]));
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });
});
