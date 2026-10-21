# 41 · Spends tab: design rules (21 Oct 2026, v1 mock)

**Status:** design. Mocks "Spends v1", "Subscriptions v1" and "Your rules v1" are on the Munim v2 canvas, with Tweaks for theme, state and variant.
- All figures come from `packages/core` on the sample family, as of 15 Oct.

## The job (user, 21 Oct)
"Where did my money go, and what can I change?" Search and the full transaction list come later.

## What counts (user, 21 Oct)
| Bucket | Categories | Shown as |
|---|---|---|
| **Everyday spending** | Food, shopping, dining, travel, fuel, bills, subscriptions, cash, fees | Hero number, against your usual pace |
| **Fixed costs** | Rent, loan EMIs, insurance | Small figure |
| **Family** | Money sent to family | Small figure, **kept separate** |
| **Not counted** | Transfers between your own accounts, card bill payments, investments | Small figure, with "Show the math" |

- **Usual pace** = the middle (median) of the last 3 months' everyday spending at the same day of the month.
  - Sample: Jul ₹17,119 · Aug ₹31,691 · Sep ₹48,957 → usual ₹31,691.
  - October to the 15th: ₹28,179, which is ₹3,512 below.
- **A yearly renewal landing this month** shows as "yearly charge", not a misleading % jump.

## Screen order
1. **Hero:** everyday spending, the pace line and the three small buckets.
2. **What you can change.** Savings come first.
   - **Save the difference:** ₹3,500, rounded down to ₹100, with "Other amount".
   - **Fixes, by rupee impact:** an unused subscription, a double charge, a trial that became paid, a loan rate.
3. **Where it went:** top 6 categories with bars and the change against usual. "See all".
4. **Links:** Subscriptions · Your rules · All transactions (search comes next).

## Business rule (user, 21 Oct; D-038)
- **Priority:** 1. grow savings, 2. revenue per user.
- **Earn only when the user measurably saves.** Every offer shows the net saving, computed from their data, and says if Munim may earn a fee. The test is "would we show this if we earned nothing?"
- **Spends finds opportunities; the owning tab acts on them.** Loans go to Credit; insurance and tax go to Invest.
- **Rejected:** merchant-funded offers that make money from more spending.
- **Worked example (in the mock):**
  - Moving the Orbit Finserv loan (13.5%, ₹2,35,916 outstanding) to a hypothetical 11.5% lender would **lose ₹10,710**: interest saved ₹5,993, minus the 1% fee with GST (₹2,784) and foreclosure charges (₹13,919). Switching is also only allowed from 20 Dec.
  - So Munim shows **"Ask Orbit to match 11.5%: saves ₹5,993"**, labelled "Munim earns nothing from this", and no refinance offer.
  - Computed with `compareRefinance`. The 11.5% offer is illustrative.

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
