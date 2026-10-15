# 14 · Benchmark: the "10 AI finance prompts" thread vs Personal CFO

**Status:** v0.1 · **Last updated:** 2026-10-15
**Source:** a viral X thread (Sep 2026) claiming 10 ChatGPT prompts "replace $3,000 financial advisors". Prompts 1–5 were reviewed by title only; 6–10 in full. The thread is US-centric.
**Why this doc:** it's the real substitute our users already try (docs/02 §1). For each prompt we note what a bare prompt gets wrong for an Indian user, where we cover it, and what we adopt.

## 1. Bottom line
- **The thread is a good map of what a "personal CFO" must eventually cover:** budget, leaks, debt, emergency fund, goals, tax, net worth, retirement, insurance, and a master check-up. Our phases cover all of it except debt payoff and estate planning (later).
- **Bare prompts fail in four repeatable ways:**
  1. **US rules imported silently:** 401(k), IRA, Social Security, the 4% rule, 10× income cover, umbrella policies
  2. **Self-reported inputs:** the user types numbers from memory
  3. **AI arithmetic:** unverified, unreproducible
  4. **Invented benchmarks:** "net worth vs average for your age"
- **Our answer to all four:** real statements in, Indian rules from a dated and sourced config, maths in code, comparisons only where a real source exists, and the AI explains but never computes (D-009).

## 2. Prompt-by-prompt
| # | Prompt | Indian rework needed | Our phase | What we adopt |
|---|---|---|---|---|
| 1 | Complete Budget Builder | Rupee categories, UPI-heavy spending | **P2** (bank/card statements) | Budget = derived from real transactions, not typed |
| 2 | Expense Analyzer & Money Leak Finder | Subscriptions, UPI micro-spend, card fees | **P2** | "Leaks in ₹/yr" framing, same as our fee insight |
| 3 | Debt Elimination Strategy | Credit cards, personal loans, BNPL, home loan prepay vs invest | **Later** (P2 detects debt; payoff plans after) | Avalanche vs snowball maths in code |
| 4 | Emergency Fund Calculator | Months of expenses; where to park it (liquid / arbitrage funds; taxation) | **P2** | Months-of-cover metric from real expenses |
| 5 | Savings Goal Architect | Goal → SIP; Indian inflation | **P3** (advice; RIA) | Goal templates |
| 6 | Tax Optimization Audit | Old vs new regime; 80C/80D/NPS (old regime); employer NPS; **LTCG harvesting within the annual exemption** | **P4** (data from P1) | Harvesting = advice catalogue A6; rules from `tax_rules.yaml`, never AI memory |
| 7 | Net Worth Tracker | MF + demat (CAS), EPF/PPF/NPS/gold/property (manual), loans (statements) | **P2 anchor screen** | Net worth as the monthly "home" number; **no peer averages** without a real source |
| 8 | Retirement Readiness | No Social Security; EPF/NPS/PPF/gratuity; the 4% rule is US-derived; NPS exit rules (recently revised; verify) | **P3** (first goal template) | Editable, visible assumptions; projections as **ranges**, not one number |
| 9 | Insurance Coverage Audit | Term vs need; **endowment/ULIP mis-selling**; health floater, top-ups, employer-cover dependence; no umbrella policies | **New: P2 insurance module** | Detect premiums in bank statements; per-policy return computed from actual terms. ⚠ Recommending surrender or purchase is **insurance advice (IRDAI)**, not covered by an RIA licence (L-9) |
| 10 | Complete Financial Health Checkup | All of the above | **The whole roadmap** | "**The one thing**" → our headline verdict; ranked actions = advice engine; annual calendar = moments (docs/13 §4) |

## 3. What #10 tells us about the product
- **"If I could fix ONE thing"** is the best line in the thread, and it's our design principle: one verdict line, then at most 3 ranked moves.
- **A 1–10 scorecard is fake precision** unless each score has a formula and a source. We show computed metrics (months of emergency cover, equity share vs profile, fee drag in ₹) and only score against sourced benchmarks.
- **Estate planning:** nominations matter in India (SEBI requires MF nomination or opt-out). Our first real CAS (MF Central v1.2) has **no nominee field**, so we'd have to ask the user. Later item.

## 4. Changes to our plan
| Change | Where |
|---|---|
| Insurance module (premium detection + policy diagnosis) added to Phase 2 | docs/07 |
| Net worth screen as the Phase 2 anchor | docs/07 |
| Retirement as the first Phase 3 goal template; projections as ranges | docs/07, docs/12 |
| L-9: confirm the IRDAI boundary for insurance diagnosis vs advice | docs/03 |
| Demo idea for interviews: run the thread's master prompt in ChatGPT on Rohan's sample data, next to our x-ray, and show where numbers differ | docs/research |
