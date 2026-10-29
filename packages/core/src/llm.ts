import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.MUNIM_CHAT_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
// A faster model for voice turns only (latency sprint, D-075): unset means voice uses MODEL. Server-side setting.
export const VOICE_MODEL = process.env.MUNIM_VOICE_MODEL || '';
export const EXTRACT_MODEL = process.env.ANTHROPIC_EXTRACT_MODEL || MODEL;

/** Minimal surface we use, so tests can inject a fake. */
export interface LlmClient {
  messages: { create: (body: Anthropic.MessageCreateParamsNonStreaming, options?: { signal?: AbortSignal }) => Promise<Anthropic.Message> };
}

let cached: LlmClient | null = null;
export function getClient(): LlmClient | null {
  if (!process.env.ANTHROPIC_API_KEY || process.env.MUNIM_AI === 'off') return null; // MUNIM_AI=off: no model calls anywhere (D-062)
  if (!cached) cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 }) as unknown as LlmClient;
  return cached;
}
export const setClientForTests = (c: LlmClient | null) => { cached = c; };
