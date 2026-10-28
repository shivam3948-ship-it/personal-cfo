// What may leave the phone for the AI (D-050, option A): tool results only, after this filter. A tool result is already
// computed figures and labels; this removes what could identify a person even so:
//   · keys that point at files or raw rows (source files, evidence, raw narrations, references)
//   · bank descriptors (UPI/NEFT/IMPS strings), which carry payee names and handles → "a UPI payment" / "a bank transfer"
//   · PAN, emails, phone numbers, UPI ids, card and account numbers (redact.ts)
//   · long lists, cut to the first 30 items, so a whole statement can't ride along
//   · any sentence that reads like an instruction to the AI (prompt injection in a merchant name, SMS or note; injection.ts)
// Pure: runs in the browser before anything is sent, and in tests.
import { redact } from './redact';
import { defang } from './injection';

const DROP = /^(source_?file|files?|evidence|sources|raw|narration|desc|description_raw|ref(erence)?|txn_ids?|rows)$/i;
const DESCRIPTOR = /^(UPI|NEFT|IMPS|RTGS|NACH|ACH|MMT|BIL|INF|TPT|POS|ECOM)[\s/:*-]/i;
const HANDLE = /[\w.-]+@[a-z][\w-]*(?![\w-]*\.[a-z])/i; // a UPI id (name@bank); an email has a dot after the @ and is redacted below
const MAX_ITEMS = 30;

export function cleanString(s: string, names: string[] = []): string {
  const t = s.trim();
  if (DESCRIPTOR.test(t) || HANDLE.test(t)) return /^(NEFT|IMPS|RTGS|NACH|ACH)/i.test(t) ? 'a bank transfer' : 'a UPI payment';
  // redact() skips a long number that touches a comma or dot ("acct 50100012345678,"); here any 9+ digit run goes, amounts
  // never have one (they're written with commas: ₹3,25,378)
  return defang(redact(s, { names }).replace(/(?<!\d)\d{9,18}(?!\d)/g, '[NUMBER]'));
}

export function forLlm<T>(value: T, names: string[] = []): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return cleanString(v, names);
    if (Array.isArray(v)) return v.slice(0, MAX_ITEMS).map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (!DROP.test(k)) out[k] = walk(x);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
