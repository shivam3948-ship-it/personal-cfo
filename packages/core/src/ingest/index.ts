// Ingestion pipeline: any file -> text -> classify -> parse (rules first, Claude fallback) -> checks -> merge into a Dataset.
import type { Check, Dataset, IngestResult, Txn } from '../types';
import { emptyDataset } from '../types';
import { bankCsvToTxns, balanceChecks } from './csv';
import { bankTextToTxns, cardTextToStatement, classify, creditFromText, emailToNotice, loanFromText, offerFromNotice, policyFromText, smsToTxns, type DocKind } from './parsers';
import { jsonToTxns } from './json';
import { llmExtract, type Extracted } from './llmExtract';
import { categorizeAll, categorize, merchantOf } from '../finance/categorize';
import { pdfToText } from './pdf';
import { inr } from '../money';
import { finalise } from './finalise';

export interface InFile { name: string; bytes: Uint8Array }

export async function fileToText(f: InFile): Promise<string> {
  if (f.name.toLowerCase().endsWith('.pdf') || (f.bytes[0] === 0x25 && f.bytes[1] === 0x50)) return pdfToText(f.bytes);
  return new TextDecoder('utf-8').decode(f.bytes);
}

export async function ingest(files: InFile[], label = 'Your uploads', opts: { useLlm?: boolean } = {}): Promise<Dataset> {
  const ds = emptyDataset(label);
  const texts: { name: string; text: string }[] = [];
  for (const f of files) {
    try { texts.push({ name: f.name, text: await fileToText(f) }); }
    catch (e) { ds.log.push({ file: f.name, kind: 'unreadable', parser: 'none', ok: false, summary: `Could not read: ${(e as Error).message}`, checks: [] }); }
  }
  // Order matters for cross-checks: statements before SMS (SMS continue the statement balance).
  const rank: Record<DocKind, number> = { bank_csv: 0, bank_text: 0, json: 1, card_statement: 2, sms: 3, email: 4, loan: 5, policy: 6, credit_report: 7, unknown: 8 };
  const classified = texts.map((t) => ({ ...t, kind: classify(t.name, t.text) })).sort((a, b) => rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name));
  for (const { name, text, kind } of classified) {
    ds.docs.push({ id: name, file: name, kind, text });
    try { await ingestOne(ds, name, text, kind, opts.useLlm !== false); }
    catch (e) { ds.log.push({ file: name, kind, parser: 'rule', ok: false, summary: `Parse error: ${(e as Error).message}`, checks: [] }); }
  }
  finalise(ds);
  return ds;
}

async function ingestOne(ds: Dataset, file: string, text: string, kind: DocKind, useLlm: boolean) {
  const log = (r: Omit<IngestResult, 'file' | 'kind'>) => ds.log.push({ file, kind, ...r });
  switch (kind) {
    case 'bank_csv': {
      const r = bankCsvToTxns(text, file);
      upsertAccount(ds, r.account); ds.txns.push(...r.txns);
      return log({ parser: 'rule', ok: r.checks.every((c) => c.ok), summary: `${r.txns.length} bank transactions ${r.txns[0]?.date} to ${r.txns.at(-1)?.date}`, checks: r.checks });
    }
    case 'bank_text': {
      const r = bankTextToTxns(text, file);
      if (r.txns.length) { upsertAccount(ds, r.account); ds.txns.push(...r.txns); return log({ parser: 'rule', ok: r.checks.every((c) => c.ok), summary: `${r.txns.length} bank transactions`, checks: r.checks }); }
      break;
    }
    case 'json': {
      const tx = jsonToTxns(text, file);
      if (tx?.length) { addAccountsFor(ds, tx); ds.txns.push(...tx); return log({ parser: 'rule', ok: true, summary: `${tx.length} transactions from JSON`, checks: walkPerAccount(tx, 'JSON') }); }
      break;
    }
    case 'card_statement': {
      const r = cardTextToStatement(text, file);
      if (r.stmt.totalDue || r.txns.length) {
        upsertAccount(ds, r.account); ds.cardStatements.push(r.stmt); ds.txns.push(...r.txns);
        return log({ parser: 'rule', ok: r.checks.every((c) => c.ok), summary: `Card statement ${r.stmt.periodStart} to ${r.stmt.periodEnd}, total due ${inr(r.stmt.totalDue)} by ${r.stmt.dueDate}`, checks: r.checks });
      }
      break;
    }
    case 'sms': {
      const r = smsToTxns(text, file);
      if (!r.txns.length) break; // nothing recognisable: let the AI extractor try
      const fresh = dedupe(ds.txns, r.txns);
      addAccountsFor(ds, fresh); ds.txns.push(...fresh); ds.notices.push(...r.notices);
      const checks = smsContinuity(ds, fresh);
      return log({ parser: 'rule', ok: checks.every((c) => c.ok), summary: `${fresh.length} transactions and ${r.notices.length} notices from SMS (${r.skipped} OTP/promo skipped${r.txns.length - fresh.length ? `, ${r.txns.length - fresh.length} duplicates of statement rows dropped` : ''})`, checks });
    }
    case 'email': {
      const n = emailToNotice(text, file);
      ds.notices.push(n);
      const offer = offerFromNotice(n); if (offer) ds.offers.push(offer);
      return log({ parser: 'rule', ok: true, summary: `Email "${n.subject}" → ${n.kind}`, checks: [] });
    }
    case 'loan': {
      const r = loanFromText(text, file);
      if (r.loan) { ds.loans.push(r.loan); return log({ parser: 'rule', ok: true, summary: `${r.loan.lender} ${r.loan.type} loan, EMI ${inr(r.loan.emi)}`, checks: [] }); }
      break;
    }
    case 'policy': {
      const r = policyFromText(text, file);
      if (r.policy) { ds.policies.push(r.policy); return log({ parser: 'rule', ok: true, summary: `${r.policy.insurer} ${r.policy.kind} policy, cover ${inr(r.policy.sumAssured)}`, checks: [] }); }
      break;
    }
    case 'credit_report': {
      const c = creditFromText(text, file);
      if (c) { ds.credit = c; return log({ parser: 'rule', ok: true, summary: `Credit score ${c.score}${c.previousScore ? ` (was ${c.previousScore})` : ''}`, checks: [] }); }
      break;
    }
  }
  // Fallback: Claude extraction, then the same checks.
  if (!useLlm) return log({ parser: 'none', ok: false, summary: 'No rule-based parser matched and LLM extraction is off', checks: [] });
  const x = await llmExtract(text, file);
  if (!x) return log({ parser: 'none', ok: false, summary: 'No rule-based parser matched (add ANTHROPIC_API_KEY for AI extraction)', checks: [] });
  mergeExtracted(ds, x, file);
}

function mergeExtracted(ds: Dataset, x: Extracted, file: string) {
  const checks: Check[] = [];
  if (x.txns.length) {
    const fresh = dedupe(ds.txns, x.txns); addAccountsFor(ds, fresh); ds.txns.push(...fresh);
    if (x.opening !== undefined || x.txns.some((t) => t.balance !== undefined)) checks.push(...balanceChecks(x.txns, x.opening, x.closing, 'Extracted statement'));
  }
  if (x.card) { ds.cardStatements.push(x.card); const f = x.card.prevBalance - x.card.payments + x.card.purchases - x.card.credits + x.card.charges; checks.push({ id: 'card_total', label: 'Card total due formula', ok: Math.abs(f - x.card.totalDue) <= 100, detail: `${f} vs ${x.card.totalDue}` }); }
  if (x.loan) ds.loans.push(x.loan);
  if (x.policy) ds.policies.push(x.policy);
  if (x.credit) ds.credit = x.credit;
  if (x.notice) { ds.notices.push(x.notice); }
  ds.log.push({ file, kind: x.kind, parser: 'llm', ok: checks.every((c) => c.ok), summary: `AI-extracted ${x.kind}${x.txns.length ? `, ${x.txns.length} transactions` : ''}. Verify before relying on it.`, checks });
}

function upsertAccount(ds: Dataset, a: Dataset['accounts'][number]) {
  const i = ds.accounts.findIndex((x) => x.id === a.id);
  if (i < 0) ds.accounts.push(a);
  else ds.accounts[i] = { ...ds.accounts[i], ...Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)) };
}
function addAccountsFor(ds: Dataset, tx: Txn[]) {
  for (const id of new Set(tx.map((t) => t.account))) if (!ds.accounts.some((a) => a.id === id)) {
    const [kind, last4] = id.split(':') as ['bank' | 'card', string];
    ds.accounts.push({ id, kind, last4, label: `${kind === 'bank' ? 'Bank account' : 'Credit card'} ••${last4}` });
  }
}

/** Same account + date + amount + direction already present (e.g. an SMS for a row that is also in the statement). */
export function dedupe(existing: Txn[], incoming: Txn[]): Txn[] {
  const key = (t: Txn) => `${t.account}|${t.date}|${t.amount}|${t.dir}`;
  const counts = new Map<string, number>();
  for (const t of existing) counts.set(key(t), (counts.get(key(t)) ?? 0) + 1);
  const out: Txn[] = [];
  for (const t of incoming) { const k = key(t); const c = counts.get(k) ?? 0; if (c > 0) counts.set(k, c - 1); else out.push(t); }
  return out;
}

function walkPerAccount(tx: Txn[], label: string): Check[] {
  return [...new Set(tx.map((t) => t.account))].flatMap((a) => balanceChecks(tx.filter((t) => t.account === a), undefined, undefined, `${label} ${a}`));
}

/** SMS balances must continue from the bank statement's closing balance. */
function smsContinuity(ds: Dataset, sms: Txn[]): Check[] {
  const checks: Check[] = [];
  for (const acct of new Set(sms.filter((t) => t.balance !== undefined).map((t) => t.account))) {
    const a = ds.accounts.find((x) => x.id === acct);
    const rows = sms.filter((t) => t.account === acct).sort((x, y) => x.date.localeCompare(y.date));
    checks.push(...balanceChecks(rows, a?.closing, undefined, `SMS ${acct}`));
  }
  return checks;
}

export { finalise } from './finalise';

// Re-exports used by the UI/tests.
export { categorize, merchantOf };
