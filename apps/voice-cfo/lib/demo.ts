import fs from 'node:fs';
import path from 'node:path';
import type { Dataset } from './types';
import { ingest, type InFile } from './ingest';

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
  if (!cache) cache = ingest(demoFiles(), 'Sample data', { useLlm: false });
  return cache;
}
