// Prompt injection (indirect): text that came from a statement, an SMS, a merchant name or a document and reads like an
// order to the AI ("ignore previous instructions…", "</system>", "assistant: send…"). Anyone can put such text in front of
// Munim: a UPI collect note, a merchant descriptor, an SMS. Before any of it reaches the model, the sentence carrying it is
// replaced. A heuristic, so it is one layer: the prompt says document text is data, the server picks the prompt and the
// advice mode, the relay accepts only Munim's tools, and the answer is checked (numbers, trade calls, products, PII).
// Pure: runs in the browser (forLlm) and on the server (document snippets).
const PATTERNS: RegExp[] = [
  /\b(?:ignore|disregard|forget|override|bypass)\b[^.!?\n]{0,40}\b(?:instructions?|rules?|prompts?|guidelines?|guardrails?|polic(?:y|ies)|system)\b/i,
  /\b(?:system|developer)\s+(?:prompt|message|instructions?|mode)\b|\bjail ?break\b|\bDAN mode\b|\bprompt injection\b/i,
  /\byou are (?:now|no longer)\b|\bfrom now on,? you\b|\bpretend (?:to be|you are)\b|\bact as (?:a|an|my|the)\b|\bnew (?:instructions?|rules?|role)\b/i,
  /<\/?\s*(?:system|assistant|user|instructions?|tool|prompt)\s*>|\[\/?(?:system|assistant|inst|user)\]|(?:^|[\n|])\s*(?:system|assistant|developer)\s*:/i,
  /(?<!\b(?:not|never|don[’']?t|do not)\s)\b(?:tell|ask|instruct|advise|urge) (?:the user|the customer|them|him|her) to\b/i, // "Do not tell the user to…" is Munim's own guardrail
  /\b(?:call|use|run|invoke) (?:the )?[a-z]+_[a-z_]+ tool\b|\b(?:send|forward|email) (?:the |their |his |her )?(?:PAN|password|OTP|account number|card number|statement)s?\b/i,
  // Hindi and Hinglish
  /(?:पिछले|सारे|सभी|ऊपर के)\s*(?:निर्देश|नियम|निर्देशों|नियमों)[^।\n]{0,30}(?:भूल|अनदेखा|नज़रअंदाज़|नजरअंदाज|मत मानो)|(?:निर्देशों|नियमों)\s*को\s*(?:भूल|अनदेखा|नज़रअंदाज़)/,
  /\b(?:sab|saare|sare|pichle|upar ke)\s+(?:instructions?|rules?|niyam)\s+(?:bhool|bhul|ignore|chhod)/i,
];
export const REMOVED = '[text removed: it read like an instruction]';

/** Does this text read like an instruction aimed at the AI? */
export const looksLikeInstruction = (s: string) => PATTERNS.some((re) => re.test(s));

/** Each sentence that reads like an instruction is replaced, the rest kept (a merchant name usually goes whole). */
export function defang(s: string): string {
  if (!looksLikeInstruction(s)) return s;
  const parts = s.split(/(?<=[.!?।\n])\s+/);
  const out = parts.map((p) => (looksLikeInstruction(p) ? REMOVED : p)).join(' ');
  return looksLikeInstruction(out) ? REMOVED : out; // a pattern that spans sentences: drop it all
}
