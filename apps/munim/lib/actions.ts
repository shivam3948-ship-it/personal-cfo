// Actions the agent can take. All are local and reversible: reminders (.ics), email drafts (user sends), goals, prepayment plans.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { actionKey, type Action } from './actionsCore';
export * from './actionsCore';

const DIR = path.join(process.cwd(), '.data', 'actions');
const mem = new Map<string, Action[]>();

function file(sid: string) { return path.join(DIR, `${sid.replace(/[^\w-]/g, '')}.json`); }
export function listActions(sid: string): Action[] {
  if (!mem.has(sid)) {
    try { mem.set(sid, JSON.parse(fs.readFileSync(file(sid), 'utf8'))); } catch { mem.set(sid, []); }
  }
  return mem.get(sid)!;
}
function save(sid: string) {
  try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(file(sid), JSON.stringify(mem.get(sid) ?? [], null, 1)); } catch { /* read-only FS (e.g. serverless): memory only */ }
}
/** Idempotent: returns the existing action (duplicate: true) when an identical one is already saved for this session. */
export function addAction(sid: string, a: Omit<Action, 'id' | 'createdAt'>): Action & { duplicate?: boolean } {
  const key = actionKey(a);
  const existing = listActions(sid).find((x) => actionKey(x) === key);
  if (existing) return { ...existing, duplicate: true };
  const act: Action = { ...a, id: crypto.randomUUID().slice(0, 8), createdAt: new Date().toISOString() };
  listActions(sid).unshift(act); save(sid); return act;
}
export function removeAction(sid: string, id: string): boolean {
  const l = listActions(sid); const i = l.findIndex((a) => a.id === id);
  if (i < 0) return false; l.splice(i, 1); save(sid); return true;
}
export function clearActions(sid: string) { mem.set(sid, []); save(sid); }

