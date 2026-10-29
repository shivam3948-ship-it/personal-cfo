import { getClient } from '@core/llm';
import { runClaude, type AgentReply, type Turn } from './claude';
import { runOffline } from './offline';
import { detectLang } from '@core/agent/lang';
import { addAction } from '@/lib/actions';
import { PICKS } from '@/lib/server/advicePicks';
import { pickNames } from '@/lib/advicePicks';
import { judgeOn, runJudge, type JudgeInput } from './judge';
import { namesFunds } from '@/lib/advice';

import type { Dataset, Lang } from '@core/types';
import type { AdviceMode } from '@/lib/session';
import type { ToolCtx } from './tools';

export type { AgentReply, Turn };

/** Claude when a key is configured, else (or on any failure) the rule-based agent. The reply says which one answered. */
export async function respond(history: Turn[], sid: string, ds: Dataset, langHint: Lang | 'auto' = 'auto', forceOffline = false, adviceMode: AdviceMode = 'guided', extra: Pick<Partial<ToolCtx>, 'sanitize' | 'judge' | 'model'> = {}): Promise<AgentReply & { fallbackReason?: string }> {
  const last = history.filter((t) => t.role === 'user').at(-1)?.content ?? '';
  const lang = detectLang(last, langHint);
  // default is the stricter guided mode; callers pass the session's mode. Picks only reach the tools in advice mode (D-066).
  // The AI check (D-069) on the server, only when the owner switched it on (MUNIM_JUDGE=on): the mode and the picks come from
  // here, never from the caller. Off: the word patterns alone (they always run).
  const judge = !judgeOn() ? undefined : (input: JudgeInput) => runJudge({ ...input, advice: namesFunds(adviceMode), picks: namesFunds(adviceMode) ? pickNames(PICKS) : [] }, getClient());
  const ctx = { ds, sid, lang, adviceMode, addAction, ...(adviceMode === 'private' || adviceMode === 'advised' ? { picks: async () => PICKS } : {}), ...(judge ? { judge } : {}), ...extra };
  if (!forceOffline && getClient()) {
    try { return await runClaude(history, ctx); }
    catch (e) { const r = await runOffline(history, ctx); return { ...r, fallbackReason: (e as Error).message.slice(0, 200) }; }
  }
  return runOffline(history, ctx);
}
