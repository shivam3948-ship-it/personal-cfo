# 38 · Today screen: layout rules (19 Oct 2026)

**Status:** design rules. Nothing is built yet.
- Mock: "Today v8" on the Munim v2 design canvas. It has Tweaks for `scenario` and `bills`.
- Autopay logic: docs/37.

## Design goals, in priority order (user, 19 Oct)
1. **Minimise cognitive load.** One decision at a time.
2. **Minimise motor load.** Fewest taps, big targets, thumb-friendly.
3. **Minimise visual load.** Fewest boxes and colours on screen.

## Section order (dynamic)
| Context | Order |
|---|---|
| A bill is **due soon** | Verdict → **Today's check-in** (the bill is one of the 3 cards) → Big picture → Recaps → Tools |
| A bill is **pending, not urgent** | Verdict → Today's check-in → Big picture → **Pending bills** → Recaps → Tools |
| **All bills paid** this cycle | Verdict → Today's check-in → Big picture → Recaps → **Paid bills** (quiet, no card) → Tools |
| **Sunday** / **salary day** | The check-in card is replaced by the Sunday Money Call / "Close your month" card, which counts as that day's check-in |

- **"Due soon" = due within 3 days** ⚠ (a proposal; tune with data).
- A due-soon bill takes the check-in's "One fix" slot: an unpaid bill beats a subscription leak.
- If several bills are due soon, show the earliest one; the rest are listed on the card.

## Check-in card rules
- **One card at a time.** Progress is shown as 3 small dots in the card header (tappable, 44 px hit area), not as buttons.
- **Each card:** a kicker, a title, one line of detail, **one full-width primary button**, and **one quiet text option**. Nothing else on the card should look tappable.

| Card | Primary | Secondary (text) |
|---|---|---|
| Save (autopay off) | Turn on autopay | Not now |
| Yesterday | Looks right | Something's off? |
| One fix | e.g. Show me how to cancel | I still use it |
| Bill due soon | Pay now | Remind me tomorrow |

- **Advance:** doing either action completes the card and moves to the next one automatically.
- **Order** follows autopay state (docs/37 §6): Save first while autopay is off.
- **Amount:** pre-set to ₹50 a day. "Change amount" opens the chips only when tapped.

## Verdict line
- One sentence plus one short reason, computed by rules, not by the AI. Examples:
  - "Bills covered · spent below a usual day"
  - "Card bill due in 2 days, and you can cover it"
  - "All bills paid · spent below a usual day"

## Open
- Whether Tools stay on Today or move behind a "More" row (visual load).
- Thumb-zone test: is the check-in's primary button reachable one-handed on a 6.1" phone?

## Phase 2 (not now): variable daily actions, so the check-in never gets boring
**Why:** the same three cards every day become wallpaper within a few weeks.
- Variety keeps the habit alive.
- The variety must come from **real changes in the user's money**, never from invented urgency or slot-machine tricks.
- **Layout stays fixed.** The card structure and the three slots never change, so cognitive load stays low.

**Card pool.** Every card needs a real number from the user's data and "Show the math".
| Type | Examples |
|---|---|
| Spending | Yesterday review · a category spiking against a usual week · a first-time merchant · weekend vs weekday |
| Saving | Turn on autopay · save the underspend · goal milestone · salary-day raise (docs/37) |
| Bills and credit | Bill due soon · card usage over 30% of the limit · EMI tomorrow · check your autopay mandates |
| Leaks | Unused subscription · price rise (e.g. Netflix ₹649 → ₹799) · duplicate charge · bank fees |
| Investments (weekly at most) | Regular-plan cost · SIP date · statement refresh reminder |
| Protection | Policy renewal · nominee missing · cover check |
| Learn in 60 seconds | One idea tied to their data, e.g. "What's an expense ratio? Yours cost ~₹8,349 a year" |
| Guess and reveal | "Guess last week's food delivery spend" → the real number |
| Celebrate | ₹1,000 saved · 30-day streak · a subscription cancelled |
| Family | A parent's SIP or premium due (with consent, docs/11) |

**Three slots, each with a job:**
1. **Must do:** the most urgent item (a bill due soon, or Save while autopay is off).
2. **Best fix:** the highest rupee impact this month.
3. **Fresh:** a rotating learn, guess, insight or celebration card.

**Picking logic (proposal):**
- `score = urgency × rupee impact × freshness × personal fit`.
- **Freshness:** a card type shown in the last N days ranks lower.
- **Personal fit:** types the user skips often rank lower, and types they act on rank higher.
- **Guardrails:**
  - no two cards of the same type on one day;
  - at most one learn or guess card a day;
  - no investment cards more than weekly;
  - on a quiet day, show **2 cards**, never filler.

**Measure:**
- check-in completion rate;
- D7 and D30 retention;
- skip rate by card type;
- time to finish;
- "Something's off?" rate (a trust signal).

A/B test the "Fresh" slot against a fixed slot before rolling it out.
