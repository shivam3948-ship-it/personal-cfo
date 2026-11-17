import { describe, expect, it } from 'vitest';
import { allow } from '@/lib/ratelimit';
import { sidOf } from '@/lib/http';

describe('cost guards', () => {
  it('rate limit allows N per window, then blocks, then recovers', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(allow('k', 3, 60_000, t0 + i)).toBe(true);
    expect(allow('k', 3, 60_000, t0 + 10)).toBe(false);
    expect(allow('k', 3, 60_000, t0 + 61_000)).toBe(true);
  });
  it('short or underscore session ids fall back to anon', () => {
    const r = (sid: string) => new Request('http://x/api', { headers: { 'x-sid': sid } });
    expect(sidOf(r('abcd'))).toBe('anon');
    expect(sidOf(r('u_aaaaaaaaaaaaaaaaaaaa'))).toBe('anon');
    expect(sidOf(r('3f2b6c1e-9a7d-4c1e-8b2a-1d2e3f4a5b6c'))).toBe('3f2b6c1e-9a7d-4c1e-8b2a-1d2e3f4a5b6c');
  });
});
