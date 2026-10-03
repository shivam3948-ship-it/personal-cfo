# 03 · Regulatory & Compliance

**Status:** Draft v0.1 · **Last updated:** 2026-10-03
> ⚠ **Not legal advice.** This is a product team's working reading of public sources. Every rule here must be confirmed by a securities lawyer before launch (task L-1). Regulations change; each item carries its source date.

## 1. Bottom line
1. **Phase 1 is designed to stay outside "investment advice":** facts and diagnosis about the user's own holdings, with no buy/sell/switch recommendation for a specific security.
2. **Phases 3 and 4 (goal planning, personalised tax moves) are almost certainly advice.** Our reading is that the IA Regulations define investment advice to include financial planning; **confirm with counsel**. They ship only once an RIA licence (own or partner) exists.
3. **We build the RIA plumbing from day one** (risk profile, suitability, consent, AI-use disclosure, audit log), so going live with advice is a flag flip (D-006).
4. **DPDP compliance is designed in, not bolted on.** Full obligations bite on **13 May 2027**, before any likely scale.

## 2. SEBI Investment Adviser (IA) regime — what matters to us
| Topic | Rule (as reported) | Source | Product impact |
|---|---|---|---|
| Eligibility | Graduate degree in any discipline plus NISM certification; experience requirement removed | Upstox, 17 Dec 2024; SEBI IA (Second Amendment) Regs 2024 | Shivam (IIT Kanpur, B.S. Econ) likely qualifies. ⚠ Confirm which NISM exam applies now (sources conflict: X-A + X-B vs X-C). |
| Deposit (replaced net worth) | ₹1L (≤150 clients), ₹2L (151–300), ₹5L (301–1,000), ₹10L (1,001+) | SEBI IA FAQ, Aug 2025 | Low capital barrier |
| Individual vs company | Individual IA must convert to non-individual above 300 clients or ₹3 cr fees | SEBI IA FAQ, Aug 2025 | A consumer app at scale needs a non-individual RIA (company) or a partner |
| Part-time IA | Allowed; must say "part-time investment adviser" in all client communication; cap of 75 clients reported | SEBI FAQ Aug 2025; Upstox Dec 2024 | Too small for an app; useful only for a closed pilot. ⚠ Employment conditions unclear; the 2024 consultation proposed barring employment involving advice or products |
| **AI tools** | IAs using AI must disclose "the extent of use of AI tools" to clients, and are solely responsible for client data security and confidentiality and for compliance of the output | SEBI IA (Second Amendment) Regs, Dec 2024, via Upstox / Taxmann | Build an AI-use disclosure screen + per-answer AI label now |
| Risk profiling | Advice only after a risk profile is completed and consent obtained | SEBI IA FAQ, Aug 2025 | `risk_profiles` table + flow built in Phase 1, used in Phase 3 |
| Advice vs distribution | Same client can't get both advice and distribution within the group | SEBI IA FAQ, Aug 2025 | No commissions if we advise (D-007) |
| Fees | ₹1.51L per family per year (fixed mode) or 2.5% of AUA; advance max 2 quarters | Cafemutual, 18 Feb 2025 | Upper bound for pricing if RIA |

## 2a. Advice modes (D-016)
Advice is built now but shown only in `internal` (founder + consenting family, no fee) and `demo` (synthetic portfolios) modes; pilot users stay in `diagnosis`. The IA definition turns on **consideration, being in the business, and holding out**; Regulation 4 has no relatives exemption. Full reasoning and guardrails: [12-advice-engine.md](12-advice-engine.md). Task **L-8**: counsel to confirm both modes and any public wording.

## 3. The advice boundary (`diagnosis` mode, enforced in code)
The LLM guardrail, the copy and the test suite all use this table.

| ✅ Allowed (diagnosis / education) | ⛔ Gated until licensed (advice) |
|---|---|
| "Funds A and B share 62% of holdings." | "Sell fund B." |
| "You pay ₹X/yr more in regular plans than the direct versions would cost." | "Switch to the direct plan of fund A." (names the action on a specific security) ⚠ L-1: confirm whether this specific statement is advice |
| "Your equity share is 85%; the age-based rules of thumb people quote are ..." (education, cited) | "You should be at 60% equity." |
| "This fund lagged its benchmark over 3 and 5 years." | "Replace it with fund C." |
| Explaining what LTCG is | "Book ₹1.25L of gains before 31 March." |
| Generic: "Many investors review overlapping funds; here are the questions to ask." | Any personalised fund, amount or timing recommendation |

**Implementation:** (1) the system prompt and policy, (2) an output classifier that rewrites or blocks recommendation-shaped answers, (3) a red-team eval set (see tech/AI_EVALS.md) that must pass before every release, (4) a standing disclaimer *plus* the AI-use disclosure.

## 4. Data protection — DPDP Act 2023 + Rules 2025
| Milestone | Date | Source |
|---|---|---|
| Rules notified; Data Protection Board established | 13 Nov 2025 | PIB; Sansa Legal |
| Consent manager framework effective | 13 Nov 2026 | Sansa Legal |
| Substantive fiduciary obligations (consent, notice, security safeguards, breach notification, erasure) | 13 May 2027 | Sansa Legal |

**Design commitments (from day one):**
- Purpose-specific consent at upload; separate consent for using data to improve the product
- **The CAS PDF and its password never leave the user's device** (parsed in the browser, ADR-010); the server receives only pseudonymised holdings. A failed file is sent only with separate, explicit consent and auto-deleted after the fix
- Data minimisation: store PAN only as a salted hash plus the last 4 characters; names are encrypted
- "Delete my data" in-product: hard delete within an SLA we publish
- Breach runbook (⚠ confirm notification timelines in the Rules text)
- **LLM calls carry no PII** (D-009); review the model provider's data-retention terms (L-3)

## 5. Account Aggregator (for "coming soon")
- **No direct MF Central route:** AMFI directed MF Central to stop sharing investor data directly with fintech apps; third parties must get it from the investor or, if RIA/PMS-licensed, through Account Aggregator (Angel One, Sep 2025; ⚠ verify the circular). So AA is the long-term ingestion path, and it depends on the RIA licence (D-018).
- An FIU must be regulated by RBI, SEBI, IRDAI or PFRDA, and since Oct 2023 must also join as an FIP if it holds financial information (casparser.in, 2026; ⚠ verify against the RBI Master Direction).
- MF data (CAMS, KFin) and demat data (CDSL, NSDL) are available via AA; the article reports demat transaction history is capped at 2 years.
- **Path for us:** partner with a regulated FIU, or become one after RIA registration. Estimated first-year cost of ₹5–25L (same source; unverified).

## 6. AI-specific regulation to watch
- SEBI's **Consultation Paper on responsible AI/ML use** (20 Jun 2025): governance, human oversight, testing, explainability, data privacy. It was a consultation as of the July 2025 sources reviewed. ⚠ Check whether final guidelines have since been issued (L-2).
- SEBI's cloud services framework for regulated entities may impose data-localisation requirements once we're an RIA. ⚠ L-4.

## 7. Compliance task list
| ID | Task | Phase |
|---|---|---|
| L-1 | Lawyer review of the advice-boundary table and Phase 1 copy | Before pilot |
| L-2 | Check the status of SEBI AI/ML guidelines | Before pilot |
| L-3 | Review model-provider data terms (retention, training, region) | Before pilot |
| L-4 | Data localisation requirements for an RIA | Before Phase 3 |
| L-5 | Choose the RIA route (D-OPEN-2) | Before Phase 3 |
| L-6 | Privacy notice and consent text per the DPDP Rules | Before pilot |
| L-7 | Terms of use: "not investment advice" and AI-use disclosure | Before pilot |
| L-8 | Confirm `internal` (family, no fee) and `demo` (synthetic data) advice modes are outside the IA definition; review public wording for "holding out" | Before showing the demo publicly |

## Sources
- SEBI IA FAQs (Aug 2025): https://www.sebi.gov.in/sebi_data/faqfiles/aug-2025/1755174193178.pdf
- Upstox on the Dec 2024 IA amendments: https://upstox.com/news/business-news/financial-regulations/sebi-allows-part-time-investment-advisers-puts-conditions-for-ai-use-all-you-need-to-know/article-135636/
- Cafemutual on IA fee limits / MITC (Feb 2025): https://cafemutual.com/news/industry/34228-sebi-releases-most-important-terms-and-conditions-for-investment-advisors
- DPDP timeline: https://www.sansalegal.com/post/dpdp-act-2023-and-rules-2025-phased-implementation-timeline-and-business-compliance-deadlines
- AA state in 2026: https://casparser.in/blog/state-of-account-aggregator-2026/
- SEBI AI/ML consultation analysis: https://indiacorplaw.in/2025/07/16/from-algorithms-to-accountability-analysing-sebis-ai-ml-governance-framework/
