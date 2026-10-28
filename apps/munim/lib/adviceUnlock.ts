// Advice mode behind a config (D-066). Server only. Advice is on for a browser when ALL of these hold:
//   · MUNIM_ADVICE=on on the server (off by default: one switch turns it off for everyone),
//   · MUNIM_ADVICE_KEY is set (16+ characters), and
//   · the browser holds the httpOnly cookie munim_advice with a keyed hash of that key (never the key itself), set by
//     opening #advice=<key> once. Changing the key locks every browser.
// Anyone else, including anyone who guesses the switch exists, gets the usual education-only modes.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const ADVICE_COOKIE = 'munim_advice';
const digest = (s: string) => createHash('sha256').update(s).digest();

export function adviceKeyValid(candidate: unknown, env: Record<string, string | undefined> = process.env): boolean {
  const key = env.MUNIM_ADVICE_KEY;
  if (env.MUNIM_ADVICE !== 'on' || !key || key.length < 16 || typeof candidate !== 'string' || !candidate) return false;
  return timingSafeEqual(digest(candidate), digest(key)); // same-length digests, so no early exit on the first wrong character
}

/** What the cookie holds: an HMAC of a fixed label under the key, so a stolen cookie doesn't reveal the key (review nit). */
export function adviceToken(env: Record<string, string | undefined> = process.env): string | null {
  const key = env.MUNIM_ADVICE_KEY;
  if (env.MUNIM_ADVICE !== 'on' || !key || key.length < 16) return null;
  return createHmac('sha256', key).update('munim-advice-v1').digest('base64url');
}

export function adviceUnlocked(req?: Request, env: Record<string, string | undefined> = process.env): boolean {
  const m = new RegExp(`(?:^|;\\s*)${ADVICE_COOKIE}=([^;]+)`).exec(req?.headers.get('cookie') ?? '');
  const want = adviceToken(env);
  if (!m || !want) return false;
  let got: string; try { got = decodeURIComponent(m[1]); } catch { return false; } // a malformed cookie is just "locked"
  return timingSafeEqual(digest(got), digest(want));
}
