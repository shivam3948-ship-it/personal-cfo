# 13 · Problem Depth: 5 whys, current behaviour, behaviour change, and the Groww lesson

**Status:** v0.1 · **Last updated:** 2026-10-05
Figures are sourced; judgements are labelled as ours. Pain magnitude per person is **unknown until we run real CAS files** (golden set, MVP).

## 1. Five whys
**Problem statement:** time-poor engaged investors (Rohan) don't know if their portfolio is fine, and on average investors earn less than the funds they hold.

| Why | Answer | Evidence |
|---|---|---|
| 1. Why do investors earn less than their funds? | They buy after rallies, sell or stop SIPs in falls, and pile up overlapping funds | Axis MF study 2003–22 (docs/08 P2); SIP stoppage 75.6% of new SIPs, Feb 2026 (computed, docs/08) |
| 2. Why do they act that way? | Decisions are triggered by noise (tips, finfluencers, headlines), not by the state of *their* portfolio | SEBI survey 2025: 62% of investors act on finfluencer recommendations (docs/08 P3) |
| 3. Why don't they use their portfolio's state? | They can't see it: apps show per-fund returns, not overlap, own-vs-fund return, risk drift or rupee costs | Product audit (docs/02); our first real CAS needed code to reconcile and has no portfolio total |
| 4. Why don't platforms show it? | Platforms earn on activity and distribution, not on better portfolios; independent advice is scarce | A third-party report citing Groww's Q4 FY26 shareholder letter puts ~55% of revenue in equity derivatives (⚠ verify against the letter); 1,050 RIAs for ~6 crore investors (docs/08 P4) |
| 5. Why is unbiased judgement scarce? | Regulation separates advice from distribution, and fee-only advice is a human service that doesn't scale down to a ₹15–30 L portfolio | IA Regulations: advice vs distribution segregation; fee caps (docs/03) |

**Root cause:** there is no affordable, unconflicted *judgement layer* between the investor and their own data. **Our bet:** software (deterministic facts + AI explanation) and, later, a licence make that judgement cheap enough for a mid-size portfolio.

## 2. What users do now (today's alternatives)
| Alternative | Who | Why it falls short |
|---|---|---|
| **Nothing**: open the app, glance at total returns, close it | Most common (our judgement) | Returns don't reveal overlap, drift or the behaviour gap |
| Tips: friends, Reddit, finfluencers | Rohan | Generic, not about *their* holdings; conflicted |
| Paste a screenshot or CAS into ChatGPT | Growing (HSBC/Ipsos: 86% of affluent Indian investors use AI for finance) | No fund holdings data, unverified numbers, no memory month to month |
| Bank RM / distributor | Priya's father | Paid on what they sell (regular plans) |
| Fee-only RIA | Rare | ₹ cost and scarcity |
| Spreadsheets | DIY minority | Time Rohan doesn't have |

## 3. How big is the pain? (honest read)
- **Mostly chronic and low-intensity, with spikes.** Day to day it's a vitamin; it turns into a painkiller at **moments**: a market fall, a bonus or lump sum, tax season (Jan–Mar), a life event (child, house), or a parent's maturity or retirement.
- **The cost is real but invisible:** SEBI's illustration of a 1 pp fee gap is ₹21,724 on ₹1 L over 10 years (8.8% of the corpus; computed, docs/08). For Priya's father, sample figures give ₹35,450 a year.
- **Unknown:** the size of the behaviour gap and overlap for *real* users. The MVP will measure it from CAS files; that number is itself a launch story.

## 4. The behaviour change we need, and how we get it
**From:** ignore it, or react to noise → **To:** a 3-minute check-up when a statement lands or a moment hits, then act on one verified insight.

Forces of switching (our assessment):
| Force | For Rohan | Our design response |
|---|---|---|
| **Push** (dissatisfaction) | Low-grade anxiety, "am I doing it right?" | Lead with one verdict line, not a dashboard |
| **Pull** (new solution) | A straight answer in 3 minutes, without selling | Own-vs-fund return headline; show the math |
| **Anxiety** (about switching) | Sharing a PAN-bearing PDF; "is this a sales funnel?" | Parse on device (D-017); no product sales (D-007) |
| **Habit** (inertia) | Not looking at all | **Design for moments, not daily use:** the monthly CAS email, market-fall prompts, tax season |

Behaviour levers (prompt × ability × motivation):
- **Prompt:** time nudges to events the user already gets (the monthly depository CAS by the 10th; AMFI) and to market falls
- **Ability:** one upload, 3 minutes, one action at a time; Account Aggregator later removes the PDF entirely
- **Motivation:** rupee framing ("₹X a year"), loss aversion ("your money earned 0.8 pp less than your funds"), and proof (show the math)

**Probability of change, our judgement (not a statistic):**
- **Low** for a habit with no prompt. Most finance apps lose infrequent users.
- **Moderate** at moments, when anxiety is high and the insight is personal and in rupees.
- **Highest** for one-off, high-value actions: consolidating overlap, regular→direct for a parent, tax-timed switches.

How we'll know: Monthly Verified Actions and 30-day re-upload (docs/05), with pre-committed pilot targets of ≥ 10% insight → verified action and ≥ 30% re-upload. These are hypotheses until the MVP data is in.

## 5. How Groww came to serve many personas
| When | Move | Source |
|---|---|---|
| 2016 | Four ex-Flipkart founders start with a **robo-advisory** app; it **struggled to find product-market fit** | Contrary Research |
| May 2017 | Pivot to a **zero-commission direct mutual fund** platform (web); aimed for 100 users, got 600 | Contrary Research |
| Dec 2017 | App launch; then stocks, F&O, IPOs, US stocks | Contrary Research |
| 2021 | 60% of users from outside the top six cities | Contrary Research |
| 2023 | UPI, instant loans, acquired Indiabulls' AMC business; 40 M+ customers by Dec 2023 | Contrary Research |
| May 2025 | Bought **Fisdom** (wealth management for affluent clients, ~US$150 M) | Entrepreneur India |
| Nov 2025 | IPO | third-party report citing Groww filings (⚠ verify) |

**How they serve diverse users (our reading):**
1. **One wedge for one persona first:** a simple, free direct-MF product for first-time millennial investors. Breadth came *after* trust and scale.
2. **Expansion along the same user's journey:** saving → stocks → trading → credit → payments, sold to an existing base. "Monetization follows engagement", per management (Q2 FY26 call, via a third-party report; ⚠ verify).
3. **One simple default surface, with depth revealed progressively;** separate product areas per need rather than one screen for everyone.
4. **Buy what they couldn't build:** the assisted, affluent segment came via the Fisdom acquisition, not the core app.

**Lessons for us:**
- **Narrow first is how Groww did it too.** Our single primary persona is the right call.
- **Their *advice-first* start failed;** the *transaction* product won. That's a direct warning for us. Our mitigation: the wedge is a free, instant x-ray (concrete value without advice), with advice layered on later.
- Our next personas follow Rohan's own journey: savings (Phase 2) → goals (Phase 3) → tax (Phase 4), then the family proxy. Not traders.

## Sources
- [Contrary Research: Groww](https://research.contrary.com/company/groww)
- [Entrepreneur India: Groww to acquire Fisdom](https://india.entrepreneur.com/women-entrepreneur/groww-to-acquire-fisdom-in-usd-150-million-deal-ahead-of/491795)
- [Fintech Inside #80: Groww deep dive](https://fintechinside.substack.com/p/eighty)
- [Third-party initiation report citing Groww's shareholder letters (verify against primary filings)](https://zigercap.com/ai-experiments/Initiation%20Report%20Examples/GROWW_April2026.pdf)
- Other figures: see docs/08 sources

## 6. Problem brief (one page)

**True problem (not the symptom).** Symptoms: overlap, high fees, panic exits, too many funds. The underlying problem: **investors make money decisions without a trusted, personal, unconflicted judgement of their own portfolio, and never get feedback on whether those decisions helped.** No one closes the loop between "what I did" and "what it did to my money". The overlap or the fee is just where the missing loop shows up.

**Who faces it.** Users and payers differ:
| | Users | Likely payer (hypothesis) |
|---|---|---|
| Primary | Time-poor engaged investor (Rohan) | Himself: subscription now; RIA fee once licensed |
| Secondary | Family proxy (Priya) acting for a distributor-led parent | Priya, for the family plan |
| Later / B2B | — | RIAs and wealth platforms licensing the engine; employers as a benefit (untested) |

**How we know it's real.**
- *Strong (market level):* complexity is the top barrier (74% of non-investors); investor returns trail fund returns (Axis MF study); 62% act on finfluencer tips; ~58,000 investors per RIA; SIP stoppage at 75.6% of new SIPs (docs/08).
- *Revealed behaviour:* investors already improvise, pasting portfolios into ChatGPT (86% of affluent Indian investors use AI for finance, HSBC/Ipsos 2026), and funded players are building the same thing (Bachatt Saathi, Groww MCP). Demand exists; the trusted version doesn't.
- *Our own data:* the first real CAS needed code even to reconcile, and has no portfolio total. The x-ray isn't something users can do by eye.
- *Not yet proven:* that **Rohan** feels it enough to act. The MVP answers this with Verified Actions and re-upload rate (docs/05).

**Value created.**
- *For users:* rupees (fee drag, tax-timed moves, behaviour gap; e.g. Priya's sample father pays ₹35,450/yr more in regular plans), time (3 minutes vs a spreadsheet weekend), and confidence (a verdict they can check).
- *For the business:* (1) a subscription or RIA fee, capped at ₹1.51 L per family per year or 2.5% of AUA (docs/03); (2) a unique dataset of *verified outcomes* (what users did and what it did to their money), which no distribution app has; (3) a B2B engine for advisers, since 1,050 RIAs can't hand-analyse every client; (4) for Shivam, a live AI-PM portfolio piece. **We don't claim market size until T-1 sizing is done.**

**Why now.**
1. **AI can explain a specific portfolio** in plain language at near-zero marginal cost, and evals make it measurable.
2. **Regulation opened the door:** easier RIA registration (Dec 2024: graduate degree, no experience, a deposit instead of net worth) and explicit AI-use disclosure rules for advisers. There's a clear lane for licensed AI advice.
3. **Regulation closed the shortcut:** AMFI stopped MF Central sharing data with fintechs (Sep 2025); licensed Account Aggregator access now favours RIA-ready players like us.
4. **Privacy bar rising:** DPDP Rules (obligations from May 2027) reward on-device, minimal-data designs (D-017).
5. **Market timing:** retail direct-plan share rose from 21.4% to 36.7% (2021→2026). Millions are now self-directed without an adviser, and funded competitors are moving, so the window to be the *trusted* version is now.

## 7. What about first-time investors (Ramesh, and Bachatt's market)?
**Same root problem, earlier in the journey.** First-timers also lack a trusted, unconflicted judgement, but *before* the first decision rather than after it. With no portfolio, there's no feedback loop to close yet. Their job is "help me start safely", not "tell me if my portfolio is fine".

| | Returning investor (Rohan) | First-time investor (Ramesh) |
|---|---|---|
| Core question | "Is what I own fine?" | "Should I start, with what, how much, and can I trust it?" |
| Barriers | Time, visibility, conflicted advice | Complexity (74%), risk/return worry (73%), trust (51%); 80% of households prioritise capital preservation; 94% prefer Hindi or regional languages (SEBI survey 2025) |
| Data we can use | CAS | None yet: bank/UPI flows (Phase 2), stated goals |
| What helps | Diagnosis → advice | Education + a first *product* (low-risk, small-ticket, daily/variable amounts), in their language, by voice |
| Regulatory nature | Diagnosis is free; advice needs an RIA | Choosing a first fund is advice, *or* distribution |

**Size (derived from the SEBI survey, indicative):** 32.1 M investing households = 9.5% → ~338 M households in total, ~306 M not investing; 22% of non-investors intend to invest within a year → **~67 M households** (computed; survey-based, not a TAM).

**Why the business model differs:** first-timers start tiny (Bachatt from ₹100). A fee-only RIA model can't price that; distribution commissions can. That's why Bachatt is an AMFI-registered distributor, and why this segment conflicts with our no-commission stance (D-007).

**Our position:** keep Ramesh parked for Phase 1 (nothing to analyse; different economics). Reach him through Phase 1.5 (Hindi/voice "explain my money"), Phase 2 (investable surplus from bank statements) and Phase 3 goals under an RIA. Revisit D-007 if we ever want to serve him at scale.
