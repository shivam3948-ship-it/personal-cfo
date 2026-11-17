// PDF → text lines, rebuilt from positions: items on the same baseline (within a small tolerance) become one line,
// left to right. Statement tables put each column in its own text item, so plain text extraction can split a row
// or merge two; rebuilding by position keeps "date  description  amount  units  NAV  balance" on one line.
// Pure (pdf.js via unpdf), so it runs in the browser: the PDF and its password never leave the phone.
import { getDocumentProxy } from 'unpdf';

export class PdfPasswordError extends Error {
  constructor(public reason: 'needed' | 'wrong') { super(reason === 'needed' ? 'This PDF needs a password.' : 'That password didn’t open the file.'); }
}

interface Item { str: string; x: number; y: number; w: number; h: number }

export async function pdfLines(bytes: Uint8Array, password?: string): Promise<{ lines: string[]; pages: number }> {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes), password ? { password } : {});
  } catch (e) {
    const err = e as { name?: string; code?: number; message?: string };
    if (err?.name === 'PasswordException' || /password/i.test(err?.message ?? '')) throw new PdfPasswordError(err.code === 2 || (password && /incorrect/i.test(err.message ?? '')) ? 'wrong' : 'needed');
    throw e;
  }
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items as { str?: string; transform?: number[]; width?: number; height?: number }[]) {
      if (!it.str || !it.transform || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0, h: Math.abs(it.height ?? it.transform[3] ?? 10) || 10 });
    }
    // group by baseline: top to bottom, tolerance = 40% of the text height
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: Item[][] = [];
    for (const it of items) {
      const row = rows.at(-1);
      if (row && Math.abs(row[0].y - it.y) <= Math.max(2, row[0].h * 0.4)) row.push(it); else rows.push([it]);
    }
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      let s = '';
      for (let i = 0; i < row.length; i++) {
        const prev = row[i - 1];
        // a real gap (more than ~a third of a character) means a new word or column; touching items are one word split in two
        const gap = prev ? row[i].x - (prev.x + prev.w) : 0;
        const cw = prev ? prev.w / Math.max(1, prev.str.length) : 0;
        s += i && gap > cw * 0.3 ? ' ' + row[i].str : row[i].str;
      }
      lines.push(s.replace(/\s+/g, ' ').trim());
    }
    lines.push(''); // page break
  }
  return { lines, pages: pdf.numPages };
}
