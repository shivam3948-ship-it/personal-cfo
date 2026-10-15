import { getClient } from '../llm';
import { runClaude, type AgentReply, type Turn } from './claude';
import { runOffline } from './offline';
import { detectLang } from './lang';
import { datasetFor } from '../store';
import type { Lang } from '../types';

export type { AgentReply, Turn };

/** Claude when a key is configured, else (or on any failure) the rule-based agent. The reply says which one answered. */
export async function respond(history: Turn[], sid: string, langHint: Lang | 'auto' = 'auto', forceOffline = false): Promise<AgentReply & { fallbackReason?: string }> {
  const last = history.filter((t) => t.role === 'user').at(-1)?.content ?? '';
  const lang = detectLang(last, langHint);
  const ds = await datasetFor(sid);
  const ctx = { ds, sid, lang };
  if (!forceOffline && getClient()) {
    try { return await runClaude(history, ctx); }
    catch (e) { const r = await runOffline(history, ctx); return { ...r, fallbackReason: (e as Error).message.slice(0, 200) }; }
  }
  return runOffline(history, ctx);
}
