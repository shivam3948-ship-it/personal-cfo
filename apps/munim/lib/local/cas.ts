'use client';
// Your CAS, on this phone only. Read in the browser (pdf.js), checked by the same parser as the server's sample, saved in
// this browser's IndexedDB without name, PAN, email, address or folio number. The server never receives it.
import { parseCas, type CasResult, type Holding } from '@core/portfolio/cas';
import { pdfLines, PdfPasswordError } from '@core/ingest/pdfLines';
import type { Portfolio } from '@/lib/views/portfolioBlocks';
import { idbGet, idbPut, idbDel } from './idb';
import { switchToMyData } from './profile';

export { PdfPasswordError };
export interface LocalCas extends Portfolio { checks: CasResult['checks']; addedAt: string; skipped: string[] }

const KEY = 'cas';
export async function loadCas(): Promise<LocalCas | null> { return (await idbGet<LocalCas>(KEY)) ?? null; }
export async function saveCas(c: LocalCas) { await idbPut(KEY, c); switchToMyData(); }
export async function deleteCas() { await idbDel(KEY); }

/** Only fields the engine needs; AMC kept only when it looks like a fund house (the line it comes from sits near the investor's name). */
function clean(h: Holding): Holding {
  return { ...h, amc: /mutual fund|asset management|\bamc\b/i.test(h.amc) ? h.amc : '', scheme: h.scheme.replace(/\(Advisor:[^)]*\)/i, '').replace(/Registrar\s*:.*$/i, '').trim() };
}

export interface ReadResult { kind: CasResult['kind']; cas: LocalCas | null; failed: CasResult['checks']; diagnostics: string }

/** Read a CAS file (PDF, or the text export) on the device. Throws PdfPasswordError when a password is needed or wrong. */
export async function readCas(file: File, password?: string): Promise<ReadResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
  let lines: string[]; let pages = 0;
  if (isPdf) ({ lines, pages } = await pdfLines(bytes, password));
  else lines = new TextDecoder().decode(bytes).split(/\r?\n/);
  return readCasLines(lines, parseCas(lines.join('\n')), pages);
}

/** Checks → keep only funds that add up → the on-phone record (no personal details) + privacy-safe diagnostics. */
export async function readCasLines(lines: string[], r: CasResult, pages = 0): Promise<ReadResult> {
  const failed = r.checks.filter((c) => !c.ok);
  const badIsins = new Set(failed.filter((c) => c.id.startsWith('units:') || c.id.startsWith('value:')).map((c) => c.id.split(':')[1]));
  const holdings = r.holdings.filter((h) => !badIsins.has(h.isin)).map(clean); // a fund that doesn't add up is left out, never guessed
  const cas: LocalCas | null = holdings.length ? { asOf: r.asOf, holdings, checks: r.checks, addedAt: new Date().toISOString(), skipped: r.holdings.filter((h) => badIsins.has(h.isin)).map((h) => h.scheme) } : null;
  return { kind: r.kind, cas, failed, diagnostics: diagnose(lines, pages, r) };
}

/** What to send us when a statement doesn't read: line shapes and check results only. No amounts, names, PAN or folio numbers. */
function diagnose(lines: string[], pages: number, r: CasResult): string {
  const shape = (l: string) => l.replace(/[A-Za-z]+/g, 'a').replace(/\d/g, '9').replace(/a( a)+/g, 'a…').slice(0, 60);
  const counts: Record<string, number> = {};
  const tag = (l: string) => /^\d{2}-[A-Za-z]{3}-\d{4}/.test(l) ? 'dated' : /ISIN/.test(l) ? 'isin' : /Closing Unit Balance/i.test(l) ? 'closing' : /Opening Unit Balance/i.test(l) ? 'opening' : /^Folio/i.test(l) ? 'folio' : 'other';
  for (const l of lines) if (l.trim()) counts[tag(l)] = (counts[tag(l)] ?? 0) + 1;
  const dated = lines.filter((l) => tag(l) === 'dated').slice(0, 8).map(shape);
  return [
    `Munim CAS diagnostics · ${new Date().toISOString().slice(0, 10)}`,
    `pages=${pages} lines=${lines.length} kind=${r.kind} funds=${r.holdings.length} asOf=${r.asOf || '?'}`,
    `line types: ${JSON.stringify(counts)}`,
    `checks: ${r.checks.filter((c) => c.ok).length} ok, ${r.checks.filter((c) => !c.ok).length} failed ${JSON.stringify(r.checks.filter((c) => !c.ok).map((c) => c.id))}`,
    'sample dated-line shapes (letters→a, digits→9):', ...dated,
  ].join('\n');
}
