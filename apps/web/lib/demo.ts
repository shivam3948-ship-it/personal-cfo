import fs from 'node:fs';
import path from 'node:path';
import type { Dataset } from './types';
import { ingest, type InFile } from './ingest';
import { parseCas } from './portfolio/cas';

export const DEMO_DIR = path.join(process.cwd(), 'data', 'demo');

export function demoFiles(dir = DEMO_DIR): InFile[] {
  const out: InFile[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (!/^(README\.md|expected\.json)$/.test(e.name)) out.push({ name: path.relative(dir, p), bytes: new Uint8Array(fs.readFileSync(p)) });
    }
  };
  walk(dir);
  return out;
}

let cache: Promise<Dataset> | null = null;
/** Sample dataset, parsed with rules only (no network), cached per server process. */
export function loadDemo(): Promise<Dataset> {
  if (!cache) cache = ingest(demoFiles(), 'Sample data', { useLlm: false }).then((ds) => ({ ...ds, portfolio: samplePortfolio() }));
  return cache;
}

/** The sample user's mutual funds: a synthetic CAS (scripts/make_sample_cas.py), parsed by the same code the browser uses. */
export function samplePortfolio(): Dataset['portfolio'] {
  const r = parseCas(fs.readFileSync(path.join(process.cwd(), 'data', 'demo-cas', 'sample_cas_rohan.txt'), 'utf8'));
  return { asOf: r.asOf, holdings: r.holdings, checks: r.checks, source: 'Sample CAS (synthetic)' };
}
