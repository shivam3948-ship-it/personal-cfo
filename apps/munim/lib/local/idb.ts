'use client';
// Tiny IndexedDB key-value store for data that lives on this phone only. Falls back to memory (private mode).
const DB = 'munim', STORE = 'local';
const mem = new Map<string, unknown>();
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => { const q = fn(d.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
export async function idbGet<T>(key: string): Promise<T | undefined> { try { const v = await tx('readonly', (s) => s.get(key)); return (v as T | undefined) ?? (mem.get(key) as T | undefined); } catch { return mem.get(key) as T | undefined; } }
export async function idbPut(key: string, value: unknown) { mem.set(key, value); try { await tx('readwrite', (s) => s.put(value, key)); } catch { /* memory only */ } }
export async function idbDel(key: string) { mem.delete(key); try { await tx('readwrite', (s) => s.delete(key)); } catch { /* nothing stored */ } }
