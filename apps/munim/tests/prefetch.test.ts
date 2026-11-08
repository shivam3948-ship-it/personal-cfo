import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { loadDemo } from '@core/demo';
import { runClaude } from '@/lib/agent/claude';
import { prefetchTool } from '@/lib/agent/offline';
import { runTool } from '@/lib/agent/tools';

// D-095: one-call answers. The likely tool runs first and goes in as a tool result; the model answers in one call.
const reply = (text: string): Anthropic.Message => ({ id: 'm', type: 'message', role: 'assistant', model: 'claude-test', stop_reason: 'end_turn', stop_sequence: null,
  content: [{ type: 'text', text, citations: null }], usage: { input_tokens: 10, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } as unknown as Anthropic.Message);

describe('prefetch (D-095)', () => {
  it('routes common questions to a read-only tool, and never to an action', () => {
    expect(prefetchTool('When is my next EMI and card bill due?')).toBe('upcoming_dues');
    expect(prefetchTool('मेरा पैसा कहाँ जा रहा है?')).toBe('spending_breakdown');
    expect(prefetchTool('Remind me to pay rent on 1st')).toBeNull();
    expect(prefetchTool('What is my PAN?')).toBeNull();
  });
  it('answers in one model call, with the prefetched figures trusted by the number check', async () => {
    const ds = await loadDemo();
    const ctx = { ds, sid: 't', lang: 'en' as const, adviceMode: 'guided' as const, addAction: (() => ({})) as never };
    const dues = (await runTool('upcoming_dues', {}, ctx)).result as { items?: { amount?: string }[] };
    const figure = JSON.stringify(dues).match(/₹[\d,]+/)?.[0] ?? '';
    expect(figure).not.toBe('');
    const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const client = { messages: { create: async (b: Anthropic.MessageCreateParamsNonStreaming) => { calls.push(b); return reply(`Your next payment is ${figure}.`); } } };
    const r = await runClaude([{ role: 'user', content: 'When is my next EMI and card bill due?' }], { ...ctx, prefetch: true }, client);
    expect(calls).toHaveLength(1);
    const first = JSON.stringify(calls[0].messages);
    expect(first).toContain('"tool_use_id":"prefetch_upcoming_dues"');
    expect(r.trace.map((t) => t.tool)).toEqual(['upcoming_dues']);
    expect(r.check.ok).toBe(true);
    expect(r.llm?.calls).toBe(1);
  });
  it('off by default: the first call carries only the question', async () => {
    const ds = await loadDemo(); const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const client = { messages: { create: async (b: Anthropic.MessageCreateParamsNonStreaming) => { calls.push(b); return reply('Okay.'); } } };
    await runClaude([{ role: 'user', content: 'When is my next EMI due?' }], { ds, sid: 't', lang: 'en', adviceMode: 'guided', addAction: (() => ({})) as never }, client);
    expect(calls[0].messages).toHaveLength(1);
  });
});
