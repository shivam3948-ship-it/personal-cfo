# Munim: a voice CFO (buildathon app)

Ask about your money out loud, in Hindi or English. Munim reads bank and card statements, SMS alerts, emails, loan papers, insurance policies and a credit report, connects them, finds what matters, and acts: email drafts, calendar reminders, a savings goal, a prepayment plan.

Built for the Bachatt × Digia Voice AI × Finance Buildathon (17 Oct 2026). Runbook: [docs/17](../../docs/17-buildathon-runbook.md) · Voice stack decision: [docs/16](../../docs/16-voice-stack-decision.md) · Native roadmap: [docs/18](../../docs/18-expo-native-roadmap.md).

## Run it
```bash
cd apps/voice-cfo
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY and SARVAM_API_KEY (both optional)
npm run smoke                # checks both keys, request shapes and latency
npm run dev                  # http://localhost:3000 (use Chrome for the mic)
```
With no keys it still works: a rule-based agent answers, and the browser does speech.

| Script | What it does |
|---|---|
| `npm test` | 70+ tests: engine vs independent ground truth, parsers (CSV/text/PDF/JSON/SMS/email), reconciliation checks, the offline golden set, the PII leak test, a mocked Claude loop, the Sarvam client |
| `npm run eval:live` | The golden questions against live Claude: tool choice, numbers verified, boundaries; writes `.data/eval-live.tsv` |
| `npm run demo:data` | Regenerates the synthetic dataset and `expected.json` (deterministic) |
| `npm run demo:pdfs` | Writes the demo documents as PDFs to `demo-pdfs/`, to rehearse PDF uploads |
| `npm run e2e` | Browser smoke test against a running server (needs Playwright) |
| `npm run build` | Production build |

## How it works
```
mic ─► /api/stt (Sarvam Saaras) ─► transcript
                                     │
            /api/agent: Claude + tools (or offline rules)
                                     │   numbers come only from tools ─► guard checks every ₹/% in the answer
                                     ▼
 answer ─► forSpeech() ─► /api/tts (Sarvam Bulbul) ─► speaker        actions ─► .ics / mail draft / goal / plan
```
- **Ingestion** (`lib/ingest`): classify → deterministic parser → checks. Unknown formats → Claude extraction → the same checks. All money in integer paise.
- **Checks** (22 on the sample): bank running balance and opening/closing; card total-due formula and line items; SMS balances continue the statement; card payment ↔ bank debit; stated EMI ↔ loan terms ↔ bank EMI debits; credit-report balance ↔ amortisation; premium debits ↔ policy.
- **Engine** (`lib/finance`): true spend (excludes self-transfers, card bill payments, cashback, interest; nets refunds), committed outflows, surplus, subscriptions, duplicates, leaks from emails, unusual spend, upcoming dues (new prices applied), cash flow to the next salary, emergency months, loans (prepayment with charges and lock-in, switch vs rate-match), insurance (IRR from the insurer's illustration, claim waiting periods), credit view.
- **Agent** (`lib/agent`): 18 tools, 4 of them actions. A spoken style prompt. The guard flags any figure not found in tool output; the UI shows "✓ numbers traced" or the unverified figure.
- **Privacy** (`lib/privacy`): PAN, phone numbers, emails, account/card numbers, UPI handles and holder names are stripped from any document text sent to the LLM; tool results carry merchant names, not narrations.

## Using the organisers' dataset
Upload the files in the Data card, or drop them into a folder and call `ingest()`. Red rows tell you which parser to adjust. See runbook §4.

## Known gaps (prototype)
Single process, in-memory sessions (an `x-sid` header, no auth); uploads are lost on restart. Sarvam's TTS field names vary by API version, so the client tries three shapes (`npm run smoke` shows which works). Browser STT needs a network. Not investment, tax or insurance advice; fictional data only.
