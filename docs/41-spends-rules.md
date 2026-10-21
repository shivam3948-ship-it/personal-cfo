# 41 · Spends tab: design rules (21 Oct 2026, v4 mock)

**Status:** design. Mocks "Spends v3" (v1, v2 kept), "Category detail v1", "All transactions v1", "Subscriptions v1" and "Your rules v1" are on the Munim v2 canvas, with Tweaks for theme, state and variant.
- All figures come from `packages/core` on the sample family, as of 15 Oct.

## The job (user, 21 Oct)
"Where did my money go, and what can I change?" Search and the full transaction list come later.

## What counts (user, 21 Oct; updated in v2)
| Bucket | Categories | Shown as |
|---|---|---|
| **Everyday spending** | Food, shopping, dining, travel, fuel, bills, subscriptions, cash, fees | Hero number + pace chart |
| **Fixed costs** | Rent, loan EMIs, insurance | In the split bar |
| **Others** | Family transfers + uncategorised spends | In the split bar |
| **Not counted** | Transfers between your own accounts, card bill payments, investments | Only in "Show the math" |

- "Others" mixes something intentional (family) with something unknown (uncategorised).
  - The uncategorised count also appears as a filter in All transactions, so it gets sorted rather than ignored.
  - Revisit if "Others" grows large.
- **Usual pace** = the middle (median) of the last 3 months' everyday spending at the same day of the month.
  - Sample: Jul ₹17,119 · Aug ₹31,691 · Sep ₹48,957 → usual ₹31,691.
  - October to the 15th: ₹28,179, which is ₹3,512 below.
  - The usual line in the chart is the day-by-day median of the three months.
- **A yearly renewal landing this month** shows as "yearly charge", not a misleading % jump.

## Charts (v2, 21 Oct): only where a chart answers faster than a number
| Question | Form | Why |
|---|---|---|
| "Am I on track this month?" | **Line: this month (teal) against a usual month (dashed grey)**, day 1–31. Tap or hover for the day's values. | Pace is a trend over time. One line is the point and the other is context, so emphasis colouring is used, not a palette. |
| "Where does my money go, broadly?" | **One split bar:** Everyday / Fixed / Others, with values below it | Part of a whole with 3 parts. A bar reads better than a pie and fits a phone. |
| "Which categories?" | **Horizontal bars**, ranked; each row opens its detail | Ranking is the strongest reading task for bars. |
| Trend per category (6 months) | Small bar chart inside category detail | Next, with the category screen |

- **Rejected:** pie and donut charts (slices are hard to compare, and the labels don't fit on a phone) and dual-axis charts.
- Identity never relies on colour alone: the two pace lines are **labelled directly** ("This month" beside the teal dot, "Usual month" under the dashed line's end), with no separate legend box. Direct values sit under the split bar.

## Screen order (v4, 21 Oct)
1. **Hero:**
   - everyday spending, the pace line ("₹3,512 below your usual pace · How?") and a **medium pace chart (326×88 plot, about 100px)**: this month in teal against a dashed usual month, labelled directly on the lines, with day marks 1 · Today · 31 and tap/hover values (v4, user, 21 Oct).
     - Why medium: the v2 chart lost its space to the legend row and the separate math button, not to the chart itself. The v3 sparkline (120×44) saved space but read as decoration and hid the values behind a sheet.
     - **How?** opens the "How your pace is worked out" sheet: the 3-month math and the Not counted amount.
   - the split bar (Everyday / Fixed / Others, with the month's total);
   - **Money in ₹1,45,000 · left after spending ₹63,220**. It opens the **Money in sheet** (v4), described below.
   - Below the hero: **"✓ Every statement balances to the rupee · Your data"**. This opens the data sheet: each file read, its period, its transaction count and the checks it passed (from the ingest log: balance walk, opening + credits − debits = closing, card total due, SMS continuity, 11/11 cross-document checks). Files never leave the phone.
   - **Month switcher:** a sheet of months with totals. The current month is ticked; a past month opens its Close your month report card.
2. **What you can change**, collapsible and **collapsed by default**:
   - The header shows a summary ("Save ₹3,500 · 5 more fixes").
   - v4 adds a **pace fix** at the top of the list when a category runs ≥20% above its usual by the same day: "Food delivery up 28% this month · Skip 2 orders, save ₹1,094". It opens the category screen.
   - The **savings card stays visible even when collapsed** (savings come first).
   - The fixes open on tap.
3. **Where it went:** top 6 categories. **Each row is tappable**: Subscriptions opens the Subscriptions screen; other categories open the transactions for that category. The separate Subscriptions card is removed.
   - Note: the Subscriptions *screen* shows all recurring charges, including some filed under other categories (cult.fit is Fitness, ACT Fibernet is Internet). It is reached from the Subscriptions row and from the fixes.
4. **Recent:** the last 4 transactions, then **See all transactions**.

## All transactions flow (v1)
- **Entry:** "See all transactions", "See all categories", or tapping a category row.
- **Top of the screen:**
  - a search box, shown but marked "Soon" (search comes later, user 21 Oct);
  - filter chips with counts: All · Everyday · Fixed · Others · Not counted · Money in;
  - a "Your rules · 1" shortcut.
- **List:** grouped by day, with the day's spend total. Each row shows the merchant, category · account (••last 4) and the amount. Money in is teal with a "+". Not-counted rows are muted and tagged.
- **Tap a row → detail sheet:**
  - amount, merchant, date and account;
  - category with **Change**, and "Counts as" (the bucket);
  - Shared / pay me back, Charged twice, Add a note, I didn't make this.
  - This is the same fix component as Today's "Something's off?" (docs/38). Munim asks before turning a fix into a rule.
- **Fix flows (v2, 21 Oct; v1 had no handlers: "Change" did nothing, user report):**
  - **Change:** categories grouped by bucket (Everyday / Fixed costs / Others / Not counted; credits get Salary / Other income / Refund / Self transfer), with the current one ticked. Then **"Only this payment"** or **"All N Zomato payments, and future ones"**, which makes a rule. The list, chips and "Your rules" count update.
    - A UPI transfer to a person, or to your own account, never becomes a merchant rule, because "Person-to-person" isn't one payee. It changes only that payment.
  - **Shared:** "Half was mine" (rounded to whole rupees, so your share plus what comes back equals the payment) or "None of it was mine". Only your share counts as spending.
  - **Charged twice:** looks for the same merchant and amount within 2 days. If found, Munim leaves the second one out and gives refund steps (merchant first, then a bank dispute after 7 days). If not found, it says so plainly; no row is touched.
  - **Note:** up to 60 characters, kept on the phone and never sent to the AI.
  - **I didn't make this:** block the card or UPI, report to 1930 or cybercrime.gov.in, and raise a written dispute. Optionally mark it "Not mine", which leaves it out of spending.
  - Every fix shows a confirmation line with **Undo**.
  - ⚠ The mock keeps fixes per screen; the Rules screen doesn't yet show rules made here. The build must share one store.

## Business rule (user, 21 Oct; D-038)
- **Priority:** 1. grow savings, 2. revenue per user.
- **Earn only when the user measurably saves.** Every offer shows the net saving, computed from their data, and says if Munim may earn a fee. The test is "would we show this if we earned nothing?"
- **Spends finds opportunities; the owning tab acts on them.** Loans go to Credit; insurance and tax go to Invest.
- **Rejected:** merchant-funded offers that make money from more spending.
- **Worked example (in the mock, real sample data):**
  - Rohan has a pre-approved Neem Bank offer at 11.25% (email of 6 Oct, 1% fee + GST, valid until 31 Oct). His Orbit Finserv loan is at 13.5%, with ₹2,35,916 outstanding.
  - Switching **loses ₹9,964**: interest saved ₹6,739, minus the processing fee (₹2,784) and the 5% + GST foreclosure charge (₹13,919).
  - It's also **not allowed until 20 Dec**, and the offer expires before then.
  - So Munim shows **"Ask Orbit to match 11.25%: saves ₹6,739"**, labelled "Munim earns nothing from this", and never pushes the Neem offer.
  - Computed with `compareRefinance`.

## Category detail (v3: every category, 21 Oct)
- **One screen for every category** (`Category.dc.html`, built per category by `tools/build_categories.py` from a packages/core probe). Spends' "Where it went" rows open it; Subscriptions keeps its own screen.
- **Hero, bars and "Where from" are the same for all.** "Where from" shows only when there are 2 or more merchants. The "above / below / about usual" line uses the 20% threshold from Spends.
- **The card under the chart depends on the kind of category:**

| Kind | Categories | Card |
|---|---|---|
| Choice, ≥20% above usual, 2+ payments | Food delivery, Quick commerce, Dining, Shopping, Cabs | **Save what you skip** (below) |
| Choice, ≥20% below usual | same | "₹1,747 below your usual here. It's already part of the Savings first amount on Spends." No second save button, so savings aren't counted twice |
| Choice, within ±20% | same | "In line with your usual. Nothing to change here." |
| Essential | Fuel, Utilities, Mobile & internet | "An essential cost. Munim won't push savings here; it flags only an unusual jump." |
| Cash | Cash withdrawal | **Blind spot:** "You take out ₹5,000 in cash every month. What is it for?" Household help / Groceries / Family / Something else, then "Yes, every month" (a rule) or "Just this time". This is the first piece of the uncategorised sort flow |
| Membership | Fitness | cult.fit unused since July · ₹23,988 a year → Subscriptions (how to cancel) |

- New category **Household help** counts as Fixed costs.

## Category detail (v2: Food delivery)
- **Hero:** month to date ₹4,923, 28% above the usual by the 15th (usual ₹3,854), 9 orders at ₹547 on average.
- **Bars by month:** Jul–Oct, with the current month emphasised and the past months grey. The current month is labelled "so far".
- **Where from:** merchants ranked (Swiggy ₹2,511 · 5 orders, Zomato ₹2,412 · 4 orders).
- **Save what you skip (v2, replaces the heads-up):**
  - "Order a little less for the rest of the month and save the difference now."
  - Pills: ₹547 (1 order fewer) · ₹1,094 (2) · ₹1,641 (3), using this month's average order (₹4,923 ÷ 9). **Nothing is preselected** (docs/37).
  - **Save ₹X** moves the money now, with Undo; **Not now** dismisses. "Munim never blocks an order."
  - The 28%-above-usual line in the hero is the spike signal. It needs no setup.
- **Heads-up alerts ("tell me when it passes ₹X") move to phase 2** (D-039). Reasons:
  - they need a settings surface;
  - web push is unreliable, especially on iPhone;
  - they add copy and states in two languages;
  - too many alerts read as nagging.
  - Spike lines and the pace fix already deliver most of the value with zero setup. Phase 2 can target the categories where users actually overspend.
- **This month's orders:** each row opens the transaction detail.

## Money in (credits): how each kind is treated (21 Oct)
| Credit | Treated as | Where it shows |
|---|---|---|
| Salary or other income | Income: never reduces spending | "Money in" line and month close |
| Refund (e.g. Myntra ₹1,299 in Aug) | **Nets against the original category** (core `refundCategory`): a refund lowers that category's spending | Transaction tagged "Refund · from <original>". A refund with no matching earlier debit is flagged "Refund we can't match" |
| Cashback (card, previous cycle) | Not income, not spending. Shown as **net cashback earned** | Card section in Credit. A cashback shortfall against card rules becomes a fix |
| Card bill "payment received" (card side) | Not counted: the bank-side payment is the same money | Hidden from totals, visible in All transactions (Not counted) |
| Transfer from your own account | Not counted | Same |
| Savings interest | Small income | Money in. ⚠ **Engine gap:** core `categorize` files `Interest` as `non_spend`, so Sep's ₹1,186 is missing from income. Fix it before the build |
| Money from friends or family | **Matched against "Shared" spends** of a similar amount nearby in time (e.g. Swiggy ₹1,200 shared, friend sends ₹600 → your share is ₹600). Unmatched → asked "What's this?" | Transaction detail and a fix |
| Large unlabelled credit | Asked once: "What's this?" (gift, loan, sale, refund) | What you can change (security first) |

## Money in sheet (v4, 21 Oct)
- **Why a sheet, not a tab:** salaried users get one credit a month, and what matters is "how much is left". Irregular earners (freelancers, shop owners, gig workers: many first-stage and tier-2/3 users, D-035) live by when and how much comes in. A sheet serves both without turning Spends into a cash-flow screen.
- **Contents:**
  - the month's income credits, each with date and source;
  - a forward-looking card;
  - bars for the last 3 months plus this month so far (one series, values on the bars, no legend);
  - the math: Money in − Spent this month = Left;
  - what is not counted as income.
- **Salaried (sample family, packages/core):**
  - Salary ₹1,45,000 on 1 Oct.
  - "Next salary expected around 1 Nov": `nextSalaryDate` is the last salary + 1 month.
  - "It has come on the 1st for 3 months running, the same amount each time." This is computed by checking dates and amounts.
- **Irregular (illustrative sample, fictional clients; Tweak `earner`):**
  - Oct: Brightleaf Studio ₹62,000 and Kestrel Labs ₹35,000.
  - Jul–Sep: ₹1,12,000 / ₹1,68,000 / ₹91,000.
  - **"Plan on ₹91,000 a month"**, the lowest of the last 3 months: "Planning on your lowest month keeps you safe; anything above it goes to savings first."
  - ⚠ The engine has no income-variability function yet. It needs `incomeRange()` (min, max, median over complete months) before the build.
  - The safe-plan rule (lowest month) is our proposal, not an industry standard.

## Borrowed from the Spend Analyser skill (21 Oct)
- **Verify before showing:**
  - Every statement must reconcile (balance walk, opening and closing, card total due) before its numbers appear.
  - A mismatch is investigated, never adjusted to fit.
  - Hence the "✓ Every statement balances" line and the data sheet.
- **No double counting across your own accounts:** the not-spending set (self-transfers, card bill payments, cashback, interest, investments) and pass-through chains (only the final leg to the real payee counts).
- **Flag, don't force:**
  - Unexplained gaps stay open: an unmatched refund, a split that's short.
  - "Eligible for EMI" is an offer, not a conversion.
- **Suspicious items, in severity order:**
  1. large unlabelled credits;
  2. large vague transfers;
  3. same-day duplicate charges;
  4. EMI conversions;
  5. cashback shortfalls;
  6. unmatched refunds.
  - These rank **above savings** in "What you can change": security first, then savings, then fixes.
- **Merchant grouping:** gateway variants of one merchant are grouped (Swiggy via PYU*/RAZ*/Cashfree…).
- **Categorisation:** word-boundary rules, priority-ordered (already in `categorize.ts`).
- **Recurring fixed-amount items named:** rent, SIP, premiums, allowance transfers.
- **Shared-expense detection:** same amount and date across people or cards → "Split with someone?"

## Business opportunities found in spending (brainstorm, 21 Oct)
Spends is where Munim learns what each person needs. It **finds** an opportunity and the owning tab acts on it. Every row must pass the rule above.

| What Spends notices | What the user gains | How a business could earn | Fit |
|---|---|---|---|
| Spent less than usual | Move the difference to savings | Grows the savings pot (priority 1) | Best: the habit itself |
| Expensive loan EMI | Lower rate (ask the current lender, or switch only if the net saving is positive after fees) | Lending partner fee, only when switching saves money | Strong. The worked example above shows when *not* to offer it. |
| Card fee paid or balance carried | A card that suits their real spending, or clearing the balance | Card referral fee | Good; watch for conflict of interest |
| No health or term premium in outgoings | Cover before investing (money path step 4) | Insurance partner commission | Good |
| Rent, insurance premiums, tax-saving investments | Tax saved at filing time | Tax-filing partner | Seasonal, concrete |
| Bills and recharges | Pay in one place | Small commission | Weak: UPI apps own this |
| Merchant offers based on spending | Discounts | Merchant-funded | **Rejected:** earns from more spending |

- ⚠ Not checked: referral and commission rates (no numbers used).
- Regulation to check before any real version: RBI digital lending rules (loans), IRDAI (insurance).

## Categorisation (user, 21 Oct)
- **Automatic first.** The user fixes only what looks off, using the shared fix sheet (docs/38, "Something's off?").
- **Learning from corrections is always asked, never silent.** For example: "You marked 3 Swiggy orders as shared. Treat future Swiggy orders as shared too?" (Yes / No thanks).
- **Rules** are listed in Your rules (edit, delete), apply only to the user's own data, and stay on the phone (D-036).

## Subscriptions
- Sorted by yearly cost. Flags: unused, price rise (with the yearly impact), trial became paid.
- Keep / Cancel marks are the user's own plan. **Munim doesn't cancel anything;** it shows how to cancel each one.
- Marking cancels → "Cancelling N saves ₹X a year" → "Save ₹Y a month instead" (savings first).

## Hindi variant
- The copy pack is in the mock. Category names come from `CATEGORIES[].hi`.
- ⚠ A native speaker must review the copy before any user sees it.

## Open
- Past-month view; the rest of the uncategorised sort flow (cash is done); search (later).
- Engine before build: `Interest` → income group; `incomeRange()` for irregular earners.
- Which events from docs/39 fire on Spends; add `spends_change_tapped` (fix type, rupee band), `save_difference_tapped` (amount band), `pace_how_opened`, `money_in_opened` (`earner_type`: salaried / irregular) and `skip_save_chosen` (`orders`: 1–3, `undone`).
