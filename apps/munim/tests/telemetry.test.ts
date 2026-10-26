// Usage events and answer traces (D-057): what may leave the phone, what the server stores, and that nothing is sent
// or stored when no store is configured.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { answerProps, cleanBatch, isInstallId, propsFor, safeProps, safeValue, traceId } from '@/lib/telemetryCore';

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => { void fn(); } }));

describe('safeValue keeps only values that cannot carry a person’s data', () => {
  it.each(['portfolio_xray', 'munim-v4', 'claude-sonnet-4-5', 'up', 'wrong_number', 'xray'])('keeps %s', (v) => expect(safeValue(v)).toBe(v));
  it.each([
    ['an account number', 'acct 50100123456789'],
    ['a phone number', '9876543210'],
    ['an email', 'rohan@example.com'],
    ['a UPI id', 'sunita@ybl'],
    ['a rupee amount', '₹1,25,000'],
    ['an Rs amount', 'Rs. 4500 paid'],
    ['a Hindi question', 'मेरा पैसा कहाँ जा रहा है?'],
    ['long text', 'Where is my money going this month and what should I cut first before salary day comes?'],
  ])('drops %s', (_, v) => expect(safeValue(v)).toBeUndefined());
  it('keeps numbers and booleans, drops objects and NaN', () => {
    expect(safeValue(1234.56789)).toBe(1234.568); expect(safeValue(true)).toBe(true);
    expect(safeValue(NaN)).toBeUndefined(); expect(safeValue({ a: 1 })).toBeUndefined(); expect(safeValue(['x'])).toBeUndefined();
  });
  it('safeProps drops odd keys and caps the count', () => {
    const p = safeProps({ ok: 'yes', 'Bad Key': 'x', __proto__x: 'y', n: 3, ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i])) });
    expect(p.ok).toBe('yes'); expect(p.n).toBe(3); expect('Bad Key' in p).toBe(false); expect(Object.keys(p).length).toBeLessThanOrEqual(20);
  });
});

describe('answer ids and answer metadata', () => {
  it('trace ids are letters only, so the guard never drops them', () => {
    for (let i = 0; i < 200; i++) { const id = traceId(); expect(id).toMatch(/^[a-p]{16}$/); expect(safeValue(id)).toBe(id); }
  });
  it('answerProps carries no question or answer text, and keeps the model name', () => {
    const p = answerProps({ id: traceId(), engine: 'claude', model: 'claude-sonnet-4-5-20250929', prompt: 'munim-v4', tools: ['money_overview', 'money_overview', 'unusual_spending'], ms: 2400,
      check: { ok: false, checked: 4, unverified: ['₹12,400'] }, lang: 'hi', data: 'mine', where: 'phone+relay' });
    expect(p).toMatchObject({ engine: 'claude', model: 'claude-sonnet-4-5', prompt: 'munim-v4', tools: 'money_overview,unusual_spending', steps: 3, ms: 2400, grounded: false, checked: 4, unverified: 1, lang: 'hi', data: 'mine', fallback: false });
    expect(JSON.stringify(p)).not.toMatch(/₹|12,400/);
  });
});

describe('propsFor: only the props each event is allowed (lib/eventNames.ts)', () => {
  it('drops unknown keys, values outside the enum and non-token words', () => {
    expect(propsFor('feedback', { id: 'abcdefghijklmnop', vote: 'up', reason: 'because Ramesh', merchant: 'swiggy' })).toEqual({ id: 'abcdefghijklmnop', vote: 'up' });
    expect(propsFor('screen_viewed', { screen: 'Swiggy Order' })).toEqual({});
    expect(propsFor('ask_sent', { ctx: 'today', turn: 2, via: 'voice', text: 'hi' })).toEqual({ ctx: 'today', turn: 2, via: 'voice' });
    expect(propsFor('statement_read', { format: 'hdfc_savings', ok: 'yes', rows: 40 })).toEqual({ format: 'hdfc_savings', rows: 40 });
  });
  it('install ids must be v4 UUIDs', () => {
    expect(isInstallId('b6f1c2d4-1a2b-4c3d-9e8f-123456789abc')).toBe(true);
    for (const bad of ['9876543210', 'rohan-sharma-01', 'B6F1C2D4-1A2B-4C3D-9E8F-123456789ABC', '']) expect(isInstallId(bad)).toBe(false);
  });
});

describe('cleanBatch', () => {
  const install = 'b6f1c2d4-1a2b-4c3d-9e8f-123456789abc';
  it('rejects a bad install id or a missing list', () => {
    expect(cleanBatch(null)).toBeNull(); expect(cleanBatch({ install: 'RO HAN', events: [] })).toBeNull(); expect(cleanBatch({ install })).toBeNull();
  });
  it('keeps known events only, cleans props, clamps odd timestamps and caps at 50', () => {
    const now = Date.UTC(2026, 9, 26);
    const b = cleanBatch({ install, events: [
      { name: 'screen_viewed', props: { screen: 'today', note: 'paid ₹500 to Sunita' }, at: now - 1000 },
      { name: 'made_up', props: {} },
      { name: 'feedback', props: { id: 'abcdefghijklmnop', vote: 'down', reason: 'wrong_number' }, at: now - 9e9 },
      ...Array.from({ length: 60 }, () => ({ name: 'ask_opened', props: { ctx: 'xray' }, at: now })),
    ] }, now)!;
    expect(b.events.length).toBe(49); // 50 kept from the list, minus the unknown one
    expect(b.events[0]).toEqual({ name: 'screen_viewed', props: { screen: 'today' }, at: now - 1000 });
    expect(b.events[1].at).toBe(now);
  });
});

describe('/api/events and /api/ask with and without a store', () => {
  const env = { ...process.env };
  let calls: { url: string; init: RequestInit }[] = [];
  beforeEach(() => {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(null, { status: 201 }); }));
  });
  afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); vi.resetModules(); });
  const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://munim.test/api/events', { method: 'POST', headers: { 'content-type': 'application/json', host: 'munim.test', ...headers }, body: JSON.stringify(body) });
  const install = 'b6f1c2d4-1a2b-4c3d-9e8f-123456789abc';

  it('with no store: 204 and says so, and nothing is sent anywhere', async () => {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { POST } = await import('@/app/api/events/route');
    const r = await POST(post({ install, events: [{ name: 'ask_opened', props: { ctx: 'today' } }] }));
    expect(r.status).toBe(204); expect(r.headers.get('x-munim-store')).toBe('none'); expect(calls).toEqual([]);
  });

  it('with a store: inserts cleaned rows, refuses other sites, deletes one phone’s rows', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.test/'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    const { POST, DELETE } = await import('@/app/api/events/route');
    const r = await POST(post({ install, events: [{ name: 'feedback', props: { id: 'abcdefghijklmnop', vote: 'up', question: 'मेरा पैसा?' }, at: Date.now() }] }));
    expect(r.status).toBe(200);
    expect(calls[0].url).toBe('https://proj.supabase.test/rest/v1/events');
    const rows = JSON.parse(String(calls[0].init.body));
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ install, name: 'feedback', props: { id: 'abcdefghijklmnop', vote: 'up' } });
    expect((await POST(post({ install, events: [] }, { origin: 'https://evil.example' }))).status).toBe(403);
    const del = await DELETE(new Request('https://munim.test/api/events', { method: 'DELETE', headers: { host: 'munim.test' }, body: JSON.stringify({ install }) }));
    expect(del.status).toBe(200);
    const dels = calls.filter((c) => c.init.method === 'DELETE').map((c) => c.url).sort();
    expect(dels).toEqual([`https://proj.supabase.test/rest/v1/events?install=eq.${install}`, `https://proj.supabase.test/rest/v1/sample_traces?install=eq.${install}`]);
    expect((await DELETE(new Request('https://munim.test/api/events', { method: 'DELETE', headers: { host: 'munim.test' }, body: JSON.stringify({ install: 'x' }) }))).status).toBe(400);
  });

  const ask = async (body: Record<string, unknown>, headers: Record<string, string> = {}) => {
    const { POST } = await import('@/app/api/ask/route');
    return POST(new Request('https://munim.test/api/ask', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Where is my money going?' }], offline: true, ...body }) }));
  };
  it('/api/ask keeps no trace without an install id (usage off) or with a browser privacy signal', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    expect((await ask({})).status).toBe(200);
    expect((await ask({ install }, { 'sec-gpc': '1' })).status).toBe(200);
    expect((await ask({ install: '9876543210' })).status).toBe(200);
    await new Promise((res) => setTimeout(res, 0));
    expect(calls.filter((c) => c.url.includes('sample_traces'))).toEqual([]);
  });

  it('/api/ask returns a trace id and, with a store and usage on, keeps the sample-family trace redacted', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    const q = 'My PAN is ABCDE1234F and my UPI is rohan@okhdfc. Where is my money going?';
    const r = await ask({ messages: [{ role: 'user', content: q }], install });
    const j = await r.json();
    expect(r.status).toBe(200); expect(j.trace).toMatch(/^[a-p]{16}$/); expect(j.prompt).toMatch(/^munim-v\d+$/);
    await new Promise((res) => setTimeout(res, 0));
    const saved = calls.find((c) => c.url.endsWith('/rest/v1/sample_traces'));
    expect(saved).toBeTruthy();
    const row = JSON.parse(String(saved!.init.body))[0];
    expect(row.id).toBe(j.trace); expect(row.install).toBe(install); expect(row.question).toContain('Where is my money going?');
    expect(JSON.stringify(row)).not.toMatch(/ABCDE1234F|rohan@okhdfc/);
  });
});
