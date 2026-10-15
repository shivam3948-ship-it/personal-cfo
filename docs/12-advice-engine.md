# 12 · Advice Engine & Advice Modes

**Status:** v0.1 · **Last updated:** 2026-10-03 · **Decision:** D-016 (refines D-006)
> ⚠ Not legal advice. The mode design below is our working reading of the SEBI IA Regulations and must be confirmed by counsel (L-1, L-8).

## 1. Decision
Build the advice engine **now**, and run it in three modes enforced on the server:

| Mode | Who sees advice | Data | Purpose | Status |
|---|---|---|---|---|
| **`guided`** (D-021) | Invite-only pre-licence users, **no fee, no public sign-up or marketing** | Their real data | Show what to do next before the licence | **Default pre-licence.** Category-level recommendations with the disclaimer "not SEBI-registered investment advice"; no product picks. ⚠ L-8 extended to cover this mode |
| **`diagnosis`** | ~~Pilot users~~ Fallback if counsel rejects `guided` | Their real CAS | Diagnosis only | Superseded as default by D-021 |
| **`internal`** | Allow-listed accounts only: Shivam + consenting family members, **no fee** | Real CAS | Dogfood the advice quality on real portfolios before any licence | Allow-list in config, audit-logged |
| **`demo`** | Anyone with the demo link (recruiters, interviewers) | **Synthetic sample portfolios only**; uploads disabled | Show the advice prototype end to end | Watermarked "Prototype · sample data · not investment advice" |

**Licensed mode (later):** `advised`. Same engine, switched on per user once there's an RIA of record, a risk profile, a signed agreement and the AI-use disclosure (ADR-008).

## 2. Why this shape (regulatory reasoning)
- SEBI IA Regulations 2013, Reg 2(1)(m): an investment adviser is anyone who, **for consideration**, is **engaged in the business** of giving investment advice, *and includes anyone who **holds himself out** as an investment adviser*. Reg 2(1)(l): investment advice **includes financial planning**. (Source: regulation text via TaxTMI.)
- Regulation 4's exemptions don't include advising relatives. So `internal` mode rests on **no consideration, no business, no holding out**, not on an exemption. ⚠ L-8: confirm with counsel.
- `demo` mode avoids personalised advice to real people altogether: it runs on fictional portfolios with **anonymised fund labels** ("Flexi-cap Fund A (sample)"). A public page saying "sell [real fund name]" would read as a public securities recommendation.
- **Marketing guardrail:** until licensed, nothing public (site, posts, the repo README) may describe the product as giving investment advice. Say "advice prototype (demo, sample data)". "Holds out" is the trap.

## 3. What advice the engine gives (catalogue v1)
Scope rule: **restructure what the user already owns**; v1 doesn't pick *new* funds to buy (that needs a published fund-selection methodology and raises bias questions). New-fund selection is v2.

| ID | Recommendation | Inputs | Must account for |
|---|---|---|---|
| A1 | **Consolidate overlapping funds:** which to keep and which to exit, in what order | Overlap matrix, TER, category, rolling returns vs benchmark | Exit load, capital-gains tax, lot ages |
| A2 | **Regular → direct switch plan** (same scheme) | Plan pairs, TER gap, lots | Switch = redemption + purchase → tax and exit load; suggest timing (e.g., wait until lots turn long-term or exit-load-free) |
| A3 | **Rebalance to target asset mix** | Risk profile → target mix; actual mix | Prefer redirecting SIPs/new money before selling (tax-efficient) |
| A4 | **SIP continuity in a drawdown** | User's own SIP history; goal horizon | Behaviour advice; never market timing |
| A5 | **Goal SIP amount** (Phase 3 preview) | Goal, horizon, current corpus, return assumptions | Assumptions shown and editable |
| A6 | **Gains harvesting** (Phase 4 preview) | Lots, annual LTCG exemption | Tax rules as **dated config** with source, never hard-coded |

## 4. How a recommendation is produced
```
facts (engine) ──► candidate rules ──► suitability check ──► cost/tax/exit-load simulation ──► ranked recommendations
                                       (risk profile,         (₹ impact after costs,
                                        horizon, liquidity)    "do nothing" baseline)
                                                     │
                                                     ▼
                         LLM explains (facts + recommendation object only; no new numbers)
```
1. **Deterministic first.** Each recommendation is a typed object: `{id, type (A1–A6), actions[], rationale_fact_ids[], expected_impact_paise, costs_paise{tax, exit_load}, assumptions[], tradeoffs[], what_would_change_this[], suitability_check}`.
2. **Do-nothing baseline.** Every recommendation shows its net benefit *after* tax and exit load vs doing nothing. If the net benefit is ≤ 0, it isn't shown.
3. **Suitability gate.** No recommendation without a completed risk profile; anything that moves the mix outside the profile's band is blocked.
4. **LLM explains, never decides.** Same contract as D-009: it can only cite fact IDs and recommendation fields.
5. **Human review in `internal` mode.** Shivam reviews each recommendation before it's shown to a family member (a "four-eyes" habit an RIA will need anyway); reviews are logged.

## 5. Guardrails specific to advice
- Mode is checked on the **server** for every advice endpoint; `demo` sessions physically can't load real uploads (separate storage bucket and DB schema)
- Every advice screen and output carries the mode label; demo output is watermarked
- Advice audit log: inputs hash, rules version, recommendation, explanation, reviewer, viewer
- No commission or affiliate link anywhere near a recommendation (D-007)
- Tax and exit-load parameters live in `config/tax_rules.yaml` with `effective_from` and a source URL; a CI check fails if a rule has no source

## 6. Evals for advice (adds to tech/AI_EVALS.md)
| Dimension | Check | Gate |
|---|---|---|
| Suitability | No recommendation outside the risk band (golden profiles × portfolios) | 100% |
| Net-benefit correctness | Expected impact after tax/exit load matches a spreadsheet reference | Exact to the rupee |
| Do-nothing honesty | Cases where acting is worse than waiting → no recommendation | 100% |
| Consistency | Same inputs → same recommendations (determinism) | 100% |
| Explanation fidelity | Numbers ⊂ facts + recommendation fields | 100% |
| Mode isolation | `diagnosis` sessions never receive advice payloads; `demo` never reads real data | 0 leaks |
| Expert agreement | A practising RIA (or CFP) reviews 30 recommendations blind; agreement rate published | Recorded, not gated (v1) |

## 7. The demo (what a recruiter sees)
1. Pick a sample persona: **Rohan** (time-poor, 9 overlapping funds) or **Mr Sharma** (regular plans via a bank).
2. See the x-ray → "Advice (prototype)" tab → 3 ranked recommendations, each with ₹ net benefit after tax, trade-offs and "what would change this".
3. Ask the CFO "why exit Fund B and not Fund C?" → grounded answer.
4. A side panel shows **how it works**: facts → rules → suitability → tax simulation → explanation, with the eval scorecard.
This is the interview artefact: product judgement + AI craft + regulatory awareness in one screen.

## 8. Open items
- L-8: counsel to confirm `internal` (family, no fee) and `demo` (synthetic, anonymised) are outside the IA definition, and check the wording on any public page
- Fund-selection methodology for v2 (new purchases)
- Recruit a practising RIA/CFP for the blind review (§6)
- Tax rules: populate `tax_rules.yaml` from primary sources (Income-tax Act / Finance Act) with dates
