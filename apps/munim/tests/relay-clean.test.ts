import { describe, it, expect } from 'vitest';
import { clean } from '@/lib/relayClean';

// 16 Nov: every phone answer that needed a second model call fell back to the rules engine. Sonnet returns a signed thinking block
// with its tool call; the phone sends it back, and the relay's filter refused any block it didn't know, so the turn failed.
describe('relay filter (D-050, fix 16 Nov)', () => {
  const turn = (assistant: unknown[]) => [
    { role: 'user', content: 'मेरे म्यूचुअल फंड के बारे में बताओ' },
    { role: 'assistant', content: assistant },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: JSON.stringify({ funds: 3 }) }] },
  ];
  it('a signed thinking block before a tool call goes back unchanged', () => {
    const out = clean(turn([{ type: 'thinking', thinking: '', signature: 'sig-abc' }, { type: 'tool_use', id: 'tu1', name: 'portfolio_xray', input: {} }]));
    expect(out).not.toBeNull();
    expect((out![1].content as { type: string }[])[0]).toEqual({ type: 'thinking', thinking: '', signature: 'sig-abc' });
  });
  it('a redacted thinking block too', () => {
    expect(clean(turn([{ type: 'redacted_thinking', data: 'xyz' }, { type: 'tool_use', id: 'tu1', name: 'portfolio_xray', input: {} }]))).not.toBeNull();
  });
  it('still refuses thinking from the user, unknown blocks, and tools Munim does not have', () => {
    expect(clean([{ role: 'user', content: [{ type: 'thinking', thinking: 'x', signature: 's' }] }])).toBeNull();
    expect(clean(turn([{ type: 'image', source: {} }]))).toBeNull();
    expect(clean(turn([{ type: 'tool_use', id: 'tu1', name: 'sell_everything', input: {} }]))).toBeNull();
  });
});
