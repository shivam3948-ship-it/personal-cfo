# Appendix · Generic "wealth creation" framework (research reference)

**Status:** saved for research on 2026-10-15. **No product or doc changes made from it yet.**
**Source:** pasted by Shivam; it reads like an AI search summary built on bank, AMC, insurer and YouTube pages (cited below). Kept verbatim as a benchmark of what a mass-market user is told today. It sits alongside docs/14 (the "10 AI finance prompts" benchmark).

---

## A. The framework (verbatim)

Wealth creation is the systematic process of growing your net worth over time through disciplined saving, strategic investing, and smart asset accumulation. [1, 2]

### 📌 Foundation Phase (Order of Operations)
* 🛑 Clear High-Interest Debt: Eliminate toxic credit card or personal loans carrying high interest rates before investing.
* 🛡️ Build Emergency Fund: Save 3 to 6 months of essential living expenses in a liquid savings account. [2]
* 📜 Secure Insurance: Purchase adequate health and term life insurance to protect your savings from unexpected medical or life crises. [2, 3]

### 🗓️ Action Plan by Time Horizon
* 🗓️ Short-Term (0–3 Years)
  * Savings: Use high-yield savings accounts or short-term fixed deposits for capital safety.
  * Focus: Maintain maximum liquidity and zero market risk for immediate needs. [1]
* 🗓️ Mid-Term (3–7 Years)
  * Savings: Allocate funds to balanced hybrid or conservative debt mutual funds.
  * Focus: Balance moderate growth with capital protection for goals like vehicle purchases or home down payments. [4]
* 🗓️ Long-Term (7+ Years)
  * Savings: Invest systematically via [Systematic Investment Plans (SIP)](https://www.shriramamc.in/goals/wealth-creation-mutual-fund) in equity mutual funds or direct stocks.
  * Focus: Leverage compounding returns to outpace inflation. [2, 3, 5, 6]

### 📊 Asset Class Comparison
| Asset Class | Risk Level | Return Potential | Primary Purpose |
|---|---|---|---|
| Equity/Mutual Funds | High | High | Long-term growth & compounding |
| Fixed Income/PPF/EPF | Low | Moderate | Capital stability & tax-saving retirement |
| Real Estate | Moderate | Moderate-High | Tangible asset appreciation & rental yield |
| Gold | Low-Moderate | Moderate | Hedge against inflation & economic uncertainty |

### 💡 Core Wealth Principles
* ⏳ Start Early: Give your investments more time to compound exponentially. [3, 7, 8]
* 🔄 Stay Consistent: Maintain regular monthly contributions regardless of market fluctuations. [3, 4]
* 🔀 Diversify: Spread investments across different asset classes to minimize total risk. [3, 9]
* 🧾 Optimize Taxes: Utilize tax-advantaged accounts (like EPF, PPF, or ELSS funds) to retain more earnings.

To tailor this strategy precisely, what is your current age, monthly savings capacity, and primary financial goal?

[1] [kotak.bank.in](https://www.kotak.bank.in/en/stories-in-focus/accounts-deposits/savings-account/wealth-creation-what-is-it-and-how-to-build-it.html) ·
[2] [bajajamc.com](https://www.bajajamc.com/knowledge-centre/importance-of-wealth-creation-in-india) ·
[3] [iciciprulife.com](https://www.iciciprulife.com/investments/wealth-creation.html) ·
[4] [youtube.com](https://www.youtube.com/watch?v=dDdb7Hr1bCg&t=69) ·
[5] [shriramamc.in](https://www.shriramamc.in/goals/wealth-creation-mutual-fund) ·
[6] [youtube.com](https://www.youtube.com/watch?v=h8b8QYvAWXk&t=219) ·
[7] [icici.bank.in](https://www.icici.bank.in/blogs/miscellaneous/beginners-guide-to-wealth-creation-four-proven-tips) ·
[8] [generalicentrallife.com](https://www.generalicentrallife.com/blog/savings-and-investments/the-art-and-discipline-of-wealth-creation) ·
[9] [bajajfinserv.in](https://www.bajajfinserv.in/investments/what-is-wealth-creation)

---

## B. Evaluation: what are we missing? (no changes made yet)

### B1. Covered already
| Framework item | Where we have it |
|---|---|
| Emergency fund in months of expenses | Phase 2 F2-9 (docs/15); Munim `emergency_fund` |
| Term life insurance adequacy | Phase 2 F2-10 term-cover gap vs a need the user sets (diagnosis only, L-9) |
| Clearing high-interest loans | Munim: prepayment maths with charges and lock-in, and switching vs asking the lender to match; docs/14 #3 puts debt payoff plans "Later" |
| Stay consistent (SIPs) | Phase 1 behaviour insights: SIP stops and churn, the behaviour gap (docs/08 P2) |
| Diversify | Phase 1 overlap and the "messy pile" insight (docs/08 P6), but only within mutual funds |
| Optimise taxes, long-term goals, retirement | Phase 4 and Phase 3 (docs/14 #5, #6, #8; PRDs paused) |
| Net worth across EPF/PPF/NPS/gold/property | Phase 2 F2-8 (manual entries for non-statement assets) |

### B2. Gaps in our plan (candidates, not decisions)
| # | Gap | Why it matters | Likely home |
|---|---|---|---|
| G1 | **No "foundation first" verdict.** Nothing checks the order debt → emergency fund → insurance before we show investing insights. | The single most useful sentence for a first-time saver; it also stops us optimising SIPs for someone carrying card debt at about 3.6% a month (rate as printed on the sample card statement) | Phase 2 headline verdict; Munim's Sunday call |
| G2 | **Revolving card debt is not detected.** Paying only the minimum, finance charges, BNPL. | Step 1 of the framework; Phase 2 F2-2 reconciles card totals but doesn't flag minimum-only payments | Phase 2 leak finder (F2-7) |
| G3 | **Health cover adequacy is missing.** Only term cover is diagnosed: no sum insured vs family size and city, employer-only cover, top-ups. | Health shocks are the most common reason Indian savings get wiped out (widely reported; I don't have a verified figure, so cite before use) | Phase 2 F2-10 (diagnosis only, L-9) |
| G4 | **No allocation across all assets.** Phase 1 allocation is mutual funds only; net worth lists assets but not equity / debt / gold / real estate / EPF-PPF as a share of the total. | The framework's asset table is how users think about it; MF-only allocation misreads someone whose wealth is mostly EPF plus a flat | Phase 2 net worth (F2-8), feeding Phase 3 |
| G5 | **No goal-horizon buckets** (0–3 / 3–7 / 7+ years → liquidity vs growth). | The core of goal planning; mapping a horizon to a product type is advice | Phase 3 PRD (RIA-gated; advice catalogue docs/12) |
| G6 | **Inflation-adjusted framing** for the emergency fund, goals and "real" returns. | Nominal numbers flatter fixed deposits and endowment plans | Phase 3; Phase 1 could show real XIRR |

### B3. Where the framework itself is weak (don't copy these)
- **Conflicted sources.** Most citations are banks, AMCs and insurers that sell the products they recommend, plus YouTube. Our edge is the opposite: no product sales (D-007).
- **Generic, not personalised.** It asks age, savings and goal *after* advising. We read them from the user's data first and ask only what the data can't tell us.
- **"High-yield savings accounts"** is a US concept. Indian savings rates are mostly low, so sweep-in FDs and liquid funds are the local equivalents (verify current rates before saying anything numeric).
- **Oversimplified risk table.** Real estate's illiquidity and concentration risk are missing, and gold can be volatile, not "low-moderate". Treat it as a teaching aid, not a model.
- **Tax tips assume the old regime.** ELSS/PPF deductions (80C) don't apply under the new regime, which is the default. Debt-fund taxation changed for units bought from April 2023. **Verify both against current law (the Income-tax Act 2025 applies from FY26-27) before Phase 4.**
- **Missing what we lead with:** fees (regular vs direct plans, TER), the behaviour gap, fund overlap, mis-sold endowment and ULIP policies, verifying every number, family and parents' money, and credit health.

### B4. If we act on it later (suggested order)
G2 and G1 are cheap, high-trust insights for Phase 2 and Munim. G3 and G4 extend existing Phase 2 features. G5 and G6 wait for the Phase 3 PRD.
