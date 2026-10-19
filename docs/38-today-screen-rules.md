# 38 · Today screen: layout rules (19 Oct 2026)

**Status:** design rules. Nothing is built yet.
- Mock: "Today v11" on the Munim v2 design canvas (v8–v10 kept for comparison). It has Tweaks for `scenario`, `bills`, `theme` and `state`.
- Autopay logic: docs/37.

## Design goals, in priority order (user, 19 Oct)
1. **Minimise cognitive load.** One decision at a time.
2. **Minimise motor load.** Fewest taps, big targets, thumb-friendly.
3. **Minimise visual load.** Fewest boxes and colours on screen.

## Look (user choice, 19 Oct): Monsoon colours + editorial restraint
- **Colours:**
  - mist background (#F2F7F6), white cards with hairline borders (no heavy shadows);
  - one teal (#0F5E58) for **every** primary button and for good news;
  - marigold (#F2A93B) only for rewards: the streak, the flame and the "All done" state. **Never on a button** (v11, 19 Oct): against a white card marigold measures 2.0:1, under the 3:1 minimum for a button's edge (WCAG 1.4.11), while teal measures 7.6:1. This made the autopay button, the most important one, the weakest on screen.
- **Type:** serif display (Noto Serif + Noto Serif Devanagari) for the verdict and big numbers, IBM Plex Sans for everything else. A sans display is the fallback if the serif tests poorly.
- **Superseded looks** (kept on the canvas for comparison): Sunrise (v4–v8) and editorial white (v9).
- **Glass Night:** night mode only, not a default.

## Dark mode and screen states (v11, 19 Oct)
- **Dark is the same Monsoon system, not Glass Night.** Every colour is a named token with a light and a dark value. The mock's token sheet is the source for the build's CSS variables.
  - Dark values: background #0B1413, card #14201E, ink #E6F0EE, muted #93ABA6, button #5CC2B4 with dark text #06201C, link #7ED3C7.
  - Marigold stays #F2A93B in both themes.
  - All text pairs were checked in code at 4.5:1 or better: muted on card is 6.0:1 light and 6.9:1 dark, and the button is 7.6:1 light and 7.8:1 dark.
- **Every screen has the same four states,** switchable in Tweaks:
  - **ready.**
  - **loading:** a skeleton in the screen's own shape plus one plain line saying what's happening. No spinners.
  - **error:** keep the last good data on screen with a time stamp and a Retry, wherever there is data to keep. Never blank a screen that had numbers. Use a full error card only when nothing is cached.
  - **empty:** say when the thing will exist and what unlocks it. Give one button, never a dead end.
- **Built per component during the build, not in the mock:** skeleton timing (show after 300 ms), retry backoff, offline cache rules.
- **Event names for every screen:** docs/39.

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
| Save (autopay off) | Set up autopay | Not now |
| Yesterday | Looks right | Something's off? |
| One fix | e.g. Show me how to cancel | I still use it |
| Bill due soon | Pay now | Remind me tomorrow |

- **Advance:** doing either action completes the card and moves to the next one automatically.
- **Order** follows autopay state (docs/37 §6): Save first while autopay is off.
- **Amount:** pre-set to ₹50 a day. The amount chips sit in the autopay setup sheet, not on the card (v11), so the card has only two tappable things. The card's detail line says "Change the amount or stop anytime".
- **Label honesty:** the button reads "Set up autopay", not "Turn on autopay", because it opens a setup step (today a fake door: "Reserve my autopay", marked Coming soon).

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

**Rhythm rule (user, 19 Oct):** daily actions vary; weekly and monthly recaps keep a **fixed structure**, so they can be compared over time.
- Sunday call: always the same 5 beats in the same order. Only the numbers and the closing "one decision" change.
- Month close: always the same 6 steps, with the report card showing the last 3 months side by side.
