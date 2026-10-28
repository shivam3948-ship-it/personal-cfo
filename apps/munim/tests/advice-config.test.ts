// Advice behind a config (D-066): off unless MUNIM_ADVICE=on, a 16+ character MUNIM_ADVICE_KEY, and a browser holding that
// key in an httpOnly cookie. Everyone else keeps the education-only modes.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adviceKeyValid, adviceToken, adviceUnlocked } from '@/lib/adviceUnlock';
import { runTool } from '@/lib/agent/tools';
import { loadDemo } from '@core/demo';
import { DISCLAIMER, namesFunds } from '@/lib/advice';

const KEY = 'k3y-for-tests-0123456789';
const ON = { MUNIM_ADVICE: 'on', MUNIM_ADVICE_KEY: KEY };
const TOKEN = adviceToken(ON)!; // the cookie holds this keyed hash, never the key
const req = (cookie = '', extra: Record<string, string> = {}) => new Request('https://munim.test/api/x', { headers: { ...(cookie ? { cookie } : {}), ...extra } });

describe('the unlock', () => {
  it('needs the switch on, a long enough key, and the exact key', () => {
    expect(adviceKeyValid(KEY, ON)).toBe(true);
    expect(adviceKeyValid(KEY, { MUNIM_ADVICE_KEY: KEY })).toBe(false);                     // switch off (default)
    expect(adviceKeyValid('short', { MUNIM_ADVICE: 'on', MUNIM_ADVICE_KEY: 'short' })).toBe(false); // weak key refused
    expect(adviceKeyValid(KEY + 'x', ON)).toBe(false); expect(adviceKeyValid('', ON)).toBe(false); expect(adviceKeyValid(undefined, ON)).toBe(false);
  });
  it('reads only its own cookie', () => {
    expect(adviceUnlocked(req(`a=1; munim_advice=${TOKEN}`), ON)).toBe(true);
    expect(adviceUnlocked(req(`munim_advice=${encodeURIComponent(KEY)}`), ON)).toBe(false); // the raw key is not the token
    expect(adviceUnlocked(req('munim_advice=guess'), ON)).toBe(false);
    expect(adviceUnlocked(req('munim_advice=%E0%A4'), ON)).toBe(false); // malformed: locked, no throw
    expect(adviceUnlocked(req(`munim_advice=${TOKEN}`), { ...ON, MUNIM_ADVICE: 'off' })).toBe(false); // owner switched it off: every unlock stops
    expect(adviceUnlocked(req(`munim_advice=${TOKEN}`), { ...ON, MUNIM_ADVICE_KEY: KEY + 'new' })).toBe(false); // a new key locks every browser
  });
  it('private mode names funds and carries the honest disclaimer', () => {
    expect(namesFunds('private')).toBe(true); expect(namesFunds('guided')).toBe(false); expect(namesFunds('demo')).toBe(false);
    expect(DISCLAIMER.private.en).toMatch(/not a SEBI-registered investment adviser/); expect(DISCLAIMER.private.en).not.toMatch(/not investment advice/);
  });
});

describe('routes and tools follow the server-checked mode', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it('/api/advice: right key sets an httpOnly cookie; wrong key gets the same refusal as advice-off', async () => {
    vi.stubEnv('MUNIM_ADVICE', 'on'); vi.stubEnv('MUNIM_ADVICE_KEY', KEY);
    const { POST, DELETE, GET } = await import('@/app/api/advice/route');
    const post = (key: string) => POST(new Request('https://munim.test/api/advice', { method: 'POST', headers: { 'content-type': 'application/json', host: 'munim.test', origin: 'https://munim.test', 'x-forwarded-for': '9.9.9.9' }, body: JSON.stringify({ key }) }));
    const bad = await post('wrong-key-wrong-key'); expect(bad.status).toBe(403); expect(bad.headers.get('set-cookie')).toBeNull();
    const ok = await post(KEY); expect(ok.status).toBe(200);
    const sc = ok.headers.get('set-cookie') ?? ''; expect(sc).toContain(`munim_advice=${TOKEN}`); expect(sc).not.toContain(KEY); expect(sc).toMatch(/HttpOnly/i); expect(sc).toMatch(/Secure/i);
    expect(await (await GET(req(`munim_advice=${TOKEN}`))).json()).toEqual({ advice: true });
    expect((await DELETE(new Request('https://munim.test/api/advice', { method: 'DELETE', headers: { host: 'munim.test' } }))).headers.get('set-cookie')).toMatch(/Max-Age=0/i);
    expect((await POST(new Request('https://munim.test/api/advice', { method: 'POST', headers: { origin: 'https://evil.example', host: 'munim.test' }, body: '{}' }))).status).toBe(403);
  });
  it('the session is private only with the cookie', async () => {
    vi.stubEnv('MUNIM_ADVICE', 'on'); vi.stubEnv('MUNIM_ADVICE_KEY', KEY);
    const { getSession } = await import('@/lib/session');
    expect((await getSession(req(`munim_advice=${TOKEN}`))).adviceMode).toBe('private');
    expect((await getSession(req())).adviceMode).not.toBe('private');
  });
  it('advice_picks answers only in advice mode, and says when no pick is set up', async () => {
    const ds = await loadDemo(); const base = { ds, sid: 't', lang: 'en' as const, addAction: (() => ({})) as never };
    expect((await runTool('advice_picks', {}, { ...base, adviceMode: 'guided' })).result.error).toMatch(/only available/);
    const r = (await runTool('advice_picks', { need: 'liquid' }, { ...base, adviceMode: 'private', picks: async () => (await import('@/lib/server/advicePicks')).PICKS })).result;
    expect(r.no_pick_yet).toEqual(['liquid']); expect(r.disclaimer).toBe(DISCLAIMER.private.en);
  });
});
