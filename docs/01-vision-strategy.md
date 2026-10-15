# 01 · Vision & Strategy

**Status:** Draft v0.1 · **Owner:** Shivam Singh · **Last updated:** 2026-10-03

## 1. One line
A personal CFO for Indian investors: it reads your real financial data, tells you what's wrong in plain language, and (once licensed) tells you what to do about it, with no commission riding on the answer.

## 2. Problem
Indian mutual fund investors who manage their own money through apps have access to cheap direct plans and many apps. What they lack is **judgement about their own portfolio**:

- **Accidental complexity.** Portfolios accrete funds over the years (an NFO here, a friend's tip there). The investor can't see that five funds hold the same top 10 stocks.
- **Invisible costs.** Regular-plan commissions, overlapping expense ratios and exit loads aren't shown as rupees per year.
- **No feedback loop.** Apps show returns, not whether the portfolio still matches the person's goals and risk.
- **Advice is either conflicted or expensive.** Free advice usually comes from distributors paid on commission. Fee-only SEBI RIAs are few. A Dec 2024 report cited ~995 registered after 11+ years (Upstox, Dec 2024; verify the current count on SEBI's site).

> **Assumption to validate:** DIY investors *want* this judgement, and will act on it. This is the riskiest assumption in the plan; see §7.

## 3. Who it's for (Phase 1)
Segments and personas are defined in [11-segments-personas.md](11-segments-personas.md) (D-015).

**Primary: the time-poor engaged investor (returning).** Wants to be involved in their money but has no time to research. Salaried, 25–40, metro/tier-1, 4–15 funds, SIPs running.
- Job to be done: *"Tell me if my portfolio is actually fine, in a way I understand, without selling me something."*

**Secondary: the distributor-led investor (returning), reached through a family proxy.** Often a parent in regular plans bought through a bank RM; the adult child uses the app on their behalf.

**Early adopters, not the design target:** DIY investors.
**Parked:** first-time self-employed savers (Phase 1.5–3). **Out:** traders, HNIs with PMS/AIF-heavy portfolios.

### Market context (verified figures, cite when used)
- 6.09 crore unique MF investors, end Feb 2026 (Angel One, citing AMFI data, 24 Mar 2026)
- The direct-plan share of *retail* AUM rose from 21.4% (Mar 2021) to 36.7% (Mar 2026) (Business Standard, citing AMFI–CRISIL, 6 Sep 2026)

We do **not** yet have a sourced estimate of how many investors are "DIY", so no TAM is claimed. Sizing is task T-1 in the roadmap.

## 4. Why now
*Full, sourced version with the Dec 2024 IA amendments, AI-use rules, the PMS 2026 mutual-fund-only route and the finfluencer crackdown: [docs/20](20-why-now.md).*
1. **Self-directed investing is growing.** The shift to direct plans (above) means a growing base without an adviser in the loop.
2. **LLMs can now explain** specific numbers in plain language at near-zero marginal cost. Before 2023, personalised explanation needed a human.
3. **Regulation made fee-only advice more feasible.** SEBI's Dec 2024 IA amendments dropped the experience requirement, replaced net worth with a deposit and allowed part-time advisers.
4. **Data rails are maturing.** CAS covers all MF holdings today; Account Aggregator covers MF and demat for regulated FIUs.

## 5. Strategy
**Where we play:** the decision layer on top of holdings data, not execution. We don't sell funds and we don't place orders.

**How we win (hypotheses):**
1. **Explanation over dashboards.** Competitors show the same overlap charts. We answer "so what?" in two sentences, then let you ask follow-ups.
2. **Trust as a product feature.** Every number links to its calculation, and the LLM never invents figures (D-009). We sell no products and show that openly.
3. **Measured AI quality.** A public eval scorecard (numeric fidelity, groundedness, advice-boundary compliance). Few consumer fintech products publish this.
4. **Compounding data.** Every CAS refresh is a before/after, so we can measure whether users actually improved their portfolio. That's the basis of the North Star (see metrics doc).

**What we're explicitly not doing:**
- Distribution or commission revenue (conflicts with the RIA path)
- Stock picking or market timing
- Building a trading app

## 6. Phased roadmap (summary; detail in 07-roadmap.md)
| Phase | Module | Regulatory status | Core question answered |
|---|---|---|---|
| 1 | Portfolio x-ray + AI explanations | Diagnosis, no advice | "What's actually in my portfolio, and what's wrong with it?" |
| 2 | Savings insights (bank/card statements) | Information only | "Where does my money go, and how much could I invest?" |
| 3 | Goal-based planning | **Advice** (financial planning), gated on RIA | "Am I on track for X, and what should I change?" |
| 4 | Tax-aware investing | **Advice** where personalised, gated on RIA | "How do I lower tax on gains legally?" |

## 7. Riskiest assumptions → how we'll test them
| # | Assumption | Test | Pass signal (set before testing) |
|---|---|---|---|
| A1 | DIY investors will upload a CAS (a PII-heavy PDF) to a new product | Landing page + concierge pilot | Upload completion target set in metrics doc |
| A2 | Explanations change behaviour, not just curiosity | CAS diff on the next refresh | ≥1 verified action among pilot users |
| A3 | Users return without a transaction hook | Monthly refresh prompt | 30-day re-upload rate |
| A4 | "Diagnosis without advice" is useful enough before licensing | Interviews + qualitative feedback | Users cite a specific insight they acted on |
| A5 | We can keep LLM output numerically correct | Offline evals on golden set | Numeric fidelity = 100% on golden set before launch |

## 8. Success for this project
- **As a product:** a pilot of real users with measured, verified portfolio improvements
- **As a portfolio piece:** a public repo plus a live demo that shows product judgement (this doc set), AI craft (grounded generation, evals, guardrails) and regulatory literacy
