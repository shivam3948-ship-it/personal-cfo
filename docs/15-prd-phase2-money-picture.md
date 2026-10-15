# 15 · PRD — Phase 2: Money Picture (spending, net worth, insurance)

## 1. Title
Phase 2: Money Picture: where money goes, what's left to invest, what you're worth, and what your insurance really costs

## 2. Author & Team
- **PM / builder:** Shivam Singh · **Engineering:** Shivam + Claude Code · **Legal:** L-9 (IRDAI boundary) · **Status:** Draft v0.1 · 2026-10-15

## 3. PM Epic
`PCFO-EPIC-2 · Money Picture`

---

# One Pager

## 4. Problem
Phase 1 shows *what you've invested*. It can't answer the questions that come before and around it: *How much can I invest? Where is money leaking? What am I worth overall? Is my insurance protecting me, or quietly costing me?* Users answer these from memory, and memory is wrong. Card spend is double-counted with bank bill payments, transfers between their own accounts look like spending, and traditional insurance plans look like savings.

## 5. Objectives
| # | Objective | Measured by |
|---|---|---|
| O1 | Show **true monthly spend and investable surplus**, reconciled to the statements | 100% statement reconciliation on the golden set |
| O2 | One **net worth** number the user returns to monthly | Monthly active net-worth viewers |
| O3 | Surface **money leaks in ₹/yr** (subscriptions, fees, cashback shortfalls) | Leak insights acted on (verified next cycle) |
| O4 | Make **insurance waste visible** without giving insurance advice | Policies diagnosed; L-9 compliant copy |
| O5 | Feed Phase 3 with real income, expenses and surplus | Share of Phase 3 plans using real data, not typed numbers |

## 6. Constraints
- **On-device parsing** for bank and card PDFs, the same as CAS (D-017). Only categorised, pseudonymised transactions leave the device.
- **Verify before present** (Spend Analyser rules): the bank running-balance walk must have 0 mismatches; a card must satisfy `Prev dues + Purchases − Payments/Credits + Charges = Total due`, with rounding stated.
- **Insurance:** diagnosis only, no surrender or purchase recommendation (IRDAI; L-9).
- **No peer benchmarks** without a real source (docs/14).
- Statements vary by bank: start with the founder's banks and cards (golden set), then expand by demand.

## 7. Personas
- **Rohan (primary):** wants "how much can I invest each month" and "where does my salary go"
- **Priya (secondary):** wants her parents' policies and FDs in one view
- **Ramesh (parked):** a future user; bank and UPI flows are the only data a first-time saver has (docs/13 §7)

## 8. Use cases
UC1 True spend by category this month and the trend · UC2 Investable surplus (income − true spend − committed EMIs/SIPs) · UC3 Subscriptions and fee leaks in ₹/yr · UC4 Net worth: assets − liabilities, liquid vs investable · UC5 Emergency fund in months of real expenses · UC6 "₹X/yr goes to insurance plans that mix cover and investment; here's what each returns"

---

# PRD

## 9. Features In
| ID | Feature | Priority | Notes |
|---|---|---|---|
| F2-1 | Bank statement upload + on-device parse + running-balance verification | Must | Spend Analyser logic ported to `packages/statement-parser` (TS) |
| F2-2 | Credit card statement upload + total-due reconciliation + cashback reconciliation | Must | Cashback table = prior cycle; "eligible for EMI" ≠ EMI |
| F2-3 | Categorisation engine: priority-ordered word-boundary rules; merchant gateway grouping; user re-categorise | Must | Every override logged; corrections improve rules |
| F2-4 | **Cross-account integrity:** NON_SPEND set (self-transfers, card bill payments, FD sweeps, cashback, interest, dividends); pass-through chains count only the final leg | Must | The #1 source of wrong numbers |
| F2-5 | Spend dashboard: month view, category split, trend, recurring items named (rent, SIP, premiums) | Must | |
| F2-6 | **Investable surplus** = income − true spend − committed outflows | Must | Feeds Phase 3 |
| F2-7 | Leak finder: subscriptions, fees and charges, cashback shortfalls, duplicate charges, unmatched refunds | Must | ₹/yr framing; severity tiers |
| F2-8 | **Net worth screen:** MF + demat (CAS), bank balances + FDs (statements), EPF/PPF/NPS/gold/property/other (manual, dated), loans (statements + manual) | Must | Monthly anchor; liquid and investable splits |
| F2-9 | Emergency fund metric: liquid assets ÷ average monthly true spend | Must | Months of cover |
| F2-10 | **Insurance module:** detect premiums in statements; user adds policy details; compute each traditional/ULIP policy's projected return from its terms; show term-cover gap vs a user-chosen need | Should | Diagnosis only (L-9) |
| F2-11 | Family view extension: parents' statements and policies (with consent) | Should | Secondary persona |
| F2-12 | Suspicious-transaction flags (large unlabelled credits, vague large transfers, same-day duplicates) | Could | From the Spend Analyser rules |

## 10. Features Out
Budget enforcement or alerts per transaction · bill payments or any money movement · credit score pull · insurance purchase/surrender recommendations (until licensed) · peer comparisons · Account Aggregator (later, via RIA; D-018)

## 11. User Stories & AC
**US2-1 Upload a bank statement:** as Rohan, I upload last month's bank PDF and see true spend.
- AC1: Running-balance walk mismatches = 0 on 100% of golden files; on any mismatch, show where the first break is and no numbers.
- AC2: Debit/credit counts and totals match the statement header.
- AC3: The PDF never leaves the device (as D-017); only categorised rows with counterparties hashed or normalised are sent.

**US2-2 Card statement:** AC1: `Prev + Purchases − Payments/Credits + Charges = Total due` within ₹1 (rounding stated). AC2: cashback credits reconcile to the summary table; reversals reported separately. AC3: the bank-side card bill payment is excluded from spend.

**US2-3 True spend:** AC1: self-transfers, card bill payments, FD sweeps and refunds/cashback are excluded from spend (NON_SPEND), but kept in per-account reconciliation. AC2: category subtotals sum to total spend exactly (asserted in code).

**US2-4 Net worth:** AC1: each line shows its source (CAS / statement / manual) and as-of date; manual entries older than 90 days are flagged stale. AC2: net worth = Σ assets − Σ liabilities, reconciled in the same computation as the subtotals.

**US2-5 Insurance diagnosis:** AC1: projected return is computed only from user-entered policy terms (premium, term, sum assured, maturity value) and labelled as such. AC2: copy contains no surrender or purchase verbs (advice-boundary test extended to insurance). AC3: "term cover gap" uses a need the user sets, shown with the method.

## 12. Design Link
`TBD — PCFO Phase 2` (Figma). Screens: statements hub, spend month, leaks, net worth, emergency fund, insurance list + policy detail.

## 13. Technical Considerations
- `packages/statement-parser` (TS, on-device): per-bank and per-card layout adapters; golden set per bank. Reuse Spend Analyser's verification and categorisation rules as test oracles.
- Data model additions: `accounts`, `statements`, `transactions_bank`, `categories`, `category_rules`, `manual_assets`, `liabilities`, `policies`; all with RLS + `delete_user` coverage.
- Engine facts: `F-spend-true-month`, `F-surplus-month`, `F-networth`, `F-ef-months`, `F-leak-*`, `F-policy-irr-*`.
- Counterparty text is PII-adjacent (names in UPI strings): normalise to merchant IDs on device; person-to-person counterparties are hashed.

## 14. Success Metrics
- **NSM contribution:** verified actions from Phase 2 insights (subscription cancelled, fee stopped, emergency fund topped up), detected in the next statement.
- **KPIs:** statement upload completion, reconciliation pass rate, monthly net-worth viewers, leaks acted on, Phase 3 plans using real surplus.
- **Guardrails:** 0 unreconciled numbers shown; 0 insurance-advice copy violations; counterparty PII not sent in clear.

## 15. GTM Approach
Upsell inside Phase 1: "Your SIPs are ₹19,000/month. Is that what you can afford? Add a bank statement." Also: the family plan ("add Papa's FDs and policies").

## 16. Open Issues
| # | Issue | Owner |
|---|---|---|
| OI2-1 | Bank layout coverage: which banks first? (founder's + top 5 by user demand) | PM |
| OI2-2 | IRDAI boundary for policy diagnosis (L-9) | Legal |
| OI2-3 | UPI counterparty normalisation without leaking names | Eng |
| OI2-4 | Manual asset valuation (property, gold): user-entered only, or price feeds for gold? | PM |

## 17. Q&A
- **Why not link bank accounts?** Account Aggregator needs a regulated entity (D-018); uploads work today and stay on the device.
- **Why no "you spend more than people like you"?** No trustworthy Indian benchmark; we compare you to your own past.

## 18. Feature Timeline & Phasing
| Sprint | Scope |
|---|---|
| P2-S1 | F2-1, F2-3, F2-4 (one bank) |
| P2-S2 | F2-2 (one card), F2-5, F2-6 |
| P2-S3 | F2-7, F2-9 |
| P2-S4 | F2-8 net worth |
| P2-S5 | F2-10 insurance (after L-9), F2-11 |
