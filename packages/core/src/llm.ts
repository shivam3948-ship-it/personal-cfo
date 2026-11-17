import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.MUNIM_CHAT_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
// A faster model for voice turns only (latency sprint, D-075): unset means voice uses MODEL. Server-side setting.
export const VOICE_MODEL = process.env.MUNIM_VOICE_MODEL || '';
export const EXTRACT_MODEL = process.env.ANTHROPIC_EXTRACT_MODEL || MODEL;

/** Minimal surface we use, so tests can inject a fake. */
export interface LlmClient {
  messages: {
    create: (body: Anthropic.MessageCreateParamsNonStreaming, options?: { signal?: AbortSignal }) => Promise<Anthropic.Message>;
    /** Streams the reply's text as it is written (voice, D-100); the phone's relay client implements it over its own route. */
    streamText?: (body: Anthropic.MessageCreateParamsNonStreaming, onText: (delta: string) => void) => Promise<Anthropic.Message>;
  };
}

/** One model call, streaming its text to `onText` where the client can (the Anthropic SDK, or a client with streamText);
 *  otherwise an ordinary call. Resolves to the same complete message either way. */
export async function createStreaming(client: LlmClient, body: Anthropic.MessageCreateParamsNonStreaming, onText: (delta: string) => void): Promise<Anthropic.Message> {
  if (client.messages.streamText) return client.messages.streamText(body, onText);
  const sdk = client.messages as unknown as { stream?: (b: unknown) => { on: (e: 'text', f: (d: string) => void) => unknown; finalMessage: () => Promise<Anthropic.Message> } };
  if (typeof sdk.stream === 'function') { const st = sdk.stream(body); st.on('text', onText); return st.finalMessage(); }
  return client.messages.create(body);
}

let cached: LlmClient | null = null;
export function getClient(): LlmClient | null {
  if (!process.env.ANTHROPIC_API_KEY || process.env.MUNIM_AI === 'off') return null; // MUNIM_AI=off: no model calls anywhere (D-062)
  if (!cached) cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 }) as unknown as LlmClient;
  return cached;
}
export const setClientForTests = (c: LlmClient | null) => { cached = c; };
