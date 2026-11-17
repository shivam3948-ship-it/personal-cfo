// Who your statements name besides businesses: UPI payees, NEFT/IMPS senders, 'MB-' transfers. These are people (or tiny
// shops) and must not reach an AI or a voice service (D-050). Two ways a name is caught:
//   1. any transfer-style narration (UPI, IMPS, NEFT, RTGS, MB-, BY/TO TRANSFER) whose merchant Munim doesn't know as a
//      brand, whatever its category: "UPI/…/RAHUL KUMAR/…/Payment for rent" is Rent, and RAHUL KUMAR is still a person
//   2. any other unknown merchant on a row that isn't everyday spending (Other, transfers, income from a named sender)
// Bank codes from IFSCs (HDFC, SBIN…) and common narration words are never treated as names, so answers stay readable.
import type { Txn } from '../types';
import { KNOWN_MERCHANTS, groupOf } from '../finance/categorize';

const TRANSFER = /^\s*(UPI|IMPS|NEFT|RTGS|MB|IB|MMT|BY TRANSFER|TO TRANSFER|BY CLG|TRF)\b/i;
const BANK_CODES = /^(HDFC|SBIN|ICIC|UTIB|KKBK|YESB|PUNB|CNRB|BARB|IDIB|UBIN|BKID|IOBA|MAHB|CBIN|INDB|FDRL|IDFB|AUBL|PYTM|AIRP|JIOP|SIBL|KVBL|RATN|DBSS|SCBL|CITI|HSBC|UCBA|PSIB|ESFB|UJVN)$/i;
const COMMON = /\b(upi|neft|imps|rtgs|nach|ach|mb|ib|dr|cr|p2a|p2p|ref|payment|paid|pay|transfer|trf|sent|received|from|to|by|via|for|bank|ltd|pvt|limited|india|mobile|net banking|self|savings|person|gift|thank|thanks|you|rent|fees?|bill|school|petrol|fuel|grocery|groceries|food|salary|emi|loan|refund|cashback|interest|charges?|clg|ok)\b/i;

function isName(x: string): boolean {
  if (x.length < 3 || /\d|@/.test(x) || !/^[A-Za-zऀ-ॿ .']+$/.test(x) || BANK_CODES.test(x)) return false;
  const ws = x.split(/\s+/);
  // "Payment for rent", "THANK YOU" are words, not people; but a common first word with two or more other words is still a
  // name ("INDIA GATE STORES", review 29 Oct): mask it rather than send it
  return !ws.every((w) => COMMON.test(w)) && (!COMMON.test(ws[0]) || ws.filter((w) => !COMMON.test(w)).length >= 2);
}

export function counterpartyNames(txns: Txn[]): string[] {
  const out = new Set<string>();
  for (const t of txns) {
    const m = (t.merchant ?? '').trim();
    if (KNOWN_MERCHANTS.has(m)) continue;
    const cat = t.category ?? 'Other';
    const transfer = TRANSFER.test(t.desc);
    if (!transfer && !(cat.startsWith('Other') || groupOf(cat) !== 'spend')) continue;
    if (isName(m)) out.add(m);
    // the name inside a narration: "UPI-RAHUL KUMAR-rahul@okaxis-…", "MB-PRIYA VERMA-REF 1", "NEFT*HDFC0001*RAJESH GUPTA"
    for (const seg of `${m}/${t.desc}`.split(/[-/|*:]/)) { const x = seg.trim(); if (isName(x)) out.add(x); }
  }
  return [...out].sort((a, b) => b.length - a.length); // longest first, so "RAHUL KUMAR" goes before "RAHUL"
}
