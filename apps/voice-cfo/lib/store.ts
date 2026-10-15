// Per-session state: the dataset in use (sample or the user's uploads). Single-process, in memory.
import type { Dataset } from './types';
import { loadDemo } from './demo';

const uploads = new Map<string, Dataset>();

export async function datasetFor(sid: string): Promise<Dataset> {
  return uploads.get(sid) ?? loadDemo();
}
export function setUploads(sid: string, ds: Dataset) { uploads.set(sid, ds); }
export function resetToDemo(sid: string) { uploads.delete(sid); }
export const isUsingUploads = (sid: string) => uploads.has(sid);
