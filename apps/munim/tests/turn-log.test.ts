import { describe, it, expect, vi, afterEach } from 'vitest';
import { turnCost, priceOf, rupees } from '../lib/cost';
import { cleanTurn, draftCase, flagsOf, summarize, type TurnRecord } from '../lib/turnLog';
import { isOwner, ownerKeyValid, ownerToken, OWNER_COOKIE } from '../lib/ownerUnlock';

// D-089: references computed separately (python, list prices of 7 Nov 2026, ₹94.7 a dollar)
describe('turn cost', () => {
  it('prices a voice turn part by part', () => {
    const c = turnCost({ model: 'claude-sonnet-5-5', llm: { input: 3000, cacheRead: 10000, cacheWrite: 0, output: 400 }, judgeModel: 'claude-haiku-4-5-20251001', judge: { input: 800, output: 30 }, sttMs: 4200, ttsChars: 180 });
    expect(c).toEqual({ llm: 1_041_700, judge: 89_965, stt: 40_833, tts: 540_000, total: 1_712_498, unpriced: [] });
    expect(c.llm + c.judge + c.stt + c.tts).toBe(c.total);
    expect(rupees(c.total)).toBe('₹1.71'); expect(rupees(c.stt)).toBe('₹0.0408');
  });
  it('never takes Sonnet 5 prices for Sonnet 5.5, and says when a model is not in the table', () => {
    expect(priceOf('claude-sonnet-5-5')!.cacheRead).toBe(100); expect(priceOf('claude-sonnet-5')!.cacheRead).toBe(200);
    const c = turnCost({ model: 'some-new-model', llm: { input: 10, output: 10 } });
    expect(c.unpriced).toEqual(['some-new-model']); expect(c.llm).toBe(0);
  });
  it('a typed turn on the rules engine costs nothing', () => { expect(turnCost({}).total).toBe(0); });
});

const base = (x: Partial<TurnRecord> = {}): TurnRecord => ({ id: 'abcdefghijklmnop', at: '2026-11-07T05:00:00.000Z', data: 'mine', via: 'voice', lang: 'en', question: 'What did I spend on food?',
  answer: 'You spent ₹4,200 on food delivery.', engine: 'claude', model: 'claude-sonnet-5-5', tools: ['spending_breakdown'], check: { ok: true, checked: 1, unverified: 0 }, ms: { stt: 900, agent: 4000, firstWord: 1200, total: 6100 }, ...x });

describe('turn log', () => {
  it('flags the turns that need a look', () => {
    expect(flagsOf(base())).toEqual([]);
    expect(flagsOf(base({ vote: 'down', check: { ok: false, checked: 2, unverified: 1 }, ms: { agent: 9000, total: 12000 } }))).toEqual(['thumbs_down', 'unverified_numbers', 'slow']);
    const tap = base({ cutIn: { how: 'tap', frames: 300, ms: 5000, floor: 0.08, need: 0.2, peak: 0.16, p90: 0.1, triggered: false } });
    expect(flagsOf(tap)).toEqual(['tapped_to_cut_in', 'cut_in_missed']); // loudest 0.16 is 80% of the bar: nearly heard
    expect(flagsOf({ ...tap, cutIn: { ...tap.cutIn!, peak: 0.05 } })).toEqual(['tapped_to_cut_in']);
  });
  it('turns a bad turn into a draft eval case that compiles as a line of evals/cases.ts', () => {
    const d = draftCase(base({ vote: 'down', reason: 'wrong_number', question: "What's my SIP?" }), 1);
    expect(d).toContain("c('real-2026-11-07-1', 'routing_en', 'What\\'s my SIP?', ['spending_breakdown']");
    expect(d).toContain('thumbs_down, wrong_number');
  });
  it('the server keeps only the known shape', () => {
    const t = cleanTurn({ ...base(), engine: 'claude; drop table', tools: ['ok_tool', 'bad tool!'], question: 'x'.repeat(5000), extra: 'nope', cutIn: { how: 'voice', need: 0.2, peak: 0.4, triggered: true, ctx: 'running' } })!;
    expect(t.engine).toBe('unknown'); expect(t.tools).toEqual(['ok_tool']); expect(t.question.length).toBe(2000);
    expect((t as unknown as Record<string, unknown>).extra).toBeUndefined(); expect(t.cutIn!.triggered).toBe(true);
    expect(cleanTurn({ ...base(), id: '../etc' })).toBeNull(); expect(cleanTurn({ ...base(), via: 'shout' })).toBeNull();
  });
  it('summarises latency as medians and costs as sums', () => {
    const s = summarize([base({ ms: { stt: 800, agent: 3000, firstWord: 1000, total: 4800 }, cost: { llm: 100, judge: 0, stt: 10, tts: 20, total: 130, unpriced: [] } }),
      base({ id: 'bbbbbbbbbbbbbbbb', ms: { stt: 1000, agent: 5000, firstWord: 1400, total: 7400 }, cost: { llm: 200, judge: 5, stt: 20, tts: 40, total: 265, unpriced: [] } }),
      base({ id: 'cccccccccccccccc', via: 'typed', ms: { agent: 2000 } })]);
    expect(s.turns).toBe(3); expect(s.voice).toBe(2); expect(s.cost.total).toBe(395); expect(s.cost.perTurn).toBe(198); // two priced turns
    expect(s.cost.llm + s.cost.judge + s.cost.stt + s.cost.tts).toBe(s.cost.total);
    expect(s.agentMs.p50).toBe(3000); expect(s.totalMs.p90).toBe(7400);
  });
});

const KEY = 'owner-key-0123456789abcdef';
const req = (cookie = '') => new Request('https://munim.test/api/x', { headers: cookie ? { cookie } : {} });
describe('owner browsers', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  it('only the keyed cookie marks a browser as the owner’s; the advice key does not', () => {
    const env = { MUNIM_OWNER_KEY: KEY };
    expect(ownerKeyValid(KEY, env)).toBe(true); expect(ownerKeyValid('wrong', env)).toBe(false); expect(ownerKeyValid(KEY, { MUNIM_OWNER_KEY: 'short' })).toBe(false);
    expect(isOwner(req(`${OWNER_COOKIE}=${ownerToken(env)}`), env)).toBe(true);
    expect(isOwner(req(`${OWNER_COOKIE}=${KEY}`), env)).toBe(false); // the cookie holds a keyed hash, never the key
    expect(isOwner(req(`munim_advice=${ownerToken(env)}`), env)).toBe(false);
    expect(isOwner(req(`${OWNER_COOKIE}=${ownerToken(env)}`), {})).toBe(false); // no key on the server: nobody
  });
  it('the log refuses other browsers and redacts what it keeps', async () => {
    vi.stubEnv('MUNIM_OWNER_KEY', KEY); vi.stubEnv('SUPABASE_URL', 'https://db.test'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_x');
    const sent: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_u, init) => { sent.push(String(init?.body ?? '')); return new Response(null, { status: 201 }); });
    const { POST, GET } = await import('@/app/api/turns/route');
    const post = (cookie: string, body: unknown) => POST(new Request('https://munim.test/api/turns', { method: 'POST', headers: { 'content-type': 'application/json', host: 'munim.test', origin: 'https://munim.test', cookie }, body: JSON.stringify(body) }));
    const stranger = await post('', base());
    expect(stranger.status).toBe(204); expect(stranger.headers.get('x-munim-log')).toBe('off'); expect(sent).toEqual([]);
    expect((await GET(new Request('https://munim.test/api/turns'))).status).toBe(403);
    const mine = await post(`${OWNER_COOKIE}=${ownerToken({ MUNIM_OWNER_KEY: KEY })}`, base({ question: 'My PAN is ABCDE1234F, mail me at a.b@example.com' }));
    expect(mine.status).toBe(200); expect(sent).toHaveLength(1);
    expect(sent[0]).not.toMatch(/ABCDE1234F|a\.b@example\.com/); expect(sent[0]).toContain('"flags":[]');
  });
});
