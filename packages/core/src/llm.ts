import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const EXTRACT_MODEL = process.env.ANTHROPIC_EXTRACT_MODEL || MODEL;

/** Minimal surface we use, so tests can inject a fake. */
export interface LlmClient {
  messages: { create: (body: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> };
}

let cached: LlmClient | null = null;
export function getClient(): LlmClient | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cached) cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 }) as unknown as LlmClient;
  return cached;
}
export const setClientForTests = (c: LlmClient | null) => { cached = c; };
