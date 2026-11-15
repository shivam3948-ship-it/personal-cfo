import { describe, it, expect } from 'vitest';
import { sentenceSpeaker } from '@/lib/agent/claude';
import { knownProducts } from '@/lib/agent/brands';

// D-100: sentences go to the voice as they're written, only if each passes the whole-answer checks.
const known = knownProducts([], [], [], []);
const run = (deltas: string[], results: unknown[], judge = false) => {
  const said: string[] = [];
  const sp = sentenceSpeaker({ adviceMode: 'guided', ...(judge ? { judge: async () => null } : {}) }, results, [], known, (s) => said.push(s));
  for (const d of deltas) sp.push(d); sp.end();
  return { said, stopped: sp.stopped };
};

describe('speaking the answer while it is written', () => {
  const results = [{ spent: 5874, food: 1044 }]; // tool results are in rupees (they're spoken)
  it('says each checked sentence as soon as it ends, split across deltas, decimals kept whole', () => {
    const r = run(['सितंबर में आपने ₹5,8', '74 ख़र्च किए। खाने पर ₹1,04', '4 गया, यानी 1.5 गुना? चाहें तो ', 'और बताऊँ।'], [{ spent: 5874, food: 1044, times: 1.5 }]);
    expect(r.said).toEqual(['सितंबर में आपने ₹5,874 ख़र्च किए।', 'खाने पर ₹1,044 गया, यानी 1.5 गुना?', 'चाहें तो और बताऊँ।']);
  });
  it('stops at the first sentence with a figure no tool gave, and says nothing after it', () => {
    const r = run(['You spent ₹5,874 in September. ', 'Rent was ₹99,999. ', 'Food was ₹1,044.'], results);
    expect(r.said).toEqual(['You spent ₹5,874 in September.']); expect(r.stopped).toBe(true);
  });
  it('an investment sentence waits for the AI check when it is on', () => {
    const r = run(['You spent ₹5,874. ', 'Your SIP is doing fine.'], results, true);
    expect(r.said).toEqual(['You spent ₹5,874.']); expect(r.stopped).toBe(true);
  });
  it('never says an instruction to sell what you hold', () => {
    const r = run(['You spent ₹5,874. ', 'Sell your mutual funds now.'], results);
    expect(r.said).toEqual(['You spent ₹5,874.']);
  });
});
