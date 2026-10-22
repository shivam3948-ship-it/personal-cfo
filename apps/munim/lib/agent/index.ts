import { getClient } from '@core/llm';
import { runClaude, type AgentReply, type Turn } from './claude';
import { runOffline } from './offline';
import { detectLang } from '@core/agent/lang';

import type { Dataset, Lang } from '@core/types';
import type { AdviceMode } from '@/lib/session';

export type { AgentReply, Turn };

/** Claude when a key is configured, else (or on any failure) the rule-based agent. The reply says which one answered. */
export async function respond(history: Turn[], sid: string, ds: Dataset, langHint: Lang | 'auto' = 'auto', forceOffline = false, adviceMode: AdviceMode = 'guided'): Promise<AgentReply & { fallbackReason?: string }> {
  const last = history.filter((t) => t.role === 'user').at(-1)?.content ?? '';
  const lang = detectLang(last, langHint);
  const ctx = { ds, sid, lang, adviceMode }; // default is the stricter guided mode; callers pass the session's mode
  if (!forceOffline && getClient()) {
    try { return await runClaude(history, ctx); }
    catch (e) { const r = await runOffline(history, ctx); return { ...r, fallbackReason: (e as Error).message.slice(0, 200) }; }
  }
  return runOffline(history, ctx);
}
