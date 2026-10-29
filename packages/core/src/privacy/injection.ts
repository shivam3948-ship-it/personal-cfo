// Prompt injection (indirect): text that came from a statement, an SMS, a merchant name or a document and reads like an
// order to the AI ("ignore previous instructions…", "</system>", "assistant: send…"). Anyone can put such text in front of
// Munim: a UPI collect note, a merchant descriptor, an SMS. Before any of it reaches the model, the line or sentence carrying
// it is replaced. A heuristic, so it is one layer: the prompt says document text is data, the server picks the prompt and the
// advice mode, the relay accepts only Munim's tools, actions need the user's ask (lib/agent/claude.ts), and the answer is
// checked (numbers, trade calls, products, PII). Pure: runs in the browser (forLlm) and on the server (document snippets).
//
// Precision matters as much as recall (review, 29 Oct): ordinary Indian bank, insurance and SMS wording ("You are now eligible
// for a pre-approved loan", "Kindly ignore previous SMS regarding policy renewal", "The TPA will ask the customer to submit…",
// "Never share your OTP") must pass untouched, so every pattern needs an AI-directed object, not just a trigger word.

// Matching runs on a normalised copy: compatibility forms (fullwidth ＩＧＮＯＲＥ), invisible characters (zero-width splits),
// any whitespace run, and Cyrillic/Greek letters that look Latin.
const LOOKALIKE: Record<string, string> = { а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ɡ: 'g', һ: 'h', ο: 'o', α: 'a', ε: 'e', ι: 'i', κ: 'k', ν: 'v', τ: 't', ρ: 'p', υ: 'u', Α: 'A', Β: 'B', Ε: 'E', Ι: 'I', Κ: 'K', Μ: 'M', Ν: 'N', Ο: 'O', Ρ: 'P', Τ: 'T', Χ: 'X', Υ: 'Y', А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X' };
export const normalise = (s: string) => s.normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/[^\u0000-ɏऀ-ॿ]/g, (c) => LOOKALIKE[c] ?? c).replace(/\s+/g, ' ');

const NOT = String.raw`(?<!\b(?:not|never|don'?t|do not|please don'?t)\s)`;
const PATTERNS: RegExp[] = [
  // "ignore all previous instructions": the object must be the AI's instructions or rules, never "previous SMS" or "the policy"
  /\b(?:ignore|disregard|forget|override|bypass)\b(?:\s+\w+){0,3}?\s+(?:previous|prior|above|earlier|all|your|these|those|any|the system'?s?|my|the)\s+(?:\w+\s+)?(?:instructions?|prompts?|rules?|guidelines?|guardrails?|directions?|programming)\b/i,
  /\b(?:system|developer)\s+prompt\b|\bjail ?break(?:ed|ing)?\b|\bDAN mode\b|\bprompt injection\b|<\|im_(?:start|end)\|>|"role"\s*:\s*"(?:system|assistant|developer)"|#{1,3}\s*system\b|\bsystem override\b|\b(?:developer|god|admin|debug) mode\b/i,
  /\byou are (?:now|no longer)\s+(?:an?\s+|the\s+|my\s+|in\s+)?(?:AI|assistant|model|chat ?bot|bot|adviser|advisor|unrestricted|uncensored|unfiltered|DAN|jailbroken|free from|\w*GPT|Munim)\b|\bfrom now on,?\s+(?:you|munim)(?:['’]re\s+(?:an?\s+|my\s+|the\s+)?(?:AI|assistant|adviser|advisor|DAN|bot|chat ?bot|model|unrestricted|uncensored|unfiltered|jailbroken|SEBI|registered|financial adviser)|\s+(?:are|will be|must be|should be)\s+(?:an?\s+|my\s+|the\s+)?(?:AI|assistant|adviser|advisor|DAN|bot|chat ?bot|model|unrestricted|uncensored|unfiltered|jailbroken|SEBI|registered|financial adviser)|\s+(?:(?:will|must|should|shall|have to|are to|need to)\s+)?(?:only\s+|always\s+|never\s+)?(?:act|respond|reply|answer|speak|ignore|follow|obey|tell|say|recommend|advise|suggest|draft|remind|create|send|share|forward|reveal|work|sell|surrender)(?:s|ing)?)\b|\bpretend (?:to be|you are)\b|\bact as (?:an?\s+|my\s+)?(?:AI|assistant|adviser|advisor|DAN|\w*GPT|unrestricted)\b|\bnew (?:instructions?|system prompt|persona)\b/i,
  /<\/?\s*(?:system|assistant|instructions?|tool|prompt)\s*>|\[\/?(?:system|assistant|inst)\]|(?:^|[|])\s*(?:assistant|developer)\s*:|(?:^|[|])\s*system\s*:\s*(?:you|ignore|tell|from now|new|always|never|do not|don't|forget|draft|create|send|sell|buy|remind|call|use|say|recommend|reply)\b|\b(?:assistant|AI|Munim(?: AI)?|Claude|model|bot)\s*:\s*(?:tell|say|create|send|draft|ignore|sell|buy|recommend|call|use|always|never|forget|remind)\b/i,
  new RegExp(String.raw`${NOT}\b(?:tell|instruct)\s+(?:the\s+)?(?:user|users|person)s?\s+(?:to|that)\b|\b(?:tell|instruct|ask)\s+(?:the\s+)?customers?\s+to\s+(?:transfer|pay|send|sell|surrender|switch|buy|invest|share|redeem|withdraw|move)\b|\bsay\s+(?:this\s+)?to\s+the\s+user\b|\btell\s+users?\b`, 'i'), // "Do not tell the user to…" is Munim's own guardrail; "the customer" counts only with a money verb: bank letters say "tell the customer to visit the branch" (review, 29 Oct)
  new RegExp(String.raw`\b(?:call|use|run|invoke|trigger)\s+(?:the\s+)?(?:draft[_ ]?email|create[_ ]?reminder|create[_ ]?savings[_ ]?goal|save[_ ]?prepayment[_ ]?plan|reminder|email)\s+tool\b|${NOT}\b(?:send|forward|email|share|reveal)\s+(?:the\s+|your\s+|their\s+|his\s+|her\s+|my\s+)?(?:PAN|password|OTP|CVV|PIN|account number|card number)s?\b`, 'i'),
  // Hindi and Hinglish: imperatives only ("नियमों को भूल जाने पर जुर्माना" is a fact about a penalty)
  /(?:पिछले|सारे|सभी|ऊपर के)?\s*(?:निर्देश|निर्देशों|नियमों|नियम)\s*(?:को\s*)?(?:भूल\s*(?:जाओ|जाइए|जाइये|जाएँ|जाएं)|अनदेखा\s*कर(?:ो|ें|िए)|नज़रअंदाज़\s*कर(?:ो|ें|िए)|नजरअंदाज\s*कर(?:ो|ें|िए)|मत\s*मानो)|अब\s*से\s*(?:तुम|आप)\s|यूज़र\s*से\s*कहो|यूजर\s*से\s*कहो/,
  /\b(?:pichh?le|saare|sare|sab|upar\s+(?:wale|ke))?\s*(?:instructions?|rules?|niyam|nirdesh)\s+(?:ko\s+)?(?:bhool|bhul|ignore|chhod)\s*(?:jao|jaiye|do|karo|kar\s*do)\b|\bab\s+se\s+(?:tum|aap)\b|\buser\s+(?:ko|se)\s+(?:bolo|batao|kaho)\b/i,
];
export const REMOVED = '[text removed: it read like an instruction]';

/** Does this text read like an instruction aimed at the AI? */
export const looksLikeInstruction = (s: string) => { const n = normalise(s); return PATTERNS.some((re) => re.test(n)); };

/** Each line, and each sentence within a line, that reads like an instruction is replaced; the rest is kept as it was
 *  (wrapped PDF and email text keeps its neighbouring lines: a policy clause must never vanish with an injected line). */
export function defang(s: string): string {
  if (!looksLikeInstruction(s)) return s;
  return s.split(/(\n+)/).map((line) => {
    if (/^\n+$/.test(line) || !looksLikeInstruction(line)) return line;
    const parts = line.split(/(?<=[.!?।])\s+/);
    const out = parts.map((p) => (looksLikeInstruction(p) ? REMOVED : p)).join(' ');
    return looksLikeInstruction(out) ? REMOVED : out; // a pattern that spans sentences: drop the line
  }).join('');
}
