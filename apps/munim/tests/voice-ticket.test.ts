import { describe, it, expect } from 'vitest';
import { signTicket, ticketKey, verifyTicket } from '@/lib/voiceTicket';

// The site signs, the voice relay verifies (D-100): both copies must agree on this vector (services/voice/test/relay.test.ts).
describe('voice ticket', () => {
  it('matches the relay’s copy', async () => {
    const relay = await import('../../../services/voice/src/ticket');
    expect(signTicket(ticketKey('vector-key'), 1800000000, 'nonce-0001')).toBe(relay.signTicket(relay.ticketKey('vector-key'), 1800000000, 'nonce-0001'));
    const t = signTicket(ticketKey('k'), 1800000060, 'abcdefgh1234');
    expect(relay.verifyTicket(relay.ticketKey('k'), t, 1800000000)).toBe(true);
    expect(verifyTicket(ticketKey('k'), t, 1800000000)).toBe(true);
  });
});
