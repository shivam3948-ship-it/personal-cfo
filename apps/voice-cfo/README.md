# Munim: a voice CFO (buildathon app)

Ask about your money out loud, in Hindi or English. Munim reads bank and card statements, SMS alerts, emails, loan papers, insurance policies and a credit report, connects them, finds what matters, and acts: email drafts, calendar reminders, a savings goal, a prepayment plan.

Built for the Bachatt × Digia Voice AI × Finance Buildathon (17 Oct 2026). Runbook: [docs/17](../../docs/17-buildathon-runbook.md) · Voice stack decision: [docs/16](../../docs/16-voice-stack-decision.md) · Native roadmap: [docs/18](../../docs/18-expo-native-roadmap.md).

## Try it
**1 · On your Mac (5 minutes, voice works).** Needs Node 20+ (`node -v`; if missing: `brew install node`).
```bash
cd ~/PyCharmMiscProject/Github/personal-cfo/apps/voice-cfo
npm install
npm run dev          # open http://localhost:3000 in Chrome, allow the mic
```
No keys needed: it runs on the sample data with offline rules and browser voice. Add keys to `.env.local` for Claude and Sarvam.

**2 · On your phone, same Wi-Fi.** `npm run dev:lan`, then open `http://<your Mac's IP>:3000` on the phone (IP: `ipconfig getifaddr en0`). Typing works; **the mic needs HTTPS**, so for voice on the phone use a tunnel: `brew install cloudflared && cloudflared tunnel --url http://localhost:3000` and open the `https://…trycloudflare.com` link it prints. "Add to Home Screen" installs it like an app (PWA).

**3 · Hosted link (Vercel).** `npm i -g vercel`, then from `apps/voice-cfo`: `vercel` (first time, links the project), add `ANTHROPIC_API_KEY` / `SARVAM_API_KEY` in the Vercel dashboard, then `vercel --prod`. Caveat: serverless instances keep uploads in memory, so **demo uploads from the laptop build**; the sample data works anywhere.

## Run it (developer)
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
- **Agent** (`lib/agent`): 19 tools (incl. `advice_plan`, the foundation-first guidance in `lib/finance/advice.ts`), 4 of them actions. A spoken style prompt. The guard flags any figure not found in tool output; the UI shows "✓ numbers traced" or the unverified figure.
- **Privacy** (`lib/privacy`): PAN, phone numbers, emails, account/card numbers, UPI handles and holder names are stripped from any document text sent to the LLM; tool results carry merchant names, not narrations.

## Trust and safety
| Concern | What the app does | Known gap |
|---|---|---|
| **Compliance (SEBI / IRDAI)** | Guidance with a disclaimer (D-021): `advice_plan` gives foundation-first recommendations from the user's documents and disclosed rules of thumb; the disclaimer is spoken once per conversation and a "Guidance · not registered advice" badge shows on every advised answer; category level only (no named funds, stocks or policies, no "surrender this policy"); no GTM until the RIA licence; live eval cases probe the boundary | Live evals have not been run yet (they need an API key); no compliance-reviewer pass on the final copy |
| **Security** | API keys stay server-side; upload limits (40 files, 15 MB); sessions are random UUIDs; strict headers (`nosniff`, no referrer, mic only on self); document, email and SMS text is treated as untrusted (prompt + extraction system prompt); CI repo hygiene blocks PDFs, `.env` and PAN-shaped strings | No auth or rate limiting (single-user prototype); in-memory sessions |
| **Personal data (DPDP)** | Mock data only (the event rule); before the LLM, PAN, phone numbers, emails, account/card numbers, UPI handles and holder names are stripped from document text **and from what the user says**; tool results carry merchant names, not narrations; logs hold error messages only; uploads live in memory and "Back to sample data" drops them | Raw voice audio goes to Sarvam (data location not verified); no consent screen or retention policy, both needed before real data |
| **Hallucination** | Every number is computed in code (paise) and the LLM only copies it; the guard checks every ₹/%/lakh figure against tool output; one automatic repair round, then an amber "not found in data" badge; "Show the math" on every answer; deterministic parsers first, and AI extraction must pass the same reconciliation checks | The guard checks numbers, not claims (a wrong merchant or date in prose is not caught); small counts (days, EMIs) are not checked |
| **Idempotency** | Actions are keyed by content (kind, title, date, recipient, amounts): a retry, a double "haan" or a repeated tool call returns the existing action (`already_existed: true`); the offline agent clears the pending offer after running it; calendar files use a stable UID, so re-importing does not duplicate the event; uploads replace the dataset rather than appending; nothing is sent externally (emails are drafts) | No idempotency key on HTTP requests; two genuinely different reminders on the same date need different titles |

## Using the organisers' dataset
Upload the files in the Data card, or drop them into a folder and call `ingest()`. Red rows tell you which parser to adjust. See runbook §4.

## Known gaps (prototype)
Single process, in-memory sessions (an `x-sid` header, no auth); uploads are lost on restart. Sarvam's TTS field names vary by API version, so the client tries three shapes (`npm run smoke` shows which works). Browser STT needs a network. Not investment, tax or insurance advice; fictional data only.
