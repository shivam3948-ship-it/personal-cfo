// Strip identifiers before any text goes to an LLM or a log. Mock data only at the buildathon, but the habit is the product.
const PAN = /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const PHONE = /(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)/g;
const LONG_DIGITS = /(?<![\d,.])\d{9,18}(?![\d,.])/g; // account / card / folio numbers
const UPI_HANDLE = /\b[\w.-]+@(ok\w+|ybl|ibl|axl|paytm|upi|apl|icici|hdfcbank|sbi|axisbank|kotak)\b/gi;
const CARD16 = /\b(?:\d{4}[\s-]?){3}\d{4}\b/g;

export interface RedactOptions { names?: string[] }

export function redact(text: string, opts: RedactOptions = {}): string {
  let t = text
    .replace(PAN, '[PAN]')
    .replace(UPI_HANDLE, '[UPI-ID]')
    .replace(EMAIL, (m) => (/\.example$/i.test(m) ? m : '[EMAIL]')) // keep fictional business contacts usable for drafts
    .replace(CARD16, '[CARD]')
    .replace(PHONE, '[PHONE]')
    .replace(LONG_DIGITS, '[NUMBER]');
  for (const n of opts.names ?? []) {
    if (n.trim().length < 3) continue;
    t = t.replace(new RegExp(`\\b${n.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '[NAME]');
  }
  return t;
}

/** Person-to-person UPI narrations carry names: replace the counterparty with a stable label. */
export function maskCounterparty(desc: string): string {
  if (!/\bp2p\b|^upi\/[a-z ]+$/i.test(desc)) return desc;
  return desc.replace(/(p2p\/)([^/]+)/i, (_, a) => `${a}[PERSON]`);
}

/** Names that appear as the account holder in uploaded documents, used to scrub free text. */
export function holderNames(texts: string[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    for (const m of t.matchAll(/(?:(?:account holder|name|borrower|life assured|proposer|consumer)\s*:|\bdear)\s*([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+){0,2})/gi)) {
      const n = m[1].trim();
      if (!/^(customer|policyholder|sir|madam|team)$/i.test(n)) { out.add(n); out.add(n.split(' ')[0]); }
    }
  }
  return [...out].filter((n) => n.length >= 3);
}
