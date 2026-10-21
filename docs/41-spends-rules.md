# 41 · Spends tab: design rules (21 Oct 2026, v1 mock)

**Status:** design. Mocks "Spends v2" (v1 kept), "All transactions v1", "Subscriptions v1" and "Your rules v1" are on the Munim v2 canvas, with Tweaks for theme, state and variant.
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
- Identity never relies on colour alone: there's a legend for the two lines, and direct values sit under the split bar.

## Screen order (v2)
1. **Hero:**
   - everyday spending, the pace line and the pace chart;
   - the split bar (Everyday / Fixed / Others, with the month's total);
   - "Show the math" (the pace months and the Not counted amount).
2. **What you can change**, collapsible and **collapsed by default**:
   - The header shows a summary ("Save ₹3,500 · 4 more fixes").
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

## Business rule (user, 21 Oct; D-038)
- **Priority:** 1. grow savings, 2. revenue per user.
- **Earn only when the user measurably saves.** Every offer shows the net saving, computed from their data, and says if Munim may earn a fee. The test is "would we show this if we earned nothing?"
- **Spends finds opportunities; the owning tab acts on them.** Loans go to Credit; insurance and tax go to Invest.
- **Rejected:** merchant-funded offers that make money from more spending.
- **Worked example (in the mock):**
  - Moving the Orbit Finserv loan (13.5%, ₹2,35,916 outstanding) to a hypothetical 11.5% lender would **lose ₹10,710**: interest saved ₹5,993, minus the 1% fee with GST (₹2,784) and foreclosure charges (₹13,919). Switching is also only allowed from 20 Dec.
  - So Munim shows **"Ask Orbit to match 11.5%: saves ₹5,993"**, labelled "Munim earns nothing from this", and no refinance offer.
  - Computed with `compareRefinance`. The 11.5% offer is illustrative.

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
- The month switcher, the category detail screen, and transaction search and list.
- Which events from docs/39 fire on Spends; add `spends_change_tapped` (fix type, rupee band) and `save_difference_tapped` (amount band).
