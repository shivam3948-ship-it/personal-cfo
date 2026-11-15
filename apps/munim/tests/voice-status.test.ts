import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { loadDemo } from '@core/demo';
import { runClaude } from '@/lib/agent/claude';
import { TOOLS } from '@/lib/agent/tools';
import { STATUS, statusLine, statusGate } from '@/lib/agent/status';
import { tellsToExit } from '@/lib/agent/tradeWords';

// D-104: while Munim works, the voice says what it is looking at, from the tool actually running.
const msg = (content: unknown[], stop: 'end_turn' | 'tool_use'): Anthropic.Message => ({ id: 'm', type: 'message', role: 'assistant', model: 'claude-test', stop_reason: stop, stop_sequence: null,
  content, usage: { input_tokens: 10, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } as unknown as Anthropic.Message);

describe('spoken status (D-104)', () => {
  it('every line is plain: no figures, no instruction to act on a holding, no product name', () => {
    for (const [tool, l] of Object.entries(STATUS)) for (const s of [l.hi, l.en]) {
      expect(s, tool).not.toMatch(/\d|₹|%/);
      expect(tellsToExit(s), `${tool}: ${s}`).toBe(false);
      expect(s, tool).not.toMatch(/\b(?:buy|invest in|sell|redeem|switch|stop)\b|ख़रीद|बेच|निकाल|बंद/i);
    }
    expect(Object.keys(STATUS).every((k) => TOOLS.some((t) => t.name === k))).toBe(true); // no line for a tool that doesn't exist
  });
  it('advice tools get the plain line, never one that hints at picks', () => {
    for (const t of ['advice_plan', 'advice_picks']) { expect(statusLine(t, 'en')).toBe('Working it out.'); expect(statusLine(t, 'hi')).toBe('हिसाब लगा रहा हूँ।'); }
  });
  it('at most two lines a turn, no repeats, none once the answer has started', () => {
    const g = statusGate();
    expect(g.next('upcoming_dues', 'hi')).toBe('आने वाले बिल और EMI देख रहा हूँ।');
    expect(g.next('upcoming_dues', 'hi')).toBeNull();
    expect(g.next('loans_overview', 'hi')).toBe('लोन देख रहा हूँ।');
    expect(g.next('credit_health', 'hi')).toBeNull();
    const h = statusGate(); h.answering(); expect(h.next('loans_overview', 'en')).toBeNull();
  });
  it('the agent names each tool as it starts: the prefetched one first, then the one the model asks for', async () => {
    const ds = await loadDemo(); const seen: string[] = []; let step = 0;
    const client = { messages: { create: async () => (step++ === 0
      ? msg([{ type: 'tool_use', id: 'u1', name: 'loans_overview', input: {} }], 'tool_use')
      : msg([{ type: 'text', text: 'Okay.', citations: null }], 'end_turn')) } };
    await runClaude([{ role: 'user', content: 'When is my next EMI and card bill due?' }],
      { ds, sid: 't', lang: 'en', adviceMode: 'guided', addAction: (() => ({})) as never, prefetch: true, onTool: (n) => seen.push(n) }, client);
    expect(seen).toEqual(['upcoming_dues', 'loans_overview']);
  });
  it('an action the user did not ask for is refused and not announced', async () => {
    const ds = await loadDemo(); const seen: string[] = []; let step = 0;
    const client = { messages: { create: async () => (step++ === 0
      ? msg([{ type: 'tool_use', id: 'u1', name: 'create_reminder', input: { title: 'x', date: '2026-12-01' } }], 'tool_use')
      : msg([{ type: 'text', text: 'Okay.', citations: null }], 'end_turn')) } };
    await runClaude([{ role: 'user', content: 'How are my loans?' }], { ds, sid: 't', lang: 'en', adviceMode: 'guided', addAction: (() => ({})) as never, onTool: (n) => seen.push(n) }, client);
    expect(seen).toEqual([]);
  });
});

describe('spoken status: a made-up tool name', () => {
  it('is never announced', async () => {
    const ds = await loadDemo(); const seen: string[] = []; let step = 0;
    const client = { messages: { create: async () => (step++ === 0
      ? msg([{ type: 'tool_use', id: 'u1', name: 'sell_everything_now', input: {} }], 'tool_use')
      : msg([{ type: 'text', text: 'Okay.', citations: null }], 'end_turn')) } };
    await runClaude([{ role: 'user', content: 'How are my loans?' }], { ds, sid: 't', lang: 'en', adviceMode: 'guided', addAction: (() => ({})) as never, onTool: (n) => seen.push(n) }, client);
    expect(seen).toEqual([]);
  });
});
