import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromExtraction } from '@/lib/ingest/llmExtract';
import { sarvamStt, sarvamTts } from '@/lib/voice/sarvam';

describe('LLM extraction payload → typed data', () => {
  it('converts rupees to paise and validates required loan fields', () => {
    const x = fromExtraction({ kind: 'loan', account_last4: 'XX9999', loan: { lender: 'Test Bank', type: 'home', principal: 2500000, rate_pct: 8.5, tenure_months: 240, emi: 21696, first_emi_date: '05-01-2025', prepay_after_emis: 0, prepay_charge_pct: 0 } }, 'l.pdf');
    expect(x.loan).toMatchObject({ id: 'loan:9999', principal: 250000000, emi: 2169600, firstEmiDate: '2025-01-05', type: 'home' });
    expect(fromExtraction({ kind: 'loan', loan: { lender: 'x' } }, 'l2').loan).toBeUndefined();
  });
  it('transactions and notices', () => {
    const x = fromExtraction({ kind: 'sms_alerts', account_last4: '4521', transactions: [{ date: '2026-10-01', description: 'UPI/SWIGGY', amount: 450.5, direction: 'debit', balance: 1000 }], notice: { kind: 'price_change', merchant: 'Netflix', old_price: 649, new_price: 799, effective_date: '2026-10-18' } }, 's.txt');
    expect(x.txns[0]).toMatchObject({ amount: 45050, balance: 100000, source: 'sms', account: 'bank:4521' });
    expect(x.notice!.data).toMatchObject({ oldPrice: 64900, newPrice: 79900, effective: '2026-10-18' });
  });
});

describe('Sarvam client (mocked fetch)', () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.SARVAM_API_KEY; });
  it('STT sends multipart with model and language code, reads the transcript', async () => {
    process.env.SARVAM_API_KEY = 'k';
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ transcript: ' मेरा पैसा ', language_code: 'hi-IN' }), { status: 200 }); });
    const r = await sarvamStt(new Blob(['x'], { type: 'audio/webm' }), 'a.webm', 'auto');
    expect(r).toMatchObject({ transcript: 'मेरा पैसा', languageCode: 'hi-IN' });
    const body = calls[0].init.body as FormData;
    expect(calls[0].url).toBe('https://api.sarvam.ai/speech-to-text');
    expect((calls[0].init.headers as Record<string, string>)['api-subscription-key']).toBe('k');
    expect(body.get('model')).toBe('saaras:v4'); expect(body.get('language_code')).toBe('unknown');
  });
  it('STT strips codec parameters from the browser MIME type and retries as octet-stream on a format error', async () => {
    process.env.SARVAM_API_KEY = 'k';
    const types: string[] = []; const names: string[] = [];
    vi.stubGlobal('fetch', async (_: string, init: RequestInit) => {
      const f = (init.body as FormData).get('file') as File; types.push(f.type); names.push(f.name);
      if (types.length === 1) return new Response('{"error":{"message":"Invalid file type: audio/webm"}}', { status: 400 });
      return new Response(JSON.stringify({ transcript: 'ok' }), { status: 200 });
    });
    const r = await sarvamStt(new Blob(['x'], { type: 'audio/webm;codecs=opus' }), 'speech.webm', 'hi');
    expect(r.transcript).toBe('ok');
    expect(types).toEqual(['audio/webm', 'application/octet-stream']);
    expect(names).toEqual(['speech.webm', 'speech.webm']);
  });
  it('STT does not retry on auth errors', async () => {
    process.env.SARVAM_API_KEY = 'bad'; let n = 0;
    vi.stubGlobal('fetch', async () => { n++; return new Response('{"error":"invalid_api_key_error"}', { status: 403 }); });
    await expect(sarvamStt(new Blob(['x'], { type: 'audio/mp4' }), 'speech.webm')).rejects.toThrow(/403/);
    expect(n).toBe(1);
  });
  it('TTS falls back across request shapes on 4xx and accepts either response field', async () => {
    process.env.SARVAM_API_KEY = 'k';
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (_: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body)); bodies.push(b);
      if ('target_language_code' in b && 'model' in b) return new Response('{"error":"unknown field"}', { status: 422 });
      return new Response(JSON.stringify({ audios: ['SUQzBAAAAAAA'] }), { status: 200 });
    });
    const r = await sarvamTts('नमस्ते', 'hi');
    expect(r.attempt).toBe(2); expect(r.mime).toBe('audio/mpeg');
    expect(bodies[1]).toMatchObject({ language_code: 'hi-IN', model: 'bulbul:v3' });
  });
  it('TTS stops retrying on auth errors', async () => {
    process.env.SARVAM_API_KEY = 'bad'; let n = 0;
    vi.stubGlobal('fetch', async () => { n++; return new Response('unauthorised', { status: 403 }); });
    await expect(sarvamTts('hi', 'en')).rejects.toThrow(/403/); expect(n).toBe(1);
  });
});
