// The Next.js API routes, re-implemented in the browser so the demo runs as one static page.
// Same lib/ code: ingestion, engine, offline agent, tools, actions. No server, no keys.
import demoFiles from './.gen/demo-files.json';
import type { Dataset } from '../lib/types';
import { ingest } from '../lib/ingest';
import { runOffline, clearPending } from '../lib/agent/offline';
import { detectLang, forSpeech } from '../lib/agent/lang';
import { asOfDate, cashflowCheck, coverage, creditView, emergencyFund, leaks, monthPictures, unusual, upcoming } from '../lib/finance/picture';
import { inr } from '../lib/money';
import { clearActions, gcalLink, listActions, removeAction, toIcs } from '../lib/actions';

const enc = new TextEncoder();
let demo: Promise<Dataset> | null = null;
const uploads = new Map<string, Dataset>();
const loadDemo = () => (demo ??= ingest((demoFiles as { name: string; text: string }[]).map((f) => ({ name: f.name, bytes: enc.encode(f.text) })), 'Sample data', { useLlm: false }));
const datasetFor = async (sid: string) => uploads.get(sid) ?? loadDemo();
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });

async function handle(url: URL, init: RequestInit, sid: string): Promise<Response> {
  const p = url.pathname; const method = (init.method ?? 'GET').toUpperCase();
  if (p === '/api/data') {
    const ds = await datasetFor(sid);
    const R = (x: number | null | undefined) => (x === null || x === undefined ? null : inr(x));
    const last = monthPictures(ds).filter((m) => m.complete).at(-1); const cf = cashflowCheck(ds); const cr = creditView(ds);
    return json({
      label: ds.label, usingUploads: uploads.has(sid), status: { claude: false, model: null, sarvam: false, webDemo: true },
      counts: { transactions: ds.txns.length, loans: ds.loans.length, policies: ds.policies.length, notices: ds.notices.length, credit: !!ds.credit }, log: ds.log,
      snapshot: { asOf: asOfDate(ds), balance: R(cf.balance), balanceDate: cf.balanceDate, lastMonth: last ? { key: last.key, income: R(last.income), spend: R(last.spend), committed: R(last.committed), surplus: R(last.surplus), savingsRatePct: last.savingsRatePct } : null, duesBeforeSalary: R(cf.duesTotal), nextSalary: cf.nextSalary, afterDues: R(cf.balanceAfterDues), upcoming: upcoming(ds).slice(0, 5).map((d) => ({ date: d.date, title: d.title, amount: R(d.amount) })), flags: leaks(ds).filter((l) => l.kind !== 'subscription').length + unusual(ds).length, credit: cr ? { score: cr.score, change: cr.change } : null, emergencyMonths: emergencyFund(ds).months, months: coverage(ds).map((c) => c.key) },
    });
  }
  if (p === '/api/agent') {
    const body = JSON.parse(String(init.body ?? '{}')) as { messages?: { role: 'user' | 'assistant'; content: string }[]; lang?: 'hi' | 'en' | 'auto'; reset?: boolean };
    if (body.reset) { clearPending(sid); return json({ ok: true }); }
    const messages = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-12);
    const lang = detectLang(messages.at(-1)?.content ?? '', body.lang ?? 'auto');
    const r = await runOffline(messages, { ds: await datasetFor(sid), sid, lang });
    return json({ ...r, speech: forSpeech(r.answer, r.lang) });
  }
  if (p === '/api/stt' || p === '/api/tts') return json({ error: 'Not in the browser demo', fallback: 'browser' }, 501);
  if (p === '/api/upload') {
    if (method === 'DELETE') { uploads.delete(sid); clearPending(sid); return json({ ok: true }); }
    const files = (init.body as FormData).getAll('files').filter((f): f is File => f instanceof File);
    const ds = await ingest(await Promise.all(files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))), 'Your uploads', { useLlm: false });
    uploads.set(sid, ds); clearPending(sid);
    return json({ ok: true, log: ds.log });
  }
  if (p === '/api/actions') {
    if (method === 'DELETE') { const id = url.searchParams.get('id'); if (id === 'all') clearActions(sid); else if (id) removeAction(sid, id); return json({ ok: true }); }
    return json({ actions: listActions(sid).map((a) => ({ ...a, gcal: gcalLink(a) })) });
  }
  return json({ error: 'Not found' }, 404);
}

export function installLocalApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    const sid = new Headers(init.headers).get('x-sid') ?? 'demo';
    try { return await handle(url, init, sid); } catch (e) { return json({ error: (e as Error).message }, 500); }
  };
  // Calendar files: the sandbox blocks page-started downloads, so use the downloads capability when granted.
  document.addEventListener('click', async (ev) => {
    const a = (ev.target as HTMLElement).closest('a');
    const m = a?.getAttribute('href')?.match(/^\/api\/actions\/([^/]+)\/ics\?sid=(.*)$/);
    if (!m) return;
    ev.preventDefault();
    const action = listActions(decodeURIComponent(m[2])).find((x) => x.id === m[1]);
    if (!action) return;
    const claude = (window as unknown as { claude?: { use: (n: string) => Promise<{ save: (f: { filename: string; data: string }) => Promise<unknown> } | null> } }).claude;
    const downloads = claude ? await claude.use('downloads') : null;
    if (downloads) { try { await downloads.save({ filename: `munim-${action.id}.ics`, data: toIcs(action) }); } catch { /* viewer declined */ } }
    else if (!claude) {
      // Ordinary hosting (Netlify etc.): a normal file download works.
      const url = URL.createObjectURL(new Blob([toIcs(action)], { type: 'text/calendar' }));
      const link = Object.assign(document.createElement('a'), { href: url, download: `munim-${action.id}.ics` });
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } else { const g = gcalLink(action); if (g) window.open(g, '_blank', 'noopener'); }
  });
}
