// What Munim remembers between conversations (D-108), on this phone only: the last few topics as tool names and a date, never
// the words. Saved goals and reminders are the actions already kept here (askLocal). Forgotten with the statements.
import { idbDel, idbGet, idbPut } from './idb';

export interface Topic { date: string; tools: string[] }
const KEY = 'topics';
const SKIP = new Set(['memory_recall']);

export async function rememberTopic(tools: string[], date = new Date().toISOString().slice(0, 10)): Promise<void> {
  const t = [...new Set(tools.filter((x) => !SKIP.has(x)))].slice(0, 4);
  if (!t.length) return;
  const list = (await idbGet<Topic[]>(KEY)) ?? [];
  await idbPut(KEY, [{ date, tools: t }, ...list].slice(0, 5));
}
export async function loadTopics(): Promise<Topic[]> { return (await idbGet<Topic[]>(KEY)) ?? []; }
export async function forgetTopics(): Promise<void> { await idbDel(KEY); }
