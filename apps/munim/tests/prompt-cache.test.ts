// Prompt caching (D-073): instructions, tools and the conversation so far are marked cacheable on every model call, the
// original messages are never changed, the answer is the same, and MUNIM_PROMPT_CACHE=off sends the plain request.
import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { loadDemo } from '@core/demo';
import { cachedSystem, cacheOn, runClaude, withCacheMark } from '@/lib/agent/claude';

const reply = (text: string): Anthropic.Message => ({ id: 'm', type: 'message', role: 'assistant', model: 'x', content: [{ type: 'text', text, citations: null }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 } } as unknown as Anthropic.Message);

describe('prompt caching', () => {
  it('marks the instructions and only the last message, without changing the originals', () => {
    expect(cachedSystem('hi')).toEqual([{ type: 'text', text: 'hi', cache_control: { type: 'ephemeral' } }]);
    const msgs: Anthropic.MessageParam[] = [{ role: 'user', content: 'a' }, { role: 'assistant', content: [{ type: 'text', text: 'b' }] }, { role: 'user', content: 'c' }];
    const out = withCacheMark(msgs);
    expect(out[2]).toEqual({ role: 'user', content: [{ type: 'text', text: 'c', cache_control: { type: 'ephemeral' } }] });
    expect(out[0]).toBe(msgs[0]); expect(msgs[2].content).toBe('c'); // originals untouched
    expect(withCacheMark([])).toEqual([]);
  });
  it('is on unless switched off', () => { expect(cacheOn({})).toBe(true); expect(cacheOn({ MUNIM_PROMPT_CACHE: 'off' })).toBe(false); });
  it('every call of an answer is marked, and the answer reports its model calls', async () => {
    const ds = await loadDemo(); const bodies: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const client = { messages: { create: async (b: Anthropic.MessageCreateParamsNonStreaming) => { bodies.push(b); return reply('Your card bill is due on 24 October.'); } } };
    const r = await runClaude([{ role: 'user', content: 'When is my card bill due?' }], { ds, sid: 't', lang: 'en', adviceMode: 'guided', addAction: (() => ({})) as never }, client);
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) {
      expect(Array.isArray(b.system) && (b.system as Anthropic.TextBlockParam[])[0].cache_control).toEqual({ type: 'ephemeral' });
      expect(JSON.stringify(b.messages.at(-1))).toContain('"cache_control"');
    }
    expect(r.llm).toMatchObject({ calls: bodies.length, cacheRead: 3000 * bodies.length });
  });
});
