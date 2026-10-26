'use client';
// Sends usage events and answer metadata from the phone (D-057). Every event passes safeProps() first: no question or
// answer text, amounts, names or identifiers ever leave. Events queue in this browser and go to /api/events in batches.
// Nothing is sent when: the server has no store configured (it says so; the queue stays here, last 500, for debugging),
// the person turned usage counts off, or the browser asks sites not to track (Global Privacy Control / Do Not Track).
import { idbDel, idbGet, idbPut } from './local/idb';
import { safeProps, type Props, type TelemetryEvent, type TelemetryName } from './telemetryCore';

const QUEUE = 'events_queue', INSTALL = 'install_id', OFF = 'munim_usage_off', KEEP = 500;
let queue: TelemetryEvent[] | null = null, storeless = false, timer: ReturnType<typeof setTimeout> | null = null;

const newId = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).toLowerCase();
async function install(): Promise<string> {
  let id = await idbGet<string>(INSTALL);
  if (!id) { id = newId(); await idbPut(INSTALL, id); }
  return id;
}

/** The browser asks sites not to track (Global Privacy Control or Do Not Track): then nothing is sent, whatever the switch. */
export function privacySignal(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return !!nav.globalPrivacyControl || nav.doNotTrack === '1';
}

/** True when this phone sends nothing: turned off here, or the browser's privacy signal. */
export function usageOff(): boolean {
  if (typeof window === 'undefined' || privacySignal()) return true;
  try { return localStorage.getItem(OFF) === '1'; } catch { return false; }
}

export function send(name: TelemetryName, props: Props = {}): void {
  if (usageOff()) return;
  const ev: TelemetryEvent = { name, props: safeProps(props), at: Date.now() };
  void (async () => {
    queue ??= (await idbGet<TelemetryEvent[]>(QUEUE)) ?? [];
    queue.push(ev); if (queue.length > KEEP) queue = queue.slice(-KEEP);
    await idbPut(QUEUE, queue);
    if (!storeless && !timer) timer = setTimeout(() => { void flush(); }, 4000);
  })().catch(() => { /* storage unavailable: drop the event */ });
}

export async function flush(): Promise<void> {
  timer = null;
  if (storeless || usageOff() || !queue?.length) return;
  const batch = queue.slice(0, 50);
  try {
    const r = await fetch('/api/events', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ install: await install(), events: batch }) });
    if (r.headers.get('x-munim-store') === 'none') { storeless = true; return; } // nothing configured: keep them here
    if (r.ok) { queue = queue.slice(batch.length); await idbPut(QUEUE, queue); if (queue.length) timer = setTimeout(() => { void flush(); }, 1000); }
  } catch { /* offline: try again with the next event */ }
}

/** Turn usage counts off (or back on). Off also deletes what this phone sent before and starts a new random id. */
export async function setUsage(on: boolean): Promise<void> {
  try { if (on) localStorage.removeItem(OFF); else localStorage.setItem(OFF, '1'); } catch { /* private mode */ }
  if (on) return;
  if (timer) { clearTimeout(timer); timer = null; }
  queue = []; await idbDel(QUEUE);
  const id = await idbGet<string>(INSTALL);
  if (id) { try { await fetch('/api/events', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ install: id }) }); } catch { /* offline */ } }
  await idbDel(INSTALL);
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { void flush(); });
