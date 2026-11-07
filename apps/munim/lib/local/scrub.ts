// Text from your own data that may leave the phone (the voice service, the owner's log, D-089): your name and every payee
// or sender your statements name become [NAME], identifiers go (core redact), and UPI/NEFT/IMPS references become "a payment".
import { redact } from '@core/privacy/redact';

export const scrub = (s: string, names: string[]) => redact(s, { names }).replace(/\b(UPI|NEFT|IMPS)[-/][^\s,.।]+/gi, 'a payment');
