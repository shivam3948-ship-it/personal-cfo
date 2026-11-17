// PDF → text lines, rebuilt from text positions (items on the same baseline joined left to right).
// Runs in the browser for the CAS, so the PDF and its password never leave the device (AGENTS.md rule 5).
export class CasPasswordError extends Error { constructor(public wrong: boolean) { super(wrong ? 'That password did not open the PDF.' : 'This PDF needs its password.'); } }

export async function pdfLines(bytes: Uint8Array, password?: string): Promise<string> {
  const { getDocumentProxy } = await import('unpdf');
  let pdf;
  try { pdf = await getDocumentProxy(bytes, password ? { password } : {}); }
  catch (e) {
    const err = e as { name?: string; code?: number; message?: string };
    if (err?.name === 'PasswordException' || /password/i.test(err?.message ?? '')) throw new CasPasswordError(err?.code === 2 || (!!password && !/no password/i.test(err?.message ?? '')));
    throw e;
  }
  const out: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of tc.items as { str?: string; transform?: number[] }[]) {
      if (!it.str || !it.transform) continue;
      const y = Math.round(it.transform[5] / 2) * 2; // 2pt bucket absorbs sub-pixel baseline jitter
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: it.transform[4], s: it.str });
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => out.push(items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim()));
  }
  return out.join('\n');
}
