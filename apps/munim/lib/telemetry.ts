'use client';
// Sends usage events and answer metadata from the phone (D-057). Every event passes propsFor() first: only the props
// lib/eventNames.ts allows for that event, never question or answer text, amounts, names or identifiers. Events queue
// in this browser and go to /api/events in batches. Nothing is sent:
//   · before the notice on Welcome has been shown (events wait here until then),
//   · when the person turned usage counts off, or the browser sends Global Privacy Control / Do Not Track,
//   · when the server has no store configured (it says so; the last 500 events stay here, for debugging).
import { idbDel, idbGet, idbPut } from './local/idb';
import { propsFor, type Props, type TelemetryEvent, type TelemetryName } from './telemetryCore';

const QUEUE = 'events_queue', INSTALL = 'install_id', OFF = 'munim_usage_off', NOTICE = 'munim_usage_notice', FORGET = 'events_forget', KEEP = 500;
let queue: TelemetryEvent[] | null = null, storeless = false, timer: ReturnType<typeof setTimeout> | null = null;
// the switch and the notice are kept three ways (memory, localStorage, IndexedDB) so private mode can't lose an "off"
const mem: { off?: boolean; notice?: boolean } = {};
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } } };

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
async function install(): Promise<string> {
  let id = await idbGet<string>(INSTALL);
  if (!id) { id = uuid(); await idbPut(INSTALL, id); }
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
  return mem.off ?? ls.get(OFF) === '1';
}
const noticeSeen = () => mem.notice ?? ls.get(NOTICE) === '1';

/** Welcome calls this when the line saying what is sent is on screen. Until then events only queue on the phone. */
export function noticeShown(): void {
  mem.notice = true; ls.set(NOTICE, '1'); void idbPut(NOTICE, true).catch(() => {});
  if (queue?.length && !timer) timer = setTimeout(() => { void flush(); }, 1000);
}

/** For /api/ask on the sample family: the install id when usage counts are on (so its saved question can be deleted with
 *  the rest), or null, which tells the server to keep nothing. */
export async function usageInstall(): Promise<string | null> {
  if (usageOff() || !noticeSeen()) return null;
  try { return await install(); } catch { return null; }
}

export function send(name: TelemetryName, props: Props = {}): void {
  if (usageOff()) return;
  const ev: TelemetryEvent = { name, props: propsFor(name, props), at: Date.now() };
  void (async () => {
    queue ??= (await idbGet<TelemetryEvent[]>(QUEUE)) ?? [];
    queue.push(ev); if (queue.length > KEEP) queue = queue.slice(-KEEP);
    await idbPut(QUEUE, queue);
    if (!storeless && !timer && noticeSeen()) timer = setTimeout(() => { void flush(); }, 4000);
  })().catch(() => { /* storage unavailable: drop the event */ });
}

export async function flush(): Promise<void> {
  timer = null;
  if (storeless || usageOff() || !noticeSeen() || !queue?.length) return;
  const batch = queue.slice(0, 50);
  try {
    const r = await fetch('/api/events', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ install: await install(), events: batch }) });
    if (r.headers.get('x-munim-store') === 'none') { storeless = true; return; } // nothing configured: keep them here
    if (r.ok) { queue = queue.slice(batch.length); await idbPut(QUEUE, queue); if (queue.length) timer = setTimeout(() => { void flush(); }, 1000); }
  } catch { /* offline: try again with the next event */ }
}

/** Asks the server to delete what one phone sent; remembered until it succeeds (offline, busy server). */
async function forget(id: string): Promise<void> {
  await idbPut(FORGET, id);
  try {
    const r = await fetch('/api/events', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ install: id }) });
    if (r.ok || r.status === 204 || r.status === 400) await idbDel(FORGET); // done, nothing stored, or not an id we can use
  } catch { /* offline: retried on the next visit */ }
}

/** Turn usage counts off (or back on). Off also deletes what this phone sent before, and starts a new random id. */
export async function setUsage(on: boolean): Promise<void> {
  mem.off = !on; ls.set(OFF, on ? null : '1'); await idbPut(OFF, !on).catch(() => {});
  if (on) return;
  if (timer) { clearTimeout(timer); timer = null; }
  queue = []; await idbDel(QUEUE);
  const id = await idbGet<string>(INSTALL);
  await idbDel(INSTALL);
  if (id) await forget(id);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void flush(); });
  void (async () => {
    const [off, notice, pending] = await Promise.all([idbGet<boolean>(OFF), idbGet<boolean>(NOTICE), idbGet<string>(FORGET)]);
    if (off !== undefined && mem.off === undefined) mem.off = off;
    if (notice && mem.notice === undefined) mem.notice = true;
    if (pending) await forget(pending);
  })().catch(() => {});
}
