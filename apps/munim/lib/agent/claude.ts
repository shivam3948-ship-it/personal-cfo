import type Anthropic from '@anthropic-ai/sdk';
import { MODEL, getClient, type LlmClient } from '@core/llm';
import { systemPrompt } from './prompt';
import { DISCLAIMER, NO_PICK, NO_PRODUCT, NO_TRADE, namesFunds, type AdviceMode } from '@/lib/advice';
import { TOOLS, runTool, type ToolCtx } from './tools';
import { checkNumbers, type NumberCheck } from '@core/agent/guard';
import type { Action } from '@/lib/actionsCore';
import { asOfDate } from '@core/finance/picture';
import { holderNames, redact } from '@core/privacy/redact';
import { enforceNoTrade, fundLabels, heldNames, namedFunds, scrubFunds } from './funds';
import { exitIndices, sentences, tellsToExit } from './tradeWords';
import { knownProducts, strangerProducts, type Known } from './brands';
import { NO_PICKS, pickNames } from '@/lib/advicePicks';
import { TOUCHES_INVESTMENTS, judgeSentences, type JudgeInput, type Verdict } from './judge';
export { enforceNoTrade, fundLabels, namedFunds, scrubFunds };

const ACTION_TOOLS = new Set(['create_reminder', 'draft_email', 'create_savings_goal', 'save_prepayment_plan']);
/** The user's own message asks for an action outright (English, Hindi, Hinglish). */
export const ASKS_ACTION = /\bremind|reminder|yaad\s*dila|याद\s*दिला|\bdraft|(?:e-?mail|mail)\s+(?:likh|bana|draft|bhej)|likh\s*(?:do|dijiye)|लिख\s*(?:दो|दीजिए)|\bset\s+(?:up\s+)?(?:a\s+)?(?:goal|reminder)|goal\s+bana|लक्ष्य\s+बना|save\s+(?:the\s+|a\s+|this\s+)?plan|plan\s+save|prepayment\s+plan|calendar|कैलेंडर/i;
/** A yes to an offer (review 7: the primary user says "thik hai", "ज़रूर", "अच्छा", "chalega"). */
export const AGREES = /\b(?:yes|yeah|yep|yup|ya|haa?n?|ha|ji|ok(?:ay|k)?|sure|of course|absolutely|definitely|please(?: do)?|do (?:it|that)|go ahead|go for it|sounds good|done|fine|theek|thik|thee?k hai|zaroor|jaroor|acha|accha|achha|sahi|chalega|bilkul|kar(?:\s*(?:do|lo|dijiye|dein))|kardo|ho\s*jaye|ho\s*jaaye|chalo|bana\s*do|bana\s*dijiye|bhej\s*do)\b|हाँ|हां|हा(?![\u0900-\u097F])|जी|ठीक|ज़रूर|जरूर|अच्छा|सही|चलेगा|बिल्कुल|कर\s*(?:दो|दीजिए|लो)|हो\s*जाए|चलो|👍|✅/i;
// a refusal OPENS the reply or is all of it ("no", "nahi", "baad mein"); "Yes, cancel it", "haan kyun nahi", "no problem, go
// ahead" are yeses (final review, 29 Oct)
export const REFUSES = /^\s*(?:no|nope|nah|nahi|nahin|not now|not yet|later|baad\s*mein|rehne\s*do|mat|नहीं|मत|रहने\s*दो|बाद\s*में)(?![\w\u0900-\u097F])(?!\s*(?:problem|worries|issue|dikkat))/i;
const YES_IDIOM = /kyu?n\s*nahi|क्यों\s*नहीं|no\s*(?:problem|worries)|why\s*not/i;
// an offer in Munim's last answer: a question, or "I can … if you like", "क्या मैं …", "kar doon"
const OFFERED = /\?|\bif you (?:like|want)\b|\b(?:shall|should|can) I\b|\bwant me to\b|\bI can (?:set|draft|save|create|make)\b|क्या मैं|kar doon|bana doon|likh doon/i;
/** Actions run only when the user's own last message asks for one, or says yes to an offer Munim made in its last answer
 *  (an order that slipped in through data can't create one; prompt-injection review, 29 Oct). */
/** The actions the user allows now: any, when their own message asks for one or says yes to an offer in Munim's last answer;
 *  none otherwise. A reply that opens with a no allows nothing, unless it asks for an action itself ("No, remind me on 1 Nov
 *  instead"). Which action is NOT guessed from keywords: that guess failed on Hindi and paraphrased offers (review, 29 Oct). */
// "don't remind me", "याद मत दिलाओ", "mat likho": the negation is tied to the action word, not anywhere in the message
const NEGATED_ACTION = /(?:don[’']?t|do not|never|no need to)\s+(?:\w+\s+)?(?:remind|draft|set|send|e-?mail|mail|save|write|create|make)|(?:याद|ईमेल|रिमाइंडर|लिख|बना)\S*\s+(?:मत|न)(?![\u0900-\u097F])|\b(?:mat|na)\s+(?:likh|bana|bhej|dila|laga|kar)|\b(?:likh|bana|bhej|dila|laga|yaad)\w*\s+mat\b/i;
// a clause that negates the action itself ("don't email them", "mat bhejo", "remind mat karo", "मत भेजो"); "Don't forget to
// remind me" is not one (the verb after don't is forget). Judged per clause, so a redirect still runs (review, 29 Oct follow-up)
const NEG_CLAUSE = /^\s*(?:please\s+|pls\s+|yes\s+|ok\s+)?(?:(?:don[’']?t|do not|never|no need to)\s+(?:\w+\s+)?(?:remind|draft|send|e-?mail|mail|save|write|create|set)\b|(?:mat|na)\s+(?:likh|bana|bhej|dila|laga|kar)|मत\s+(?:लिख|बना|भेज|दिला|लगा|कर))|\b(?:remind|reminder|e-?mail|mail|likh|bana|bhej|dila|laga|yaad)\w*\s+mat\b/i;
const CLAUSE_BREAK = /[,;]|\s+(?:but|par|lekin|just|instead|rather)\s+|\s+(?:पर|लेकिन|बल्कि)\s+/i;
const ACT_START = /^\s*(?:just\s+|instead\s+|rather\s+)?(?:remind|set|draft|send|save|create|write|e-?mail)\b|yaad\s*dila|याद\s*दिला|(?:laga|bana|likh|bhej)\s*do|(?:लगा|बना|लिख|भेज)\s*दो/i;
const negClause = (c: string) => NEG_CLAUSE.test(c) || NEGATED_ACTION.test(c);
export function allowedActions(last: string, prevAssistant: string): string[] {
  const asks = ASKS_ACTION.test(last);
  // a negated action anywhere: allowed only if another clause asks for one ("Don't email them, just remind me")
  const clauses = last.split(CLAUSE_BREAK);
  if (clauses.some(negClause)) return clauses.some((c) => !negClause(c) && (ASKS_ACTION.test(c) || ACT_START.test(c))) ? [...ACTION_TOOLS] : [];
  // a reply that opens with a no: allowed only if it asks for an action and doesn't negate the action itself
  if (REFUSES.test(last) && !YES_IDIOM.test(last)) return asks && !NEGATED_ACTION.test(last) ? [...ACTION_TOOLS] : [];
  if (asks) return [...ACTION_TOOLS]; // a direct request runs, whatever else it says ("…so I don't miss the bill", "बिल वाले दिन याद दिला दो")
  return OFFERED.test(prevAssistant) && (AGREES.test(last) || YES_IDIOM.test(last)) ? [...ACTION_TOOLS] : [];
}
export const userAllowsAction = (last: string, prevAssistant: string) => allowedActions(last, prevAssistant).length > 0;
export interface Turn { role: 'user' | 'assistant'; content: string }
export interface TraceStep { tool: string; input: Record<string, unknown>; result: Record<string, unknown>; ms: number }
export interface AgentReply { answer: string; lang: 'hi' | 'en'; trace: TraceStep[]; actions: Action[]; check: NumberCheck; engine: 'claude' | 'offline'; model?: string; ms: number; repaired?: boolean;
  /** Which advice check ran on the answer (D-069): the AI check, the word patterns (its fallback), or none (no investment talk). */
  guard?: 'ai' | 'rules' | 'rules_fallback' | 'none'; guardMs?: number;
  /** The advice check found something (and forced a rewrite or removed it). On an ordinary question this is a false alarm. */
  adviceFired?: boolean }

export async function runClaude(history: Turn[], ctx: ToolCtx, client: LlmClient | null = getClient()): Promise<AgentReply> {
  if (!client) throw new Error('No ANTHROPIC_API_KEY');
  const t0 = Date.now();
  const system = systemPrompt({ asOf: asOfDate(ctx.ds), lang: ctx.lang, dataLabel: ctx.ds.label, sources: ctx.ds.log.filter((l) => l.file !== '(all documents)').map((l) => `${l.file} (${l.kind})`), testMode: ctx.adviceMode === 'demo' || ctx.adviceMode === 'internal', disclaimer: DISCLAIMER[ctx.adviceMode][ctx.lang], adviceMode: ctx.adviceMode });
  // The user's own words can carry PII too ("my PAN is…"): scrub them like document text before they reach the model.
  const names = [...holderNames(ctx.ds.docs.map((d) => d.text)), ...(ctx.names ?? [])];
  const messages: Anthropic.MessageParam[] = history.slice(-12).map((t) => ({ role: t.role, content: t.role === 'user' ? redact(t.content, { names }) : t.content }));
  const trace: TraceStep[] = []; const actions: Action[] = []; const results: unknown[] = [];
  const lastUser = history.filter((t) => t.role === 'user').at(-1)?.content ?? '';
  const prevAssistant = history.slice(0, -1).filter((t) => t.role === 'assistant').at(-1)?.content ?? '';
  let emptyRetried = false;
  let repaired = false, fundsRepaired = false; let known: Known | undefined; let guard: AgentReply['guard'] = 'none', guardMs = 0;
  const funds = namesFunds(ctx.adviceMode) ? [] : fundLabels(ctx.ds.portfolio?.holdings ?? [], ctx.lang);
  for (let step = 0; step < 7; step++) {
    const res = await client.messages.create({ model: MODEL, max_tokens: 700, system, tools: TOOLS, messages });
    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !uses.length) {
      const answer = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join(' ').trim();
      // An empty reply (cut off at the token limit, or the model ended after its tools): ask once for the answer, then let the
      // rules engine answer rather than show nothing (live eval 28 Oct, sa-elss).
      if (!answer) {
        if (emptyRetried) throw new Error('empty answer');
        emptyRetried = true;
        messages.push({ role: 'assistant', content: [{ type: 'text', text: '…' }] }); // a cut-off tool call can't be replayed: keep the turn order only
        messages.push({ role: 'user', content: '[system check] Your reply had no answer. Answer the user\'s last question now in 2 to 4 short sentences, using the tool results you already have.' });
        continue;
      }
      const check = checkNumbers(answer, results);
      // One repair round: if a spoken figure is not in any tool result, ask the model to fix it before anyone hears it.
      if (!check.ok && !repaired) {
        repaired = true;
        messages.push({ role: 'assistant', content: res.content });
        messages.push({ role: 'user', content: `[system check] These figures are not in any tool result: ${check.unverified.join(', ')}. Call a tool if you need the number, or rewrite the answer without it. Reply with the corrected spoken answer only.` });
        continue;
      }
      // The advice check (D-051, D-066, D-069), then one repair round, then the hard guard, so none of these is ever shown or
      // spoken: outside advice mode, a call to sell, switch, exit, stop or top up a holding; in any mode, a fund or insurer the
      // user doesn't hold (advice mode: that the owner hasn't picked). The AI check decides when it can run; the word patterns
      // decide when it can't (no key, AI off, a timeout).
      if (!known) known = knownProducts(ctx.ds.portfolio?.holdings ?? [], ctx.ds.policies ?? [], namesFunds(ctx.adviceMode) && ctx.picks ? pickNames(await ctx.picks().catch(() => NO_PICKS)) : [], history.filter((t) => t.role === 'user').map((t) => t.content));
      const said = known.said; // product names the user mentioned, not their raw words (review 6: their words can carry orders to the check)
      const g = await checkAdvice(answer, ctx, funds, known, said);
      guard = g.by === 'none' ? 'rules' : g.by; guardMs += g.ms; // the word patterns always run, so 'none' only means nothing touched investments
      if (g.flagged.length && !fundsRepaired) {
        fundsRepaired = true;
        messages.push({ role: 'assistant', content: res.content });
        const why = g.flagged.map((f) => `"${f.s}" (${f.why === 'trade' ? `tells the user to act on something they hold: Munim has no investment adviser licence, so give the facts and trade-offs only${f.name ? `, or call it "${funds[0]?.label ?? 'your small cap fund'}"` : ''}` : namesFunds(ctx.adviceMode) ? 'names a product that is not in advice_picks: name only products from advice_picks, or give the category and say no pick is set up yet' : 'names a product the user does not hold as a choice: name the category instead'})`).join('; ');
        messages.push({ role: 'user', content: `[system check] These sentences break Munim's advice rules: ${why}. Rewrite them. Reply with the corrected spoken answer only.` });
        continue;
      }
      const final = g.flagged.length ? removeFlagged(answer, g.flagged, ctx.adviceMode, ctx.lang, funds) : answer;
      return { answer: final, lang: ctx.lang, trace, actions, check: final === answer ? check : checkNumbers(final, results), engine: 'claude', model: MODEL, ms: Date.now() - t0, repaired: repaired || fundsRepaired, guard, guardMs, adviceFired: fundsRepaired || g.flagged.length > 0 };
    }
    messages.push({ role: 'assistant', content: res.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const s = Date.now();
      let out: Awaited<ReturnType<typeof runTool>>;
      // Actions (a reminder, an email draft, a goal, a prepayment plan) only when the user's own last message asks for one or
      // says yes to an offer: an order that slipped in through data can't create one (prompt-injection review, 29 Oct).
      if (ACTION_TOOLS.has(u.name) && !allowedActions(lastUser, prevAssistant).includes(u.name)) out = { result: { error: 'Actions run only when the user asks for one or says yes to your offer. Offer it in one sentence instead.' } };
      else try { out = await runTool(u.name, (u.input ?? {}) as Record<string, unknown>, ctx); }
      catch (e) { out = { result: { error: (e as Error).message } }; }
      trace.push({ tool: u.name, input: (u.input ?? {}) as Record<string, unknown>, result: out.result, ms: Date.now() - s });
      const shown = ctx.sanitize ? ctx.sanitize(out.result) : out.result; // what the AI sees is what the number check trusts
      results.push(shown); if (out.action && !(out.action as { duplicate?: boolean }).duplicate) actions.push(out.action);
      toolResults.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(shown), is_error: 'error' in shown });
    }
    messages.push({ role: 'user', content: toolResults });
  }
  const answer = ctx.lang === 'hi' ? 'माफ़ कीजिए, मैं इसका जवाब पूरा नहीं कर पाया। क्या आप सवाल थोड़ा छोटा करके पूछेंगे?' : "Sorry, I couldn't finish that one. Could you ask it a bit more simply?";
  return { answer, lang: ctx.lang, trace, actions, check: checkNumbers(answer, results), engine: 'claude', model: MODEL, ms: Date.now() - t0, guard, guardMs };
}

/** What the guard objects to in an answer (D-051, D-066). */
export function violations(answer: string, mode: AdviceMode, funds: ReturnType<typeof fundLabels>, known: Known) {
  const guarded = !namesFunds(mode);
  return { named: guarded ? namedFunds(answer, funds) : [], exits: guarded && tellsToExit(answer, heldNames(funds)), strangers: strangerProducts(answer, known) };
}
/** The hard guard, after the repair round: also used on the phone when the relay answered in a stricter mode than the
 *  phone asked for (D-066 review, #5). Outside advice mode, trade sentences lose their fund names and exit instructions are
 *  removed; in every mode, a sentence naming a product the user doesn't hold (and, in advice mode, that isn't a pick) goes. */
export function guardAnswer(answer: string, mode: AdviceMode, funds: ReturnType<typeof fundLabels>, known: Known, lang: 'hi' | 'en') {
  const v = violations(answer, mode, funds, known);
  let a = answer;
  if (v.strangers.length) {
    for (const st of sentences(a).filter((x) => strangerProducts(x, known).length)) a = a.replace(st, '');
    a = a.replace(/[ \t]{2,}/g, ' ').trim();
    const line = namesFunds(mode) ? NO_PICK[lang] : NO_PRODUCT[lang];
    a = a ? `${a} ${line}` : line;
  }
  if (!namesFunds(mode) && (v.named.length || v.exits)) a = enforceNoTrade(a, funds, lang);
  return a;
}

type Flag = { i: number; s: string; why: 'trade' | 'product'; name?: boolean };
/** Which sentences break the advice rules (D-051, D-066, D-069). The word patterns and the product check ALWAYS run; the AI
 *  check, when it is on and can run, may only ADD sentences (review 6: a missed sell call without a licence is a regulatory
 *  event, a false alarm is a stiffer sentence, and the AI check hasn't been measured yet). Positions, not text, so a
 *  repeated sentence loses the right copy. */
export async function checkAdvice(answer: string, ctx: Pick<ToolCtx, 'adviceMode' | 'lang' | 'judge'>, funds: ReturnType<typeof fundLabels>, known: Known, said: string[]): Promise<{ flagged: Flag[]; by: 'ai' | 'rules' | 'rules_fallback' | 'none'; ms: number }> {
  const t0 = Date.now();
  const list = judgeSentences(answer);
  const held = heldNames(funds), guarded = !namesFunds(ctx.adviceMode);
  const flagged: Flag[] = [];
  if (guarded) for (const i of exitIndices(answer, held)) flagged.push({ i, s: list[i], why: 'trade', name: namedFunds(list[i], funds).length > 0 });
  list.forEach((s, i) => { if (!flagged.some((f) => f.i === i) && strangerProducts(s, known).length) flagged.push({ i, s, why: 'product' }); });
  const heldMentioned = held.some((n) => answer.toLowerCase().includes(n.toLowerCase()));
  if (!ctx.judge || !(TOUCHES_INVESTMENTS.test(answer) || flagged.length || heldMentioned)) return { flagged, by: flagged.length ? 'rules' : 'none', ms: Date.now() - t0 };
  const input: JudgeInput = { sentences: list, held: [...new Set([...known.names, ...held])].slice(0, 40), picks: [], said: said.slice(0, 5), lang: ctx.lang, advice: namesFunds(ctx.adviceMode) };
  const v: Verdict | null = await ctx.judge(input).catch(() => null);
  if (!v) return { flagged, by: 'rules_fallback', ms: Date.now() - t0 }; // the AI check was asked and couldn't answer: measurable once it is on
  for (const r of v.remove) if (!flagged.some((f) => f.i === r.i)) flagged.push({ i: r.i, s: list[r.i], why: r.why });
  return { flagged, by: 'ai', ms: Date.now() - t0 };
}
/** Remove the flagged sentences (by position) and say once why something is missing (no-licence line, or no pick set up). */
export function removeFlagged(answer: string, flagged: Flag[], mode: AdviceMode, lang: 'hi' | 'en', funds: ReturnType<typeof fundLabels>) {
  // cut each flagged sentence out of the ORIGINAL text by its position, so line breaks and lists elsewhere stay (review 7)
  const drop = new Set(flagged.map((f) => f.i));
  let out = '', at = 0;
  judgeSentences(answer).forEach((sent, i) => {
    const k = answer.indexOf(sent, at); if (k < 0) return;
    out += answer.slice(at, k); if (!drop.has(i)) out += sent; at = k + sent.length;
  });
  out += answer.slice(at);
  const a = scrubFunds(out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/^\s*\d+\.\s*$/gm, '').trim(), namesFunds(mode) ? [] : funds);
  const lines = [...new Set(flagged.map((f) => (f.why === 'trade' ? NO_TRADE[lang] : namesFunds(mode) ? NO_PICK[lang] : NO_PRODUCT[lang])))];
  return [a, ...lines].filter(Boolean).join(' ');
}
