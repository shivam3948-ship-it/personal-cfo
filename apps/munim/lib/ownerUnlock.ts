// The owner's browsers (D-089). Server only. A browser is the owner's when MUNIM_OWNER_KEY is set (16+ characters) and the
// browser holds the httpOnly cookie munim_owner with a keyed hash of that key (never the key itself), set by opening
// #owner=<key> once. Only owner browsers have their Ask turns (question, answer, timings, tokens, cost) kept on the server,
// for the owner's log at /owner. Separate from the advice key on purpose: an advice link shown to a friend must never
// start keeping their conversations. Changing the key locks every browser.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const OWNER_COOKIE = 'munim_owner';
const digest = (s: string) => createHash('sha256').update(s).digest();
// the same value as the advice key would let anyone given an advice link read the log: then no browser is the owner's
const keyOf = (env: Record<string, string | undefined>) => { const k = env.MUNIM_OWNER_KEY; return k && k.length >= 16 && k !== env.MUNIM_ADVICE_KEY ? k : null; };

export function ownerKeyValid(candidate: unknown, env: Record<string, string | undefined> = process.env): boolean {
  const key = keyOf(env);
  if (!key || typeof candidate !== 'string' || !candidate) return false;
  return timingSafeEqual(digest(candidate), digest(key));
}

export function ownerToken(env: Record<string, string | undefined> = process.env): string | null {
  const key = keyOf(env);
  return key ? createHmac('sha256', key).update('munim-owner-v1').digest('base64url') : null;
}

export function isOwner(req?: Request, env: Record<string, string | undefined> = process.env): boolean {
  const m = new RegExp(`(?:^|;\\s*)${OWNER_COOKIE}=([^;]+)`).exec(req?.headers.get('cookie') ?? '');
  const want = ownerToken(env);
  if (!m || !want) return false;
  let got: string; try { got = decodeURIComponent(m[1]); } catch { return false; }
  return timingSafeEqual(digest(got), digest(want));
}
