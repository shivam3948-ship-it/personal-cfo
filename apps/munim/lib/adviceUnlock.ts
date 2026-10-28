// Advice mode behind a config (D-066). Server only. Advice is on for a browser when ALL of these hold:
//   · MUNIM_ADVICE=on on the server (off by default: one switch turns it off for everyone),
//   · MUNIM_ADVICE_KEY is set (16+ characters), and
//   · the browser holds the httpOnly cookie munim_advice with that exact key, set by opening ?advice=<key> once.
// Anyone else, including anyone who guesses the switch exists, gets the usual education-only modes.
import { createHash, timingSafeEqual } from 'node:crypto';

export const ADVICE_COOKIE = 'munim_advice';
const digest = (s: string) => createHash('sha256').update(s).digest();

export function adviceKeyValid(candidate: unknown, env: Record<string, string | undefined> = process.env): boolean {
  const key = env.MUNIM_ADVICE_KEY;
  if (env.MUNIM_ADVICE !== 'on' || !key || key.length < 16 || typeof candidate !== 'string' || !candidate) return false;
  return timingSafeEqual(digest(candidate), digest(key)); // same-length digests, so no early exit on the first wrong character
}

export function adviceUnlocked(req?: Request, env: Record<string, string | undefined> = process.env): boolean {
  const m = new RegExp(`(?:^|;\\s*)${ADVICE_COOKIE}=([^;]+)`).exec(req?.headers.get('cookie') ?? '');
  return !!m && adviceKeyValid(decodeURIComponent(m[1]), env);
}
