// Actions the agent can take. All are local and reversible: reminders (.ics), email drafts (user sends), goals, prepayment plans.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type ActionKind = 'reminder' | 'email' | 'goal' | 'prepayment_plan';
export interface Action {
  id: string; kind: ActionKind; title: string; createdAt: string;
  reminder?: { date: string; time?: string; notes?: string };
  email?: { to: string; subject: string; body: string };
  goal?: { target: number; byDate: string; monthlyNeeded: number; avgSurplus: number | null; feasible: boolean | null };
  plan?: { loanId: string; amount: number; date: string; interestSaved: number; monthsSaved: number };
}

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
  if (sid.startsWith('u_')) return; // signed-in users: the database is the store (lib/session.ts flushes)
  try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(file(sid), JSON.stringify(mem.get(sid) ?? [], null, 1)); } catch { /* read-only FS (e.g. serverless): memory only */ }
}
/** What makes two actions "the same": a retry, a double "haan" or a repeated tool call must not create a second one. */
export function actionKey(a: Omit<Action, 'id' | 'createdAt'>): string {
  return [a.kind, a.title.trim().toLowerCase(), a.reminder?.date, a.reminder?.time, a.email?.to, a.goal?.target, a.goal?.byDate, a.plan?.loanId, a.plan?.amount, a.plan?.date].map((x) => x ?? '').join('|');
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
/** Replace a session's actions (used when loading a signed-in user's actions from the database). */
export function setActions(sid: string, list: Action[]) { mem.set(sid, [...list]); }

/** RFC 5545 all-day event (or timed, IST) with a 1-day-before alarm. */
export function toIcs(a: Action): string {
  const r = a.reminder ?? (a.plan ? { date: a.plan.date, notes: a.title } : null);
  if (!r) throw new Error('Not a reminder');
  const d = r.date.replace(/-/g, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Munim voice CFO//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${a.id}@munim.local`, `DTSTAMP:${stamp}`,
    ...(r.time ? [`DTSTART;TZID=Asia/Kolkata:${d}T${r.time.replace(':', '')}00`, `DURATION:PT15M`] : [`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${nextDay(r.date).replace(/-/g, '')}`]),
    `SUMMARY:${esc(a.title)}`, `DESCRIPTION:${esc(r.notes ?? '')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(a.title)}`, 'TRIGGER:-P1D', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
const nextDay = (iso: string) => new Date(Date.parse(iso + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);

/** Google Calendar "add event" link as a second way to save a reminder on a phone. */
export function gcalLink(a: Action): string | null {
  const r = a.reminder ?? (a.plan ? { date: a.plan.date, notes: a.title } : null);
  if (!r) return null;
  const d = r.date.replace(/-/g, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: a.title, dates: `${d}/${nextDay(r.date).replace(/-/g, '')}`, details: r.notes ?? '' });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
