import { ingest } from '@/lib/ingest';
import { resetToDemo, setUploads } from '@/lib/store';
import { json, sidOf } from '@/lib/http';
import { clearPending } from '@/lib/agent/offline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_FILES = 40; const MAX_BYTES = 15_000_000;

export async function POST(req: Request) {
  const sid = sidOf(req);
  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return json({ error: 'No files' }, 400);
  if (files.length > MAX_FILES) return json({ error: `At most ${MAX_FILES} files` }, 413);
  if (files.reduce((s, f) => s + f.size, 0) > MAX_BYTES) return json({ error: 'Files too large (15 MB total)' }, 413);
  const inFiles = await Promise.all(files.map(async (f) => ({ name: (f as File & { webkitRelativePath?: string }).name, bytes: new Uint8Array(await f.arrayBuffer()) })));
  const ds = await ingest(inFiles, 'Your uploads', { useLlm: form.get('useLlm') !== 'false' });
  setUploads(sid, ds); clearPending(sid);
  return json({ ok: true, log: ds.log, counts: { transactions: ds.txns.length, loans: ds.loans.length, policies: ds.policies.length, notices: ds.notices.length, credit: !!ds.credit } });
}

export async function DELETE(req: Request) {
  const sid = sidOf(req); resetToDemo(sid); clearPending(sid);
  return json({ ok: true });
}
