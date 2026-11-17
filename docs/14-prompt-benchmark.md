# 14 · Benchmark: the "10 AI finance prompts" thread vs Personal CFO

**Status:** v0.1 · **Last updated:** 2026-10-15
**Source:** a viral X thread (Sep 2026) claiming 10 ChatGPT prompts "replace $3,000 financial advisors". Prompts 1–5 were first reviewed by title only and 6–10 in full; all 10 texts are now in the appendix (21 Oct). The thread is US-centric.
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

## Appendix: prompt texts

Prompts 1–5: full text, read from the thread with Claude in Chrome on 21 Oct 2026.

### 1/ The Complete Budget Builder
```
You are a Certified Financial Planner (CFP) with 15 years of experience. I need a complete zero-based budget system tailored to my financial situation.

Please provide:

- Income breakdown: After-tax income, side income, passive income, and true monthly average if variable
- Essential expenses allocation: Housing, transportation, food, insurance, debt payments (should be under 50% of income)
- Flexible spending analysis: Dining, entertainment, subscriptions, hobbies with current vs. optimal percentages
- Financial goals prioritization: Emergency fund target, debt payoff strategy, retirement savings (15%+ of gross), short-term goals
- 50/30/20 rule optimization: Compare my current split to ideal, identify overspending categories, recommend 5 specific cuts
- Automation roadmap: Which bills to auto-pay, automatic savings transfers with amounts and dates, buffer amount for checking
- Monthly budget table: Every category with dollar amounts, percentages, and variance from optimal
- Action priority list: Top 3 changes to implement this week ranked by impact

Format as a financial advisor-grade budget with clear tables and immediate action steps.

My financial situation: [MONTHLY INCOME] / [MAJOR EXPENSES] / [CURRENT DEBTS] / [SAVINGS GOALS]
```

### 2/ The Expense Analyzer & Money Leak Finder
```
You are a forensic accountant specializing in personal finance optimization. I need you to analyze my spending and find exactly where money is being wasted.

Please provide:

- Spending categorization: Group all transactions into 15 categories with totals and monthly averages
- Top expense analysis: 10 largest expenses and 10 most frequent purchases with patterns identified
- Subscription audit: Every recurring charge identified, total monthly cost calculated, unused subscriptions flagged with annual savings estimate
- Spending pattern diagnosis: Highest spending day of week, impulse triggers (late night, weekend, emotional), month-over-month trend analysis
- Money leak identification: Bank fees, ATM charges, credit card interest, food waste (grocery vs. eating out), convenience fees, daily micro-purchases that compound
- Comparison benchmarking: My spending vs. national averages for my income bracket by category
- Optimization roadmap: 3 painless cuts I won't miss, 5 reductions requiring small behavior changes, 2 big lifestyle cuts with major impact
- Savings calculation: Total potential monthly and annual savings for each tier of cuts
- Spending scorecard: Grade by category (A-F), comparison to similar income earners, biggest financial weakness identified

Format as a detailed spending audit report with category tables, red flags highlighted, and a prioritized savings action plan.

My expense data: [PASTE LAST 3 MONTHS OF TRANSACTIONS OR DESCRIBE SPENDING PATTERNS]
```

### 3/ The Debt Elimination Strategy
```
You are a certified credit counselor and debt elimination strategist. I need the fastest, most cost-effective plan to become debt-free.

Please provide:

- Complete debt inventory: Each debt listed with balance, interest rate, minimum payment, creditor, total debt sum, weighted average interest rate
- Monthly cost breakdown: How much goes to interest vs. principal across all debts
- Payoff method comparison: Debt Snowball (smallest first) vs. Debt Avalanche (highest rate first) with complete timeline and total interest for each
- Method recommendation: Which strategy fits my psychology and situation best,with clear reasoning
- Accelerated payoff scenarios: Timeline and interest savings if I add $100, $250, $500 extra monthly; break-even analysis vs. investing
- Consolidation analysis: Should I consolidate? Compare current debts to a potential consolidation loan, calculate savings, or identify traps
- Month-by-month payment schedule: Exact payment amounts to each debt, balance reduction tracking, milestone dates (first payoff, 50% debt-free, final payment)
- Snowball acceleration points: How extra payment capacity grows as each debt is eliminated
- Behavioral rules: 5 non-negotiable rules while paying off debt, strategies to avoid new debt, how to handle windfalls (bonuses, tax refunds)

Format as a complete debt payoff roadmap with a payment schedule table, timeline visualization, and total savings calculation.

My debts: [LIST EACH: TYPE, BALANCE, INTEREST RATE, MINIMUM PAYMENT]

Extra payment capacity: [MONTHLY AMOUNT AVAILABLE]
```

### 4/ The Emergency Fund Calculator
```
You are a financial planner specializing in risk management. I need to calculate my ideal emergency fund size and create a plan to build it.

Please provide:

- Essential monthly expense calculation: Housing, utilities, food, insurance, transportation, minimum debt payments with total
- Emergency fund targets: 3-month minimum, 6-month recommended, 12-month maximum with dollar amounts for each
- Target recommendation: Which fund size is right based on job stability, income type, dependents, health situation
- Current state assessment: Gap between current savings and target, months of coverage I have today, preparedness risk score (1-10)
- Savings plan options: Monthly amount needed to hit 3-month target in 12 months, 6-month target in 18 months, timeline if I can only save [AMOUNT]
- Funding source analysis: Where to cut spending or boost income to accelerate savings
- Account comparison: Traditional savings vs. HYSA vs. money market with current rates and specific institution recommendations
- Emergency definition framework: What qualifies as real emergency vs. wants, decision tree for "should I use this fund?"
- Maintenance strategy: What to do once fully funded, review frequency, replenishment plan if used

Format as emergency fund roadmap with target amounts, monthly savings plan, account recommendations, and progress milestones.

My situation: [MONTHLY ESSENTIAL EXPENSES] / [CURRENT SAVINGS] / [JOB STABILITY] / [DEPENDENTS]
```

### 5/ The Savings Goal Architect
```
You are a goal-based financial coach. I have a specific savings target and I need you to reverse-engineer exactly how to reach it.

Please provide:

- Goal framework: Target amount, target date, months available, deadline flexibility, consequences if missed
- Savings calculations: Monthly savings required, weekly equivalent, daily equivalent, reality check against current budget
- Accelerated scenarios: Monthly amount to finish 3 months early, 6 months early, catch-up amount if starting late
- Investment vehicle recommendation: If under 2 years (HYSA, money market), 2-5 years (conservative investments), 5+ years (growth investments) with specific account types and current rates
- Funding strategy: 5 specific budget cuts to fund monthly savings, side income opportunities, one-time windfalls to apply (tax refunds, bonuses)
- Progress milestones: Where balance should be after months 3, 6, 9, 12 with catch-up strategies if behind and reallocation options if ahead
- Motivation system: Savings challenges, gamification tactics, milestone rewards

Format as goal-focused savings blueprint with monthly targets, account recommendations, and visual progress tracker.

My goal: [WHAT I'M SAVING FOR] / [TARGET AMOUNT] / [TARGET DATE] / [MONTHLY BUDGET AVAILABLE]
```

Prompts 6–10: full text, as pasted in chat on 15 Oct 2026.

### 6/ The Tax Optimization Audit
```
You are a CPA and tax strategist. I need you to identify every legal strategy to reduce my tax liability.

Please provide:

-  Tax profile summary: Filing status, gross income, current federal and state bracket, estimated total tax liability, effective tax rate
-  Deduction strategy: Standard vs. itemized comparison with calculations, above-the-line deductions I'm missing (student loan interest, IRA, HSA, self-employment), tax savings for each
-  Retirement account optimization: Current 401(k) contribution vs. max, tax savings if maxed, Traditional vs. Roth analysis for my situation, IRA eligibility and benefits, self-employment options (SEP IRA, Solo 401k)
-  Tax-advantaged account audit: HSA eligibility and contribution gap with triple tax advantage calculation, 529 plan for education with state benefits, FSA optimization strategy
-  Tax credit inventory: EITC, Child Tax Credit, education credits, energy credits, Saver's Credit eligibility with dollar value for each
-  Year-end tax moves: Tax-loss harvesting opportunities, deduction bunching strategy, Roth conversion analysis, charitable giving optimization (donor-advised funds, stock donations)
-  Total savings calculation: Estimated tax reduction if all strategies implemented, prioritized by impact, effort vs. reward rating for each

Format as tax optimization action plan with estimated savings per strategy and implementation timeline.

My tax situation: [FILING STATUS] / [GROSS INCOME] / [CURRENT DEDUCTIONS] / [RETIREMENT CONTRIBUTIONS] / [DEPENDENTS]
```

### 7/ The Net Worth Tracker
```
You are a private wealth advisor. I need you to calculate my current net worth and build a tracking system.

Please provide:

-  Complete asset inventory: Liquid assets (checking, savings, cash), investment accounts (401k, IRA, brokerage, HSA), real estate (current market value), vehicles (fair market value), business equity, other valuable assets with total
-  Complete liability inventory: Mortgage(s), auto loans, student loans, credit cards, personal loans, other debts with total
-  Net worth calculation: Total assets minus total liabilities, liquid net worth (cash + investments - debts), investable assets (excluding primary home and cars)
-  Comparative analysis: My net worth vs. average for my age and income, year-over-year growth rate if historical data available, asset allocation percentages
-  Financial health metrics: Debt-to-asset ratio (flag if over 40%), liquidity ratio, investment diversification score
-  Net worth goals: Target for my age, required annual growth rate to reach $[TARGET] by age [AGE], monthly savings and investment requirement
-  Milestone roadmap: When I'll hit $100k, $250k, $500k, $1M at current growth rate
-  Quarterly tracking system: Key metrics to monitor, rebalancing triggers, progress celebration points

Format as comprehensive net worth statement with asset/liability tables, growth projections, and tracking framework.
My financial position: [LIST ALL ASSETS WITH VALUES] / [LIST ALL DEBTS WITH BALANCES] / [AGE] / [INCOME]
```

### 8/ The Retirement Readiness Analyzer
```
You are a retirement planning specialist. I need to know if I'm on track and exactly what I need to do to retire comfortably.

Please provide:

-  Retirement need calculation: Desired annual retirement income, replacement ratio (typically 70-80% of current income), total nest egg needed using 4% rule, inflation adjustment to retirement date
-  Current retirement asset inventory: 401k, IRA, taxable brokerage, pensions, Social Security estimate (use ssa gov estimate if available) with total
-  Savings rate analysis: Current annual contributions, employer match capture, percentage of gross income saved, comparison to 15% benchmark
-  Projection modeling: Current trajectory – what will I have at retirement age, gap analysis vs. what I need, years until retirement, required growth rate assumptions
-  Catch-up scenarios: If behind, how much extra monthly to close gap, impact of working 2-5 years longer, part-time income in early retirement
-  Tax diversification check: Balance across Traditional (pre-tax), Roth (tax-free), Taxable accounts, recommended allocation shift for tax optimization in retirement
-  Withdrawal strategy: 4% rule application, tax-efficient withdrawal sequencing, Social Security claiming strategy (age 62 vs. 67 vs. 70), required minimum distributions (RMD) planning
-  Risk assessment: Investment allocation vs. age, years to retirement, risk tolerance check, rebalancing recommendations

Format as retirement readiness report with current vs. needed comparison, gap-closing strategies, and confidence score.

My retirement info: [CURRENT AGE] / [DESIRED RETIREMENT AGE] / [RETIREMENT ACCOUNT BALANCES] / [ANNUAL CONTRIBUTIONS] / [DESIRED RETIREMENT INCOME]
```

### 9/ The Insurance Coverage Audit
```
You are an insurance advisor with no sales agenda. I need an objective analysis of my insurance coverage to find gaps and eliminate waste.

Please provide:

-  Life insurance analysis: Current coverage amount and type (term, whole, universal), coverage need calculation (10x income rule, DIME method), gap identification, term vs. permanent recommendation for my situation
-  Health insurance optimization: Current plan type, deductible vs. premium tradeoff analysis, HSA eligibility check, out-of-pocket max evaluation, coverage adequacy for my health profile
-  Disability insurance assessment: Current coverage (individual, employer), income replacement percentage, benefit period, elimination period, coverage gap vs. 60-70% income replacement standard
-  Homeowners/renters evaluation: Dwelling coverage vs. rebuild cost, personal property coverage adequacy, liability limits check (recommend $300k-$500k), additional riders needed (jewelry, electronics, flood)
-  Auto insurance review: Liability limits (recommend 100/300/100 minimum), collision/comprehensive deductible optimization, umbrella policy need assessment
-  Umbrella policy recommendation: Do I need it based on net worth and risk exposure, recommended coverage amount, cost-benefit analysis
-  Coverage gap summary: What I'm underinsured on with risk level, what I'm overinsured on with savings opportunity, policies to add, policies to drop or reduce
-  Premium optimization: Bundling opportunities, discount audit, coverage reduction strategies without increasing risk

Format as insurance portfolio audit with coverage gap analysis, risk exposure ratings, and premium optimization recommendations.

My current coverage: [LIST ALL POLICIES: TYPE, COVERAGE AMOUNTS, PREMIUMS] / [AGE] / [DEPENDENTS] / [ASSETS] / [INCOME]
```

### 10/ The Complete Financial Health Checkup (Master Prompt)
```
You are a Certified Financial Planner presenting a comprehensive financial plan. I need a complete financial health assessment with prioritized action steps.

Please provide:

-  Executive summary: 3-paragraph overview of my financial health, biggest strengths, critical weaknesses, immediate priorities
-  Financial vital signs scorecard: Emergency fund status, debt-to-income ratio, savings rate, net worth trajectory, retirement readiness, insurance coverage, tax efficiency – each scored 1-10 with benchmarks
-  Cash flow optimization: Monthly income vs. expenses, positive or negative cash flow, spending efficiency score, recommended budget adjustments
-  Debt management verdict: Total debt load assessment, good debt vs. bad debt breakdown, payoff priority ranking, recommended aggressive vs. conservative approach
-  Savings & investment strategy: Current allocation vs. optimal for my age and goals, diversification score, fee audit, rebalancing needs, tax-location optimization
-  Risk protection analysis: Insurance coverage gaps prioritized by severity, emergency fund adequacy, estate planning checklist (will, power of attorney, beneficiaries)
-  Goal alignment check: Are my current financial behaviors aligned with stated goals, trade-off analysis (current lifestyle vs. future goals), required behavioral changes
-  90-day action plan: Top 10 financial moves ranked by impact, quick wins (do this week), medium-term projects (do this month), long-term initiatives (do this quarter)
-  Annual financial calendar: When to review budget, rebalance investments, tax plan, insurance audit, net worth tracking
-  The one thing: If I could only fix ONE thing in the next 30 days, what would have the biggest impact on my financial future

Format as comprehensive financial plan with scoring dashboard, prioritized action list, and implementation timeline.

My complete financial picture: [INCOME] / [EXPENSES] / [DEBTS] / [ASSETS] / [GOALS] / [AGE] / [DEPENDENTS] / [RISK TOLERANCE]
```
