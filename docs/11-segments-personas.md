# 11 · Segments & Personas

**Status:** v0.1 · **Last updated:** 2026-10-03 · **Decision:** D-015 (supersedes D-003)
Personas are **proto-personas**: hypotheses built from secondary research (docs/08) and founder knowledge. Quotes are illustrative, not research data. Every persona gets confirmed, edited or killed by the T-3 interviews.

## 1. Segmentation model
Two behavioural axes, plus a lifecycle split.
- **Involvement:** does the person *want* to be involved in investment decisions?
- **Bandwidth:** do they have the *time and capability* to do it themselves?
- **Lifecycle:** **new** (no investments yet) vs **returning** (already holds mutual funds)

| | **Wants to be involved** | **Doesn't want to be involved** |
|---|---|---|
| **Has time / capability** | **A · DIY investor** | (rare) |
| **No time** | **B · Time-poor engaged investor** | **C · Delegator**, split by wealth: **C1** distributor-led (small–mid portfolios) · **C2** HNI with a relationship manager (PMS/AIF) |

Founder's original model (DIY / Assisted / Newbie-no-time / Newbie-has-time) maps to A / B / C2 / C1. Two corrections: the newbie split is driven by **wealth, not time**, and "salaried" is a demographic shared by A and B, not a segment.

## 2. Segment evaluation (Phase 1 = diagnose an existing portfolio from a CAS)
| Segment | Has a CAS? | Core pain (docs/08) | Uploads a CAS? | Phase 1 value | Business path | Verdict |
|---|---|---|---|---|---|---|
| A · DIY, returning | ✅ | Overlap, own return vs funds' return (P2, P6); confident, so mild | ✅ easily | Good | Low WTP; free tools exist | **Pilot early adopters**, not the design target |
| **B · Time-poor engaged, returning** | ✅ | "Am I OK?" with no time to check (P1, P2); wants a verdict | ✅ if < 3 min | Partial: wants advice | **Highest: natural RIA client** | **PRIMARY** |
| **C1 · Distributor-led, returning** | ✅ | Regular-plan cost, doesn't know what they own (P5, P1) | ❌ alone; ✅ via a family member | High, through a proxy | Medium, via the proxy | **SECONDARY (via proxy)** |
| C2 · HNI with RM | Partly (PMS/AIF mostly outside the MF CAS) | Served by RM | — | Low | Not our model | **Out of scope** |
| Any segment, **new** | ❌ nothing to upload | First investment, trust (P1) | n/a | None in Phase 1 | Phase 2–3 | **Parked** (persona 3) |

**Why B over A as primary:** the job-to-be-done is *"tell me if my portfolio is fine, without selling me anything"*. A can mostly answer it alone; B can't, and is the segment that will pay once advice is licensed. HSBC/Ipsos (June 2026): 51% of affluent Indian investors want an AI + human hybrid, and human professionals still most influence final decisions (31% vs 15% for AI).
**Main risk:** B wants advice and Phase 1 can only diagnose. If interviews show diagnosis alone doesn't satisfy B, accelerate the RIA route (D-OPEN-2).

## 3. Persona 1 (primary): Rohan, the time-poor engaged investor
| | |
|---|---|
| **Segment** | B · returning |
| **Snapshot (illustrative)** | 31, product engineer, Bangalore. Married, first child on the way. ₹18L across 9 mutual funds on Groww and Zerodha Coin, 4 SIPs. Started in 2020; picked funds from Reddit threads, a colleague's tip and one NFO |
| **Involvement / bandwidth** | Cares about money and reads the odd finance thread, but 60-hour weeks leave no time to research |
| **Job to be done** | "Every few months, tell me in 3 minutes whether my portfolio is fine, and if not, what's wrong and why." |
| **Goals** | Feel in control without spending weekends on it; build a corpus for a house and his child's education |
| **Pains** | Doesn't know if 9 funds is too many (P6); app shows returns but not whether *he* did well vs his funds (P2); unsure whether to stop SIPs when markets fall (P2); free advice feels like a sales pitch (P4) |
| **Today's alternatives** | Ignores it; asks a friend; pastes a screenshot into ChatGPT; considered a paid adviser but balked at the fee |
| **Triggers to try us** | Market fall; life event (baby, house); a colleague's shared report card; tax season |
| **Barriers** | Uploading a statement with PAN to an unknown app; "another dashboard I won't open" |
| **What wins him** | Time to first insight < 3 min; numbers he can verify; no selling; one clear headline |
| **Device** | Phone first (Android or iPhone ⚠ check in interviews); laptop for deep dives |
| **What success looks like** | Acts on ≥ 1 insight (verified via the next CAS); comes back monthly |
| **Illustrative quote** | "I don't need another chart. Just tell me straight: am I doing okay or not?" |
| **Phase 1 limit** | Gets diagnosis, not "sell X". The advice-seeking chat path (J6) must still feel useful |

## 4. Persona 2 (secondary): Priya, the family proxy for a distributor-led investor
C1 users rarely come on their own, so this persona is a **pair**: the person who uses the app and the person whose money it is.

| | **User: Priya (proxy)** | **Beneficiary: her father, Mr Sharma** |
|---|---|---|
| **Segment** | Usually B herself | **C1 · returning** |
| **Snapshot (illustrative)** | 35, marketing manager, Pune; handles her parents' paperwork | 63, retired PSU officer, Lucknow. ₹40L across 14 schemes, mostly **regular plans** sold by his bank's relationship manager over 12 years, plus FDs |
| **Job to be done** | "Show me what Papa actually owns, what it's costing him, and whether he's been sold junk, so I can have the conversation with him." | "Make sure my retirement money is safe and I'm not being cheated." |
| **Pains** | Statements scattered; can't tell good funds from bad; awkward to question the bank RM | Doesn't know what he owns (P1); paying regular-plan commissions (P5); trusts the RM, distrusts apps |
| **Today's alternatives** | Spreadsheets, a cousin "in finance", or nothing | The bank RM |
| **Barriers** | Consent: is uploading Papa's statement okay? (OI-4); his trust in the RM | Won't use an app himself |
| **What wins them** | Rupee cost of regular plans per year; one family view; a clear, printable summary she can talk through with him | Hearing it from his daughter, not from an app |
| **Illustrative quote** | "I'm not trying to manage his money. I just want to know if the bank is taking him for a ride." |
| **Phase 1 limit** | We show the cost gap; we don't say "switch to direct" (L-1 to confirm wording) |

## 5. Persona 3 (parked): Ramesh, the first-time self-employed saver
**Not designed for in Phase 1.** Documented so the roadmap (Phase 1.5 voice/Hindi, Phase 2 savings, Phase 3 goals) has a target, and because this is the segment Bachatt (Saathi) and Jar serve.

| | |
|---|---|
| **Segment** | C1 · **new** (no mutual funds yet) |
| **Snapshot (illustrative)** | 42, kirana store owner, Indore. Daily UPI income, irregular cash flow. Savings in FDs, a post-office scheme, gold and an LIC policy. Uses WhatsApp and YouTube in Hindi |
| **Job to be done** | "Help me save a little every day in something better than the bank, without being cheated, in my language." |
| **Pains** | Complexity and trust (SEBI 2025 survey: complexity 74%, trust 51% as barriers for non-investors); irregular income makes monthly SIPs awkward; prefers Hindi (94% of respondents prefer Hindi or regional languages, per the same survey) |
| **What would serve him** | Voice-first, Hindi explanations; daily or variable small amounts; first-investment guidance (advice, so RIA or distributor needed) |
| **Why parked** | Nothing to analyse yet (no CAS); needs transactions and advice; crowded by funded players (Bachatt, Jar) |
| **Where he shows up in our plan** | Phase 1.5: Hindi + voice "explain my money" demo; Phase 2: savings insights from bank statements; Phase 3: goal planning under RIA |

## 6. Implications for the docs and the build
- **Copy and tone:** design for *time-poor and wants a verdict*: headline first, 3 insights max, every number checkable
- **Family view (F10)** moves from "Should" to core of the secondary persona; printable/shareable family summary added to the J8 journey
- **Interviews (T-3), recruit mix:** 6 × B (time-poor engaged), 3 × proxies of C1 investors, 1–2 × A (DIY, as control). Optional: 2 × persona 3 for the Phase 1.5 demo
- **Screener:** "Do you hold mutual funds?" (must be yes, except persona 3) · "How many hours a month do you spend on your investments?" (B: < 2; A: > 5) · "Who chose your funds?"
- **Pilot recruiting:** DIY users are fine as early adopters, but metrics are reported **per segment**, so A's enthusiasm doesn't mask B's needs
