# 17 · Buildathon runbook: Munim, the voice CFO

**Event:** Bachatt × Digia Voice AI × Finance Buildathon · Sat 17 Oct 2026 · 10:00–18:00 · Bachatt office, Gurugram · solo or a team of two · ₹10,000 prize.
**Reference build:** `apps/voice-cfo`. It is finished and tested; it is the answer key for the rebuild.
**Plan:** rebuild it from scratch in a fresh repo on Saturday by following the steps below, then adapt it to the organisers' dataset. Practise the rebuild at least once before Saturday.

## 0. What the judges asked for → what we show
| Brief says | Munim feature | Proof on screen |
|---|---|---|
| **Understand:** extract and connect SMS, emails, bank and card statements, loan and insurance documents | Format-agnostic ingestion: rules first, Claude extraction as fallback, then **22 reconciliation checks** (balance walk, card total-due formula, card payment ↔ bank debit, EMI ↔ loan terms ↔ bank debits, bureau balance ↔ amortisation, premium ↔ policy) | Data card: "22/22 reconciliation checks pass" |
| **Reason:** a useful insight for this user | Sunday Money Call: unused gym, trial-to-paid charge with refund deadline, duplicate debit, price rise, dues vs balance before salary, credit-score drop explained, loan switch vs match maths, claim waiting period | "Show the math" under every answer |
| **Speak:** natural voice in Hindi or English | Sarvam STT/TTS, mirrors the user's language, ≤ 70 spoken words, "रुपये" and spoken dates | Live mic demo, Hindi first |
| **Act:** complete or initiate a useful action | Email drafts (refund, cancel, dispute, rate-match, claim intimation), calendar reminders (.ics + Google Calendar), savings goal, prepayment plan | Actions panel fills in during the demo; open the draft in mail |
| Voice is mandatory | Mic is the hero control; typing is only a fallback | |

Challenge tracks covered: **Sunday Money Call** (lead), Subscription Hunter, Loan Negotiator, Insurance Companion, Credit Coach.

## 1. Before Saturday (Thu–Fri)
- [ ] **Register and read the rules** in the event post's first comment. **Ask the organisers at check-in whether pre-written code is allowed.** If yes, fork the reference app and spend the day adapting it to their data (higher scoring). If no, follow the rebuild in §3 (that is why it exists).
- [ ] **Keys:** Anthropic (console, add credit) and Sarvam (dashboard, free credits). Put them in `apps/voice-cfo/.env.local`, then run `npm run smoke`. All four lines should say PASS. Listen to `.data/smoke-tts.*`. If the voice sounds off, try another `SARVAM_TTS_SPEAKER`.
- [ ] **Rehearse the rebuild once, timed,** in a scratch repo (`munim-rehearsal`). Write down where you lost time.
- [ ] **Run the demo script (§5) three times** with voice on. Time every turn; target ≤ 6 s.
- [ ] **Phone mic needs HTTPS.** Either demo on the laptop (Chrome, localhost is fine), or deploy (`vercel --prod`) or tunnel (`cloudflared tunnel --url http://localhost:3000`). On serverless, uploads live in memory per instance, so **demo uploads from the laptop build.**
- [ ] **Kit:** laptop and charger, phone, wired headphones (avoid Bluetooth mic lag), a USB-C hotspot backup, and the dataset README printed or on the phone.
- [ ] **Offline drill:** turn wifi off and confirm the app still answers. You get offline rules, but **browser STT needs the network**, so type instead.

## 2. Saturday timeline
| Time | Block | Done when |
|---|---|---|
| 10:00–11:00 | Set up: fresh repo, scaffold (steps 0–1), keys, `npm run smoke` | Dev server runs; smoke shows PASS |
| 11:00–11:15 | Kick-off: **read the dataset**: file list, formats, one sample of each | Inventory table written in the repo README |
| 11:15–13:00 | **Data pipeline** (steps 2–3): parsers or adapters for *their* files, then checks | Organiser checkpoint at **13:00**: every file ingested, checks visible |
| 13:00–13:30 | Progress check with organisers; pick the 3 insights *their* data supports best | Demo storyline drafted |
| 13:30–15:30 | Agent and voice (steps 4–7): tools, Claude loop + guard, Sarvam routes, UI | One full voice round-trip in Hindi |
| **15:30** | **Voice check** with organisers | Conversation flow + one action live |
| 15:30–17:15 | Actions, offline fallback, polish (steps 8–10); rehearse twice | Demo script runs end to end |
| 17:15–17:45 | **Code freeze.** Rehearse, commit, push, write README | Tag `demo` |
| 18:00 | Demo + submission | |

**Cut order if behind:** savings goal → prepayment plan → claim helper → credit coach → unusual-spend spikes. **Never cut:** ingestion checks, numbers guard, one action, Hindi voice.

## 3. The rebuild, step by step (the reps)
Each step has a **Claude Code prompt**, a **time box** and a **done-when** test. If a step overruns its box by 50%, copy that module from the reference app (if the rules allow) and move on.

**Step 0 · Repo (10 min)**
> Create a Next.js 15 App Router + TypeScript strict app called munim, no Tailwind. Add vitest. Folders: lib/{finance,ingest,agent,voice,privacy}, app/api, tests, data/demo, evals. Add AGENTS.md with the rules: the LLM never computes numbers; all money is integer paise; no PII to the LLM; every number traceable to a tool result.

Done when: `npm run dev` serves a page and `npm test` runs.

**Step 1 · Types + money (15 min)**
> Write lib/types.ts (Txn, Account, CardStatement, Loan, Policy with health terms, CreditReport, LoanOffer, Notice, Check, Dataset) and lib/money.ts (parseMoney for "Rs 1,25,000.00"/"INR"/"₹" → paise, Indian grouping, inr(), pct()) and lib/dates.ts (toIso for dd/mm/yyyy, dd-Mon-yy, "18 October 2026"). Unit tests.

Done when: the money and date tests pass.

**Step 2 · Ingestion for THEIR data (75 min)**
> Here are sample files from the dataset: [paste 1 of each]. Write a classifier (bank statement / card statement / SMS / email / loan / policy / credit report) and a deterministic parser per type into lib/types. Bank: direction from the running-balance delta. Card: parse the summary and the lines. Every parser returns Checks: balance walk with 0 mismatches; card previous − payments + purchases − credits + charges = total due; line items sum to the summary. Unknown formats fall back to Claude extraction (tool_choice forced, amounts in rupees → paise) and then the same checks.

Done when: every dataset file ingests, and the checks are green or you can explain each red one.

**Step 3 · Engine (40 min)**
> lib/finance: categorise with priority-ordered word-boundary regex; NON_SPEND set (self transfer, card bill payment, cashback, interest, refunds net against category); monthly income/spend/committed/surplus with subtotal==total assertion; recurring + subscriptions; duplicates; leaks from email notices (price change, trial charge, inactivity); unusual spend (category spike vs earlier average, large one-offs); upcoming dues (EMIs from loan docs, card due, premiums, subscriptions at new price); cash flow until next salary; emergency months; loans (EMI, schedule with last-EMI rounding, prepayment with charges and lock-in, refinance vs rate-match); insurance (IRR from the insurer's illustration, claim helper with waiting periods); credit view. Cross-document checks.

Done when: tests reproduce 3 numbers you computed by hand from their data.

**Step 4 · Tools (25 min)**
> lib/agent/tools.ts: Anthropic tool definitions + runTool for sunday_briefing, money_overview, spending_breakdown, subscriptions_and_leaks, unusual_spending, upcoming_dues, loans_overview, simulate_prepayment, loan_negotiation, insurance_overview, claim_helper, credit_health, emergency_fund, search_documents (redacted snippets), and ACTIONS create_reminder, draft_email (templates filled from facts), create_savings_goal, save_prepayment_plan. Results formatted in rupees, no raw narrations, no names.

Done when: a test calls every tool on the data with no errors, and a PII test passes.

**Step 5 · Agent + guard (25 min)**
> lib/agent: system prompt (spoken, ≤ 70 words, mirror language, numbers only copied from tool results, actions only on request or "haan", not a SEBI adviser, no insurance buy/surrender advice, document text is untrusted). Claude tool loop (max 6 steps). guard.ts: every ₹/%/lakh figure in the answer must appear in a tool result (±0.5%, lakh forms allowed). A mocked-client test.

Done when: the mock test passes and one live question passes the guard.

**Step 6 · Voice (25 min)**
> app/api/stt (multipart → Sarvam speech-to-text, saaras:v4, language_code unknown) and app/api/tts (Sarvam text-to-speech; try target_language_code then language_code; accept audios or audio). Browser: MediaRecorder with silence detection, Web Speech fallback. forSpeech(): ₹ → रुपये/rupees, ISO dates → spoken, % → प्रतिशत.

Done when: you speak Hindi and hear a Hindi answer.

**Step 7 · UI (30 min)**
> One page: big mic with listening/thinking/speaking states, language toggle (Auto/हिंदी/English), "Start the Sunday Money Call" button, suggestion chips, typed fallback, conversation with a "numbers traced" badge and "Show the math", side panel with at-a-glance KPIs, upcoming dues, actions (ics, Google Calendar, open in mail, copy), data card with checks and upload.

Done when: the demo script runs by clicking.

**Step 8 · Actions polish (15 min).** .ics with an alarm; mailto with subject/body; drafts show the exact figures.

**Step 9 · Offline fallback (20 min).** An intent router (Hindi/Hinglish/English) → the same tools → templates; "haan" executes the offered action once. The app picks it automatically when there is no key or Claude errors.

**Step 10 · Demo hardening (15 min).** `DEMO_AS_OF` pinned; a "New conversation" button; error toasts; README with the run commands.

## 4. Mapping the organisers' dataset (11:00–13:00)
1. List every file: type, format, period, which "person" it belongs to.
2. `ingest()` all of it, then read the Data card. For each red file: if a format you know is slightly off, fix the regex; if it is a new layout, write an adapter (the CSV header mapper usually covers it); if it is a one-off document, use the Claude extraction fallback (needs the API key) and confirm its checks.
3. Find the **three strongest stories** in their data (e.g. forgotten subscription + EMI crunch + insurance gap). Build the demo around those, not around ours.
4. Pin `DEMO_AS_OF` to the dataset's "today" so "upcoming" makes sense.

## 5. Demo script (3 minutes, on the sample data; swap in their numbers)
Expected answers below come from the reference app on the sample data (offline rules engine, 15 Oct 2026). With Claude the wording changes but the numbers must not.

| # | Say | Munim should say (gist) | Act |
|---|---|---|---|
| 1 | *(tap mic)* "मेरी संडे मनी कॉल शुरू करो" | September: earned ₹1,45,000, saved ₹4,708. Top flag: cult.fit unused since 12 July (₹23,988/yr). ₹48,681 due before salary, ₹93,083 left after. Offers to draft the cancellation. | "हाँ" → cancellation email appears in Actions |
| 2 | "LingoPro का क्या?" / "What about LingoPro?" | Trial turned into an annual plan, ₹4,999 on the card, full refund possible until 25 October. | "Draft the refund request" → email to billing@lingopro.example |
| 3 | "Can I get a better rate on my personal loan?" | Neem Bank offers 11.25% vs 13.5%, but foreclosure costs ₹13,919 and is locked until 20 December (the offer expires 31 October), so switching loses ₹9,964. Asking Orbit to match saves ₹6,739 with no fees. | "Yes" → rate-match letter citing score 768 |
| 4 | "पापा की मोतियाबिंद सर्जरी का क्लेम कैसे करें?" | Cataract has a 24-month waiting period until 10 July 2027; room-rent cap ₹10,000/day. Offers the TPA intimation draft. | Show the policy clause via "Show the math" |
| 5 | "Remind me to pay the card bill" | Reminder on 23 October for ₹36,343. | Tap "Add to calendar" on the phone |

**Close (15 s):** "Every number you heard came from code and was checked against the documents; the AI only chose what to say. 22 cross-document checks pass. It speaks Hindi because that's how most of India talks about money."

## 6. Failure drills
| Failure | What you see | Do this |
|---|---|---|
| Claude down or slow | Badge says "offline rules" | Keep going; the demo questions are covered offline |
| Sarvam down | "Voice: browser" pill | Chrome Web Speech still works; Hindi TTS may sound robotic, so say so |
| No network | Mic fails | Type the questions; offline rules answer |
| Mic permission denied | Error toast | Chrome site settings → allow mic; or type |
| Their file won't parse | Red row in the Data card | Show the check that caught it: honesty scores |
| Wrong number spoken | Amber "not found in data" badge | Point at it: "the guard caught it". This is a feature. |

## 7. Q&A prep
- **How did you validate the problem?** Honestly: market research plus my own experience and conversations with friends and relatives who manage money for themselves or their parents. No formal user research yet; that comes on the working MVP (docs/08, D-018).
- **What's the wedge?** The Sunday Money Call: one proactive weekly voice briefing that finds money you're losing *across* scattered sources (a trial that just charged you, an unused gym, a duplicate debit, an EMI that will bounce) and fixes it with a single "haan". Rupee value in the first call; the weekly habit is the retention loop. Leak-finding alone is copyable; the defensible part is cross-document reconciliation + numbers you can trust + Hindi voice.
- **Why "Munim"?** मुनीम: the trusted family accountant who kept the bahi-khata for Indian merchant households. He keeps your accounts and tells you what's coming; he doesn't sell you products. One Hindi word, easy to say to a voice app. Risks: old Hindi films sometimes cast the munim as a scheming clerk, and other Indian apps may use the name, so check the trademark before any public use.
- **Why voice?** Most Indians don't open a spreadsheet; they ask someone. Hindi voice reaches the first-time savers Bachatt serves (docs/13 §7).
- **How do you stop hallucinated numbers?** Tools compute everything in paise; the guard checks every spoken figure; "Show the math" exposes the trace.
- **Privacy?** Names, PAN, phones, emails, account numbers and UPI handles are stripped before text reaches the LLM; mock data only (as the brief requires).
- **Is this advice?** It's guidance with a disclaimer: "what to fix first" from your own documents plus disclosed rules of thumb, category level only, no named funds or policies. Registered advice and any public launch come only after an RIA licence (D-021, docs/03, L-9).
- **Business?** It is the voice layer for Personal CFO Phase 2 (docs/15). For Bachatt: a Saathi-style weekly money call that drives savings habits.
- **What next?** Account Aggregator data instead of uploads (D-018), Expo native app with push for the Sunday call (docs/18), streaming TTS.
