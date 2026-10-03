# 04 · PRD — Phase 1: Portfolio X-ray + "Ask your CFO"

## 1. Title
Phase 1: Portfolio X-ray with grounded AI explanations (diagnosis only)

## 2. Author & Team
- **PM / builder:** Shivam Singh
- **Engineering:** Shivam + Claude Code (AI pair-programmer)
- **Legal review:** external securities lawyer (to be engaged; L-1)
- **Design:** Shivam (Figma), with UX copy review
- **Status:** Draft v0.1 · 2026-10-03

## 3. PM Epic
`PCFO-EPIC-1 · Portfolio X-ray` (GitHub Projects is the tracker; issues reference this ID)

---

# One Pager

## 4. Problem
DIY mutual fund investors can see *what* they own, not *whether it's any good for them*. Overlap, cost drag, concentration and drift are invisible or buried in charts, and advice is either conflicted (commission-paid) or expensive (fee-only RIA). Detail: 01-vision-strategy §2.

## 5. Objectives
| # | Objective | Measured by |
|---|---|---|
| O1 | Get a user from CAS upload to their first "aha" insight in under 3 minutes | Time to first insight (p50) |
| O2 | Make every insight understandable *and* verifiable | Comprehension check, "show the math" opens |
| O3 | Change behaviour, not just inform | Verified actions via CAS diff (North Star) |
| O4 | Zero wrong numbers, zero advice-boundary breaches | Eval suite gates (tech/AI_EVALS.md) |
| O5 | Produce a portfolio-grade demo plus eval scorecard | Public repo, live demo, published scorecard |

## 6. Constraints
- **Regulatory:** no personalised buy/sell/switch recommendations (03-regulatory §3). Advice code paths exist behind `ADVICE_ENABLED=false`.
- **Data:** CAS PDF only (CAMS + KFintech consolidated). No AA, no demat CAS in Phase 1.
- **Privacy:** no PII to the LLM; CAS password never stored; PDF deleted after parse by default.
- **Team:** solo builder; scope must fit 6 one-week sprints (S0–S5).
- **Cost:** pilot infra + LLM spend kept small; per-user LLM cost tracked from day one.

## 7. Personas
1. **Rohan, 31, the self-directed salaried investor (primary).** Product engineer in Bangalore. 9 funds across Groww and Coin, 4 SIPs, half of them started after reading a Reddit thread. Wants to know if he's "doing it right" without being sold anything.
2. **Priya, 35, the family money manager (secondary).** Tracks her parents' portfolio: regular plans bought via a bank RM. Wants one view and a clear answer to "what are they paying for this?"

(Illustrative composites, not research findings. Replace with real interview data after T-3.)

## 8. Use cases
- UC1: "Is my portfolio diversified, or do I own the same stocks five times?"
- UC2: "How much am I paying in fees every year, in rupees?"
- UC3: "Why is my return lower than the fund's advertised return?" (XIRR vs point-to-point)
- UC4: "Which of my funds has lagged its benchmark?"
- UC5: "What changed since last month?"
- UC6: "Explain this to me like I'm not a finance person" (follow-up chat)
- UC7: "What's my parents' cost of being in regular plans?" (family)

---

# PRD

## 9. Features In (MoSCoW)
| ID | Feature | Priority | Notes |
|---|---|---|---|
| F1 | Sign-up (email OTP / Google), onboarding, consent, AI-use disclosure | Must | Consent is per purpose (DPDP) |
| F2 | CAS upload + parse: detailed CAS from CAMS or KFintech, password used in memory only | Must | Show "how to get your CAS" guide (MFCentral / CAMS / KFintech) |
| F3 | Parse validation: reconcile parsed holdings against the CAS valuation totals; flag mismatches | Must | Wrong parses never reach the UI |
| F4 | X-ray engine (deterministic): value, invested, XIRR (portfolio and per scheme), asset allocation, market-cap split, look-through top stocks and sectors, fund overlap matrix, expense drag ₹/yr, regular-vs-direct cost gap, benchmark comparison, tiny/dormant folios | Must | Every metric stores formula + inputs |
| F5 | Insights feed: rules engine ranks findings by severity and ₹ impact; LLM writes a 2–3 sentence explanation per insight from fact IDs only | Must | "Show the math" on every card |
| F6 | **Ask your CFO**: grounded chat over the user's computed facts + a curated knowledge base (SEBI/AMFI investor-education content), with the advice guardrail | Must | Cites fact IDs and sources |
| F7 | Answer feedback (👍/👎 + reason) feeding the eval pipeline | Must | |
| F8 | Data controls: delete everything, export my data | Must | DPDP |
| F9 | Refresh and diff: re-upload → "what changed" + detected actions (e.g. a regular plan exited and the direct plan bought) | Should | Powers the North Star |
| F10 | Family view: multiple CAS per account, tagged by member, with consent attestation | Should | |
| F11 | Risk questionnaire (stored; shown as "your stated vs actual equity share", which is diagnosis) | Should | Reused for RIA suitability later |
| F12 | "Account Aggregator — coming soon" CTA + waitlist | Should | Demand signal (D-005) |
| F13 | Hindi explanations toggle | Could | Phase 1.5 experiment (D-OPEN-1) |
| F14 | Shareable, anonymised "portfolio report card" image | Could | Growth loop |

## 10. Features Out
- Any personalised recommendation (fund, amount, timing) → Phase 3 behind RIA
- Transactions, order placement, distribution → never (D-007)
- Demat equity analysis, EPF, NPS, FDs → later phases (the NSDL/CDSL CAS *is* accepted for MF holdings and monthly refresh; D-013)
- Account Aggregator → waitlist only
- Voice, native mobile apps → Phase 1.5+ / later
- Tax harvesting → Phase 4

## 11. User Stories & Acceptance Criteria
**US1 — Upload CAS (F2, F3)**
As Rohan, I want to upload my CAS PDF and see my portfolio, so that I don't have to type anything.
- AC1: Accepts PDF ≤ 10 MB; asks for the CAS password; the password is never persisted or logged (verified by log review + test).
- AC2: Parses CAMS and KFintech *detailed* CAS; a *summary* CAS shows a specific message on how to download the detailed one.
- AC3: Reconciliation: Σ parsed scheme valuations = the CAS's stated total (to the rupee) for 100% of golden-set files; on mismatch, show an error, not data.
- AC4: p95 parse time < 15 s for a 10-scheme CAS.
- AC5: Original PDF deleted after a successful parse unless "keep my statement" is ticked.

**US2 — See my x-ray (F4)**
As Rohan, I want to see my true asset mix, overlap and costs, so that I know what I actually own.
- AC1: XIRR matches a reference implementation (spreadsheet XIRR) within 0.01 percentage points on the golden set.
- AC2: Overlap uses the latest available monthly portfolio disclosure and shows its "as of" date.
- AC3: Expense drag = Σ(value × TER) per year, shown in ₹ with the TER date.
- AC4: Every number has a "how we calculated this" view listing the formula and inputs.

**US3 — Understand insights (F5)**
As Rohan, I want the 3–5 most important findings in plain language, so that I know what matters.
- AC1: Insights ranked by a documented severity × ₹-impact score.
- AC2: Each LLM explanation references only fact IDs supplied to it; numeric fidelity = 100% on the golden set (AI_EVALS).
- AC3: Zero advice-boundary violations on the red-team set.
- AC4: Readability target: grade ≤ 8 (automated check).

**US4 — Ask follow-ups (F6)**
As Rohan, I want to ask "why is fund X bad?" and get an answer about *my* fund.
- AC1: The answer cites the facts or sources used; if facts are missing, it says "I don't have that data" rather than guessing.
- AC2: Recommendation-seeking questions ("should I sell X?") get a compliant response: the facts relevant to the decision, the questions to ask, and a note that personalised advice needs a registered adviser.
- AC3: p95 time-to-first-token < 3 s.

**US5 — Delete my data (F8)**
- AC1: One tap → confirmation → all user rows, files and vector entries hard-deleted; audit log keeps only a deletion event with a hashed user ID.

**US6 — What changed (F9)**
- AC1: The diff identifies scheme-level unit changes between two CAS files; matching rules detect "switch regular → direct", "exited overlapping fund" and "consolidated folios".
- AC2: A detected action prompts the user to confirm "Did our insight prompt this?" (attribution).

## 12. Design Link (Figma)
`TBD — PCFO Phase 1` (screens: landing, CAS guide, upload, parsing, x-ray, insight card, show-the-math sheet, chat, settings/data). Low-fi wireframes first, in sprint 1.

## 13. Technical Considerations
Full detail: tech/ARCHITECTURE.md, tech/DATA_MODEL.md, tech/AI_EVALS.md.
- CAS parsing in Python; evaluate the open-source `casparser` library (check licence) vs a commercial API; golden set of ≥ 20 real CAS files (own + family + volunteers, with consent, redacted).
- Fund reference data: AMFI daily NAV, scheme master, TER; AMFI monthly portfolio disclosures for holdings (D-OPEN-3).
- LLM: Claude API. The deterministic engine produces a **fact sheet** (IDs, values, units, as-of dates); the LLM gets the fact sheet only, no PII.
- Guardrails: input classifier (advice-seeking intent), output checker (numbers must match facts; recommendation-pattern detector).
- Observability: every LLM call logged with prompt version, fact-sheet hash, latency, tokens and cost (PII-free).

## 14. Success Metrics
- **North Star:** Monthly Verified Actions: count of insight-linked portfolio changes detected by CAS diff and confirmed by the user, per month.
- **KPIs:** upload completion rate · time to first insight · insight "show the math" open rate · chat questions per active user · 30-day re-upload rate · 👍 rate on AI answers.
- **Guardrails:** numeric fidelity (100%) · advice-boundary violations (0) · parse error rate · deletion SLA met · LLM cost per active user.
- Pilot targets: set after the first 20 users (baseline), not guessed. Detail: 05-metrics-framework.md.

## 15. GTM Approach
Closed pilot: friends, family, ex-colleagues and finance communities. Concierge onboarding for the first 20. Detail: 06-gtm-cold-start.md.

## 16. Open Issues
| # | Issue | Owner | Status |
|---|---|---|---|
| OI-1 | Is "regular costs ₹X more than direct" advice? (L-1) | Legal | Open |
| OI-2 | Holdings data source quality (D-OPEN-3) | Eng | Spike S0 |
| OI-3 | Benchmark mapping per scheme (source: SID/factsheet; manual mapping for the top N schemes?) | Eng | Open |
| OI-4 | Family view consent: can Priya upload her parents' CAS? Needs attestation + DPDP review | Legal | Open |
| OI-5 | Hindi toggle in scope? (D-OPEN-1) | PM | Open |

## 17. Q&A
- **Why not just use ChatGPT with my CAS?** It can't reliably compute XIRR or overlap from fund holdings it doesn't have, it forgets you next month, and it can't show its math. We can.
- **Why no recommendations?** Personalised advice requires SEBI registration. We'll add it once licensed; until then, we tell you exactly what's true.
- **Do you sell funds?** No, and if we become an RIA, we legally can't take commissions from advised clients.

## 18. Feature Timeline & Phasing
| Sprint (1 wk) | Scope | Exit criteria |
|---|---|---|
| S0 Spikes | CAS parser eval on golden set · AMFI holdings ingestion · eval harness skeleton · Figma wireframes | Parser picked; holdings for top 200 schemes loaded |
| S1 | F1, F2, F3, F8 | US1 + US5 ACs pass |
| S2 | F4 x-ray engine + show-the-math | US2 ACs pass |
| S3 | F5 insights + LLM explanations + evals v1 | US3 ACs; eval gates green |
| S4 | F6 chat + guardrails + F7 feedback | US4 ACs; red-team pass |
| S5 | F9, F11, F12 + pilot hardening | Pilot launch checklist done |
