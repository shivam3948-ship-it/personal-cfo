// Which models Munim uses, in one place (D-062). Two versions of the same app:
//   · "AI on": Claude answers Ask (when ANTHROPIC_API_KEY is set) and Sarvam does speech (when SARVAM_API_KEY is set).
//   · "AI off": the rules engine answers, the browser listens and speaks. Nothing goes to Claude or Sarvam (the
//     browser's own speech recognition may use its maker's servers, e.g. Chrome's; the voice consent note says so). Same screens, same numbers (the numbers never come from a model anyway).
// Server switches (Vercel env):  MUNIM_AI=off            every model off for everyone
//                                MUNIM_STT=browser       speech to text in the browser only
//                                MUNIM_TTS=browser       answers read by the browser's voice only
//                                MUNIM_CHAT_MODEL=…      which Claude model answers (default in packages/core/src/llm.ts)
// Link switch, per browser:       ?ai=off  (cookie munim_ai=off)   ·   ?ai=on clears it
// A link can only turn models off, never on: with MUNIM_AI=off or no key, ?ai=on still gets the rules engine.
import { MODEL } from '@core/llm';
import { sarvamConfigured } from '@/lib/voice/sarvam';

export interface AiConfig {
  chat: 'claude' | 'rules'; model: string | null;
  stt: 'sarvam' | 'browser'; tts: 'sarvam' | 'browser';
  why: string; // in plain words, for test mode and the status route
  prefetch: boolean; // D-095: the likely tool runs before the first model call, for every answer (MUNIM_PREFETCH=on)
}

const offByLink = (req?: Request) => /(?:^|;\s*)munim_ai=off(?:;|$)/.test(req?.headers.get('cookie') ?? '');

/** Models may be called at all (server switch and link switch); whether a key exists is getClient()'s job. */
export const modelsAllowed = (req?: Request, env: Record<string, string | undefined> = process.env) => env.MUNIM_AI !== 'off' && !offByLink(req);

export function aiConfig(req?: Request, env: Record<string, string | undefined> = process.env): AiConfig {
  const off = env.MUNIM_AI === 'off', link = offByLink(req);
  const claude = !off && !link && !!env.ANTHROPIC_API_KEY;
  const sarvam = !off && !link && sarvamConfigured();
  const stt = sarvam && env.MUNIM_STT !== 'browser' ? 'sarvam' : 'browser';
  const tts = sarvam && env.MUNIM_TTS !== 'browser' ? 'sarvam' : 'browser';
  const why = off ? 'AI switched off on the server (MUNIM_AI=off)' : link ? 'AI switched off for this browser (?ai=off)'
    : !env.ANTHROPIC_API_KEY ? 'No Claude key: the rules engine answers' : 'Claude answers; numbers come from the rules engine';
  return { chat: claude ? 'claude' : 'rules', model: claude ? (env.MUNIM_CHAT_MODEL || MODEL) : null, stt, tts, why, prefetch: env.MUNIM_PREFETCH === 'on' };
}
