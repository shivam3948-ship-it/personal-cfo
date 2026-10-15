#!/usr/bin/env node
// Turns the demo .txt documents into PDFs (in demo-pdfs/, git-ignored) to rehearse the PDF upload path.
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const src = path.join('data', 'demo'); const dst = 'demo-pdfs';
fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.txt'))) {
  const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Courier);
  const lines = fs.readFileSync(path.join(src, f), 'utf8').replace(/₹/g, 'Rs ').split('\n');
  let page = doc.addPage([595, 842]); let y = 810;
  for (const full of lines) {
    // Wrap long lines at spaces, like a real PDF would.
    const parts = []; let cur = '';
    for (const w of full.split(' ')) { if (cur && (cur + ' ' + w).length > 105) { parts.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    parts.push(cur);
    for (const part of parts) {
      if (y < 40) { page = doc.addPage([595, 842]); y = 810; }
      page.drawText(part, { x: 28, y, size: 8, font }); y -= 11;
    }
  }
  fs.writeFileSync(path.join(dst, f.replace(/\.txt$/, '.pdf')), await doc.save());
  console.log('wrote', path.join(dst, f.replace(/\.txt$/, '.pdf')));
}
