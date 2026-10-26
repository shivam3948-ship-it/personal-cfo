// Where events and sample-data traces go on the server (D-057). Supabase when SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set (server-only key, inserts through PostgREST); otherwise nothing is stored and the
// app works exactly the same. Tables: supabase/migrations/20261026_events.sql.
import type { TelemetryEvent } from './telemetryCore';

const url = () => process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
export const storeConfigured = () => !!(url() && key());
/** The legacy service_role key is a JWT and also goes in Authorization; the newer sb_secret_ keys go in apikey only. */
const auth = (): Record<string, string> => ({ apikey: key()!, ...(key()!.startsWith('eyJ') ? { Authorization: `Bearer ${key()}` } : {}) });

async function insert(table: string, rows: unknown[]): Promise<boolean> {
  if (!storeConfigured() || !rows.length) return false;
  try {
    const r = await fetch(`${url()}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!r.ok) console.error('[events] store refused', table, r.status); // status only: never the rows
    return r.ok;
  } catch { console.error('[events] store unreachable', table); return false; }
}

export function storeEvents(install: string, events: TelemetryEvent[]) {
  return insert('events', events.map((e) => ({ install, name: e.name, props: e.props, at: new Date(e.at).toISOString() })));
}

/** Sample family only: the redacted question and answer, and each tool call with its input, for debugging the agent. */
export interface SampleTrace { id: string; install: string; question: string; answer: string; engine: string; model: string; prompt: string; lang: string; ms: number; grounded: boolean; unverified: number; calls: { tool: string; input: string; ms: number }[] }
export function storeSampleTrace(t: SampleTrace) { return insert('sample_traces', [t]); }

/** Deletes everything one phone sent, events and saved sample questions (when its owner turns usage counts off). */
export async function deleteInstall(install: string): Promise<boolean> {
  if (!storeConfigured()) return false;
  const del = async (table: string) => {
    try {
      const r = await fetch(`${url()}/rest/v1/${table}?install=eq.${encodeURIComponent(install)}`, { method: 'DELETE', headers: { ...auth(), Prefer: 'return=minimal' } });
      if (!r.ok) console.error('[events] delete refused', table, r.status);
      return r.ok;
    } catch { console.error('[events] store unreachable', table); return false; }
  };
  const [a, b] = await Promise.all([del('events'), del('sample_traces')]);
  return a && b;
}
