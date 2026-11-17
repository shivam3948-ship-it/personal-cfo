# 42 · Invest tab: design rules (21 Oct 2026, v1 mock)

**Job:** "Is my money safe, then growing, and what's my next move?" It is not "how are my funds doing?". Most of our users (the earlier stage, D-035) save before they invest, and many invest without a cushion. The sample family is the pattern:
- ₹12.8 lakh in mutual funds and a ₹10,000 SIP;
- but ~1.7 months of essentials in the bank;
- and spending above income on average over the last 3 months.

Mock: the Munim v2 canvas, page **Invest** (Tweaks: `cas` added/none, theme, state, variant).

## Decisions (D-040, user 21 Oct)
- **Emergency fund = 6 months of essentials.**
  - Essentials = fixed costs (rent, EMIs, insurance) + family support + groceries, utilities, fuel and mobile.
  - It is averaged over complete months: sample ₹83,414 a month, target ₹5,00,484.
  - Not counted: food delivery, dining, shopping, subscriptions, travel. These can be paused in a hard month.
- **Debt and liquid funds count**, shown as a separate, lighter part of the bar: "takes a few days to withdraw". With them the family has ₹2,70,726 (3.2 months); without a CAS, the bank balance alone gives 1.7 months.
- **The next move opens the tab.** The portfolio comes second.

## Screen order (v1)
1. **Your next move · step 3 of 5:** "Grow your emergency fund to 6 months".
   - The two-part bar; "₹2,70,726 of ₹5,00,484 · 3.2 of 6 months".
   - "Essentials ₹83,414 a month · what counts?" opens a sheet with each category's average, the target and what's left out.
   - **Why this step now:** the Orbit loan can't be prepaid until 20 Dec, so spare money goes here first (engine `foundationPlan`).
   - **Add on salary day each month:** ₹5,000 / ₹10,000 / ₹20,000, each showing "ready in N months", with nothing preselected. "Plan ₹10,000 a month" → "✓ ₹10,000 every 1st · ready by Sep 2028", with Change. No money moves; Munim reminds on salary day.
   - "Saved with Munim: ₹0 · daily saves from your check-in land here", linking to Today. This is the savings pot docs/38 gave Invest.
2. **Mutual funds** (from the CAS):
   - value ₹12,78,285, gain +₹4,31,285, 14.2% a year. "How?" explains XIRR in plain words: "a yearly rate that accounts for every SIP's date and amount, comparable to an FD's rate"; past returns don't promise future ones.
   - the equity/debt split, with the debt part "also counted in your emergency fund";
   - the SIP;
   - **3 funds are regular plans, about ₹8,349 a year in extra fees.** The sheet shows each fund's estimate and what to check before switching (capital-gains tax, the ELSS 3-year lock-in, exit loads). The fee gap is an estimate (engine `TER_GAP_ESTIMATE`); check each fund's actual TER;
   - the fund list with the plan (Regular in amber, Direct in teal) and each fund's return;
   - "Holdings look wrong? Add a newer statement".
   - **No CAS yet:** an "Add your mutual funds" card; the bar then uses the bank balance only.
3. **Protection** (facts from the policy documents):
   - **Term:** ₹1 crore = 5.7× yearly income; a common rule of thumb is 10×, so it's tagged "Below rule of thumb".
   - **Health:** a ₹10 lakh floater for 3; the father turns 60 within 2 years, then pays 20% of each claim. Tagged "Review".
   - **Endowment:** ₹5,000 a month, with a projected 0.5–4.6% a year from the insurer's own illustration (not guaranteed). Tagged "Know your return".
   - **Never "surrender this policy"** (AGENTS.md rule 1): "Munim doesn't advise on surrendering a policy; a licensed adviser can."
4. **Your money path** (the full path, D-037), "Guidance, never a gate":

| Step | Status |
|---|---|
| Buffer | ✓ Done |
| Costly debt | Waiting until 20 Dec (card paid in full ✓; Orbit 13.5%: ask to match 11.25%) |
| Emergency fund | You're here |
| Insurance check | Next |
| Invest more | Later; you already invest ₹10,000 a month |

5. Footer: "General guidance, not SEBI-registered investment advice."

## Numbers (all from packages/core; the mock computes them from engine inputs)
| Figure | Source |
|---|---|
| Bank ₹1,41,764 | `latestBankBalance` |
| Essentials ₹83,414 a month | `monthPictures`: Jul ₹93,975 · Aug ₹80,084 · Sep ₹76,183 |
| Debt fund ₹1,28,962, MF ₹12,78,285, gain ₹4,31,285, XIRR 14.2%, extra fees ₹8,349 | `portfolioView` on the sample CAS |
| Term 5.7×, endowment 0.5–4.6% | `foundationPlan`, `policyView` |
| Months to target (e.g. ₹10,000 → 23) | ceil(gap ÷ amount) |

⚠ **Rounding:** paise amounts ending in 50 round half-up (₹12,78,284.50 → ₹12,78,285). An earlier chat message said ₹12,78,284 because the script used Python's half-to-even rounding. The build must use one rounding rule everywhere.

## Engine changes needed before the build
- `emergencyFund()` uses every outflow today. Switch it to essentials (D-040), and **spread yearly premiums over 12 months**. July's ₹18,900 health premium currently lifts the average.
- Count debt and liquid fund value from the CAS as a separate part.
- Today's mock now uses the same figures (essentials ₹83,414; emergency fund ₹2,70,726 of ₹5,00,484).

## Open
- **Where the savings pot's money actually goes** (docs/37 §8): still undecided.
- **Insurance step:** a deeper screen for term and health.
- **Goals and tools:** goals, FIRE and the insurance calculator may move here from Today.
- **Hindi copy:** a native speaker must review it.
- **Ideas from the JM Financial playbook review** (B1–B10, docs/research/jm-playbook-review.md): waiting for Shivam to pick. Recommended: nomination check, step-up SIP from salary rises, risk capacity vs appetite.
- **Events to add to docs/39:** `invest_plan_chosen` (amount band, months), `essentials_opened`, `xirr_explained_opened`, `regular_fees_opened`, `holdings_wrong_tapped`, `cas_add_tapped`.

## v2 (current, D-041, 21 Oct): option B with A's guard
- **Screen:** investing card → spare money (with money-path position, "Step 3 of 5 ›") → cover row. Without a CAS: next move → Add CAS → cover. States: loading, error, empty; light and dark. ⚠ The Hindi variant for v2 and the x-ray is still to do.
- The v1 "Screen order" above is kept as history.

### How we chose (options explored)
**User's priorities:**
- P0 is "Is my investing working?" (overpaying is part of it); first-time savers see the next move first;
- P1 is spare money;
- P2 is cover.

**The three options:**
- **A (Claude):** safety first while the safety steps are open; the order follows the money-path step. Shown: path strip, next move, investing, cover.
- **B (Shivam):** investing first for anyone with a CAS; next move first without one.
- **C:** v1.

**Shared by A and B:**
- 3–4 compact cards; detail moves into sheets (plan, path, cover) and the **Portfolio x-ray** screen;
- "Ask Munim" entry points on the investing card, the cover sheet and the x-ray.

**Your money vs your funds** (docs/09 J4, P2), now in the x-ray:
- **"Fund"** = the fund's own growth from your first purchase to today, from the CAS's own NAVs (what factsheets advertise).
- **"You"** = your XIRR.
- **Sample:** ahead on 3 of 5 (Kestrel +2.3, Banyan +5, Monsoon +2.5 points), about even on 2; no SIP pauses or sells since Jan 2021.
- **Honest caveat shown in the UI:** SIP returns can beat the headline after a fall and recovery. Being ahead isn't skill; pausing in falls is what puts investors behind.
- **Engine:** `fundGrowth()` from the first and last CAS NAV per scheme, plus SIP-gap and sell detection from the CAS flows. Not in packages/core yet.

**Not yet:** fund overlap (needs AMFI holdings, D-OPEN-3) and the benchmark comparison. Both are shown as "Soon".

## v2.1 (22 Oct): design holes closed, ready to build
- **Add CAS sheet:** 3 steps (ask CAMS/KFintech or MF Central for a detailed CAS → set a password → choose it here), "Choose the CAS PDF", "Try with the sample CAS"; on success a toast "5 funds added from your CAS". ⚠ Verify the request steps against each RTA's current flow before launch.
- **Holdings look wrong?** under the investing card: "A fund is missing / A value looks off / A fund isn't mine", each with a one-line reason and "Add a newer CAS". ⚠ The demat line (demat-held units sit in the NSDL/CDSL statement) needs a check against a real CAS.
- **Cover review actions:** term "To reach 10×: about ₹74,00,000 more cover (₹1,74,00,000 on ₹17,40,000 a year)", computed in the mock from income and sum assured; health "Before the co-pay starts: at renewal, compare a top-up or a plan without co-pay for parents"; "Review this on Sunday's money call" (✓ + Undo). Category level only.
- **Saved with Munim ₹0** row restored in the spare-money card, linking to Today.
- Tweak `open` (none/plan/path/cover/cas/holdings) opens any sheet directly for review. Snapshot of v2: InvestV2b (History page).
- Hindi for Invest and the x-ray moves to after the v1 build.

## X-ray v2 (22 Oct, mocked, awaiting review)
v1 described the portfolio; v2 leads with 4 insights, each with a rupee figure, a next step and, where one exists, a deadline:
1. Tax-free gains before 31 Mar;
2. Regular → direct, net of the cost of switching (new SIPs first, at ₹0);
3. ELSS out of lock-in;
4. Fund vs a plain index fund on your SIP dates.

"Your money vs your funds" and "What you own" are now collapsible below the insights. Competitor scan and numbers: docs/research/portfolio-insights-competitors.md, docs/research/xray_v2_numbers.py. Snapshot: XrayV1 (History page).

## X-ray v3 (22 Oct, last mock before the build)
- **Five insight cards, kept short.** Each has a title with a ₹ figure, a one-line why, a main button and "+ Sunday call". The math and the options sit behind "Details ›".
- **The cards:**
  1. Tax-free gains before 31 Mar;
  2. Regular → direct (start with new SIPs, ₹0);
  3. **Fund overlap (new)**: Banyan and Teak share 45% of their stocks, 7 stocks sit in 3 of the 4 equity funds, and the top 5 stocks make up 29.3% of equity. Also notes that Teak is an active regular plan that is 45% index-like;
  4. ELSS out of lock-in;
  5. Monsoon vs a plain index fund.
- **"Did it work?" (new)** sits under the summary. The empty state says what Munim will track. A preview (tweak `history`) shows what card 1 and card 2 would show after 3 months: ₹546 less in fees so far, ₹15,602 less tax later, ₹21,000 of SIPs into direct plans.
- **Also added:**
  - an FD comparison in the summary: ₹2,39,089 more than a 7% FD on the same dates (before tax; the 7% is an assumption);
  - a save/share report button (PDF, with an option to hide amounts);
  - Ask Munim suggestion chips;
  - "read on your phone" in the header.
- **Data gap:** the overlap figures use **synthetic sample holdings**. The build needs AMFI monthly portfolio disclosures (D-OPEN-3).
- Numbers come from `docs/research/xray_v3_numbers.py`. Snapshot: XrayV2 (History page).

## Invest v2.2 (22 Oct)
- **Investing card:**
  - "14.2% a year · ₹2,39,089 more than an FD";
  - one verdict line;
  - one X-ray summary row ("5 things worth acting on · ₹15,625 less tax · ₹8,349 a year in fees ›");
  - the CAS line.

  Removed: the endowment row (it lives in the cover row) and the in-card Ask Munim (D-042).
- **Spare money card:** the kicker and the "step 3 of 5" link are merged, and the pot row is one line.
- **Ask Munim:** the floating button is now on every sub-screen (D-042).
