// A short-lived ticket so only Munim's own pages can open a voice session (D-100). Signed with a key derived from the Sarvam
// key both sides already hold, so no new secret has to be set anywhere. Same code as apps/munim/lib/voiceTicket.ts; the
// shared test vector in both test suites keeps them in step. (Copy of services/voice/src/ticket.ts.)
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ticketKey = (sarvamKey: string) => createHmac('sha256', sarvamKey).update('munim-voice-ticket-v1').digest();

/** `exp.nonce.sig`: exp in unix seconds; sig = base64url HMAC of "exp.nonce". */
export function signTicket(key: Buffer, exp: number, nonce: string): string {
  const body = `${exp}.${nonce}`;
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}

export function verifyTicket(key: Buffer, ticket: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const m = /^(\d{10})\.([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{43})$/.exec(ticket ?? '');
  if (!m) return false;
  const exp = Number(m[1]);
  if (exp < nowSec || exp > nowSec + 90) return false; // expired, or valid for longer than the site issues (60 s)
  const want = createHmac('sha256', key).update(`${m[1]}.${m[2]}`).digest();
  const got = Buffer.from(m[3], 'base64url');
  return got.length === want.length && timingSafeEqual(got, want);
}
