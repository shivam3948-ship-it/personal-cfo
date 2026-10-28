// Two versions of the app from one config (D-062): AI on (Claude + Sarvam when keys exist) and AI off (rules engine +
// browser voice). A link can switch models off for one browser, never on.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiConfig } from '@/lib/aiConfig';

const req = (cookie = '') => new Request('https://munim.test/api/ask', { headers: cookie ? { cookie } : {} });
const KEYS = { ANTHROPIC_API_KEY: 'k', SARVAM_API_KEY: 's' };

describe('aiConfig', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it('with keys: Claude and Sarvam', () => {
    vi.stubEnv('SARVAM_API_KEY', 's');
    expect(aiConfig(req(), KEYS)).toMatchObject({ chat: 'claude', stt: 'sarvam', tts: 'sarvam' });
  });
  it('MUNIM_AI=off turns every model off', () => {
    vi.stubEnv('SARVAM_API_KEY', 's');
    expect(aiConfig(req(), { ...KEYS, MUNIM_AI: 'off' })).toMatchObject({ chat: 'rules', model: null, stt: 'browser', tts: 'browser' });
  });
  it('?ai=off (cookie) turns models off for that browser only', () => {
    vi.stubEnv('SARVAM_API_KEY', 's');
    expect(aiConfig(req('x=1; munim_ai=off'), KEYS)).toMatchObject({ chat: 'rules', stt: 'browser', tts: 'browser' });
    expect(aiConfig(req('munim_ai=on'), KEYS).chat).toBe('claude');
  });
  it('a link cannot turn models on without a key', () => {
    expect(aiConfig(req('munim_ai=on'), {}).chat).toBe('rules');
  });
  it('voice can be browser-only while Claude stays on, and the model is configurable', () => {
    vi.stubEnv('SARVAM_API_KEY', 's');
    expect(aiConfig(req(), { ...KEYS, MUNIM_STT: 'browser', MUNIM_CHAT_MODEL: 'claude-haiku-4-5-20251001' })).toMatchObject({ chat: 'claude', model: 'claude-haiku-4-5-20251001', stt: 'browser', tts: 'sarvam' });
  });
});

describe('routes follow the switch', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.unstubAllGlobals(); });
  it('/api/ask answers with the rules engine for ?ai=off even with a key, and calls nothing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-not-real');
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy);
    const { POST } = await import('@/app/api/ask/route');
    const r = await POST(new Request('https://munim.test/api/ask', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'munim_ai=off' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Where is my money going?' }] }) }));
    const j = await r.json();
    expect(r.status).toBe(200); expect(j.engine).toBe('offline'); expect(j.fallback).toBe(false); expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('the relay says "no key" (503) so the phone answers itself', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-not-real');
    const { POST } = await import('@/app/api/ask/relay/route');
    const r = await POST(new Request('https://munim.test/api/ask/relay', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://munim.test', host: 'munim.test', cookie: 'munim_ai=off' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], lang: 'en', asOf: '2026-10-01' }) }));
    expect(r.status).toBe(503);
  });
  it('speech routes send the browser to its own voice', async () => {
    vi.stubEnv('SARVAM_API_KEY', 's');
    const tts = await import('@/app/api/tts/route'), stt = await import('@/app/api/stt/route');
    const c = { cookie: 'munim_ai=off', 'content-type': 'application/json' };
    expect((await tts.POST(new Request('https://munim.test/api/tts', { method: 'POST', headers: c, body: JSON.stringify({ text: 'hi', lang: 'en' }) }))).status).toBe(501);
    expect(await (await stt.GET(new Request('https://munim.test/api/stt', { headers: c }))).json()).toEqual({ configured: false });
    expect(await (await stt.GET(new Request('https://munim.test/api/stt'))).json()).toEqual({ configured: true });
  });
});
