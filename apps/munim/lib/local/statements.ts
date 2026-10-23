'use client';
// Your bank and card statements, on this phone only (D-036 option C, D-046). Read in the browser, checked against the
// statement's own totals, saved in IndexedDB. A statement that doesn't reconcile is shown but never saved or used.
import { pdfLines, PdfPasswordError } from '@core/ingest/pdfLines';
import { readBank, detectFormat, type BankRead } from '@core/ingest/banks';
import { parseCas } from '@core/portfolio/cas';
import { categorizeAll } from '@core/finance/categorize';
import { emptyDataset, type Dataset, type Txn } from '@core/types';
import { readCasLines, type ReadResult } from './cas';
import { idbGet, idbPut, idbDel } from './idb';
import { loadSubAnswers } from './subAnswers';

export { PdfPasswordError };
export interface SavedStatement { key: string; format: BankRead['format']; account: BankRead['account']; period?: { from: string; to: string }; txns: Txn[]; stmt?: BankRead['stmt']; checks: BankRead['checks']; addedAt: string }

const KEY = 'statements';
let memory: SavedStatement[] = [];

export async function loadStatements(): Promise<SavedStatement[]> { return ((await idbGet<SavedStatement[]>(KEY)) ?? memory) || []; }
async function store(list: SavedStatement[]) { memory = list; await idbPut(KEY, list); }
export async function deleteStatement(key: string) { await store((await loadStatements()).filter((s) => s.key !== key)); }
export async function deleteAllStatements() { memory = []; await idbDel(KEY); }

export type AnyRead = { type: 'cas'; cas: ReadResult } | { type: 'bank'; read: BankRead; ok: boolean; saved: boolean } | { type: 'unknown'; diagnostics: string };

/** Read any supported file on the device: a CAS, or an HDFC/SBI/Canara savings or HDFC/Axis card statement. Saves only what reconciles. */
export async function readAny(file: File, password?: string): Promise<AnyRead> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  const lines = isPdf ? (await pdfLines(bytes, password)).lines : new TextDecoder().decode(bytes).split(/\r?\n/);
  if (detectFormat(lines)) {
    const read = readBank(lines, file.name.replace(/[^\w.-]/g, '_'))!;
    const ok = read.txns.length > 0 && read.checks.every((c) => c.ok);
    if (ok) {
      const key = `${read.account.id}:${read.period?.from ?? read.txns[0]?.date}:${read.period?.to ?? read.txns.at(-1)?.date}`;
      const s: SavedStatement = { key, format: read.format, account: read.account, period: read.period, txns: read.txns, stmt: read.stmt, checks: read.checks, addedAt: new Date().toISOString() };
      await store([...(await loadStatements()).filter((x) => x.key !== key), s]); // same account and period: the newer copy replaces it
    }
    return { type: 'bank', read, ok, saved: ok };
  }
  const cas = parseCas(lines.join('\n'));
  if (cas.kind !== 'unknown' || /Consolidated Account Statement|Unit Balance/i.test(lines.slice(0, 80).join(' '))) return { type: 'cas', cas: await readCasLines(lines, cas) };
  return { type: 'unknown', diagnostics: shapes(lines) };
}

/** Your statements as a Dataset for the engine (same shape the server builds for the sample family). */
export async function myDataset(): Promise<Dataset | null> {
  const list = await loadStatements(); if (!list.length) return null;
  const ds = emptyDataset('Your statements');
  const seen = new Set<string>();
  for (const s of list) {
    if (!ds.accounts.some((a) => a.id === s.account.id)) ds.accounts.push(s.account);
    if (s.stmt) ds.cardStatements.push(s.stmt);
    for (const t of s.txns) {
      const k = [t.account, t.date, t.amount, t.dir, t.balance ?? '', t.desc.slice(0, 40)].join('|'); // overlapping statements: count a row once
      if (!seen.has(k)) { seen.add(k); ds.txns.push(t); }
    }
  }
  ds.txns = categorizeAll(ds.txns.map((t) => ({ ...t, category: undefined, merchant: undefined })));
  ds.txns.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  ds.subAnswers = await loadSubAnswers(); // "Still using it?" answers (D-052)
  return ds;
}

function shapes(lines: string[]) {
  const red = (l: string) => l.replace(/[A-Z]+/g, 'A').replace(/[a-z]+/g, 'a').replace(/\d/g, '9').slice(0, 70);
  return ['Munim statement diagnostics (letters→a, digits→9)', `lines=${lines.length}`, ...lines.filter((l) => l.trim()).slice(0, 30).map(red)].join('\n');
}
