// Who your statements name besides businesses: UPI payees, NEFT senders, 'MB-' transfers. These are people (or tiny shops)
// and must not reach an AI or a voice service (D-050). A merchant counts as a possible person when Munim doesn't know the
// brand AND the row isn't everyday spending in a known category (Other, transfers, income from a named sender…).
import type { Txn } from '../types';
import { KNOWN_MERCHANTS, groupOf } from '../finance/categorize';

const STOP = /^(upi|neft|imps|rtgs|nach|ach|mb|ib|dr|cr|neft cr|neft dr|imps p2a|ref|payment|paid|transfer|sent|received|from|to|via|bank|ltd|pvt|india|mobile|net banking|pay)$/i;

export function counterpartyNames(txns: Txn[]): string[] {
  const out = new Set<string>();
  for (const t of txns) {
    const m = (t.merchant ?? '').trim();
    if (m.length < 3 || KNOWN_MERCHANTS.has(m) || !/[A-Za-z\u0900-\u097F]{2}/.test(m)) continue;
    const cat = t.category ?? 'Other';
    if (!(cat.startsWith('Other') || groupOf(cat) !== 'spend')) continue;
    out.add(m);
    // the name inside a narration: "UPI-RAHUL KUMAR-rahul@okaxis-…", "MB-PRIYA VERMA-REF 1", "NEFT CR-HDFC0001-RAMESH GUPTA-REF"
    for (const seg of `${m} ${t.desc}`.split(/[-/|]/)) {
      const x = seg.trim();
      if (x.length >= 3 && !/\d|@/.test(x) && /^[A-Za-z\u0900-\u097F .']+$/.test(x) && !STOP.test(x)) out.add(x);
    }
  }
  return [...out].sort((a, b) => b.length - a.length); // longest first, so "RAHUL KUMAR" goes before "RAHUL"
}
