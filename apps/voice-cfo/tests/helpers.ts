import fs from 'node:fs';
import path from 'node:path';
import { ingest } from '@/lib/ingest';
import { demoFiles } from '@/lib/demo';
import type { Dataset } from '@/lib/types';

export const expected = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/demo/expected.json'), 'utf8'));
let ds: Promise<Dataset> | null = null;
export const demo = () => (ds ??= ingest(demoFiles(), 'Sample data', { useLlm: false }));
