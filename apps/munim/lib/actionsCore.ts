// Actions the agent can take, the pure part: shapes, the duplicate key, calendar files and links. Used on the server
// (lib/actions.ts keeps them per chat) and on the phone (lib/local/askLocal.ts keeps them in this browser).
export type ActionKind = 'reminder' | 'email' | 'goal' | 'prepayment_plan';
export interface Action {
  id: string; kind: ActionKind; title: string; createdAt: string;
  reminder?: { date: string; time?: string; notes?: string };
  email?: { to: string; subject: string; body: string };
  goal?: { target: number; byDate: string; monthlyNeeded: number; avgSurplus: number | null; feasible: boolean | null };
  plan?: { loanId: string; amount: number; date: string; interestSaved: number; monthsSaved: number };
}

/** What makes two actions "the same": a retry, a double "haan" or a repeated tool call must not create a second one. */
export function actionKey(a: Omit<Action, 'id' | 'createdAt'>): string {
  return [a.kind, a.title.trim().toLowerCase(), a.reminder?.date, a.reminder?.time, a.email?.to, a.goal?.target, a.goal?.byDate, a.plan?.loanId, a.plan?.amount, a.plan?.date].map((x) => x ?? '').join('|');
}

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
export const nextDay = (iso: string) => new Date(Date.parse(iso + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);

/** Google Calendar "add event" link as a second way to save a reminder on a phone. */
export function gcalLink(a: Action): string | null {
  const r = a.reminder ?? (a.plan ? { date: a.plan.date, notes: a.title } : null);
  if (!r) return null;
  const d = r.date.replace(/-/g, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: a.title, dates: `${d}/${nextDay(r.date).replace(/-/g, '')}`, details: r.notes ?? '' });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
