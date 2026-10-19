# 37 · Daily save and autopay: product logic (19 Oct 2026)

**Status:** design spec. Nothing here is built.
- Autopay is a **fake door** until a money partner is integrated. The button records intent ("Reserve my autopay") and says plainly: "Munim doesn't move your money yet."
- Mocks: the Munim v2 design canvas. "Today v6" has a Tweaks `scenario` switch (`new`, `day4`, `autopayOn`, `debitFailed`), and the "Sunday Money Call" board shows the weekly recap.

**Goal:** turn saving into a daily habit and move as many users as possible to autopay, without dark patterns.
- Autopay matters because it is the money rail: it makes saving automatic for the user, and it is the distribution channel for savings products later (product vision, 19 Oct).

## 1. Autopay states
| State | Meaning | How it is entered | What Today shows |
|---|---|---|---|
| `off` | Never set up | Default | The Save card **comes first** in the check-in and asks for autopay |
| `reserved` | Tapped "Reserve my autopay" while it is a fake door | Fake-door tap | The Save card stays first. The ask is replaced by "Reserved ✓ · we'll tell you when it's live" plus "Just today" |
| `setting_up` | Mandate sent to the bank, awaiting approval in the UPI app | User starts the mandate | "Approve in your UPI app" with a deep link. If not approved after 24 h, one reminder ⚠ (to define) |
| `active` | Mandate live, daily debits running | Mandate approved | The Save step **ticks itself** and moves to **last**: "₹50 saved today ✓ · ₹X since <start date>" |
| `paused` | User paused | Pause (1 day, 1 week, or until resumed) | "Paused until <date> · Resume". After 7 days paused, one gentle resume nudge |
| `failed_today` | Today's debit failed | Bank decline (usually low balance) | "No ₹50 today. Your balance was low, so nothing was taken. No charge, and your streak is safe." Buttons: "Save ₹50 now" (one-time) / "Okay" |
| `stopped` | User revoked the mandate | Stop, or revoked from the UPI app | Back to `off` behaviour, but the ask is capped (§3) |

**Rule:** state changes only on an explicit user action or a bank/partner event. Munim never turns autopay on, raises it or resumes it by itself.

## 2. Amounts and the money shown
- **Autopay presets:** ₹20, ₹50 (default, shown in the card's title), ₹100, plus **Other**, an editable amount (₹10–₹5,000 a day ⚠; limits to confirm with the partner).
- **One-time save ("Save once"):**
  - **Nothing pre-selected.** Munim doesn't choose a one-off amount for the user.
  - Presets: ₹50, ₹100, ₹500, plus **Other**, an editable amount (₹10–₹1,00,000 ⚠; UPI and partner limits to verify).
  - The button stays "Choose an amount" until a valid amount is picked.
- Out-of-range input shows the allowed range in red. Nothing is rounded or changed silently.
- **Frequency:** daily for now. Offer weekly as a fallback after repeated failures (§4).
- **Yearly line:** amount × 365, labelled "before any returns". Computed in code:

| Daily | 30 days | Year |
|---|---|---|
| ₹20 | ₹600 | ₹7,300 |
| ₹50 | ₹1,500 | ₹18,250 |
| ₹100 | ₹3,000 | ₹36,500 |

- **Never** show projected returns on this card. That is advice territory, and the destination product isn't decided yet (§8).

## 3. When to ask for autopay (and when not to)
Every ask is a choice; none is pre-selected.
1. **Save card first** while the state is `off` or `stopped`. Card 1 is the only one every user sees.
2. **One autopay ask per day at most**, across the card, sheets and notifications.
3. **Frequency cap:** after **5 consecutive days** of "Save ₹50 once" or "Not now", stop asking daily. From then on, ask only on a *good day*:
   - yesterday's spend was below the usual day (§5); or
   - it is salary day; or
   - after a 3-day manual streak.
   ⚠ The numbers are proposals; tune them with data.
4. **3-day manual streak ask:** after 3 consecutive manual saves, the card becomes "You saved 3 days running · Make it automatic?" (mock: `day4`).
5. **Salary-day raise** (state `active` only): "Salary came in. Raise autopay by ₹10 a day?"
   - Asked at most once a month, never twice in a row if declined.
   - This is the "Save More Tomorrow" idea: commit the raise right after income arrives.
6. **Never ask** when:
   - Rescue mode is on (dues before salary exceed the balance);
   - the last 2 debits failed;
   - the user is in a family member's view;
   - within 7 days after a Stop.
7. **Copy rules:**
   - No fake urgency.
   - No "everyone is doing it" claims unless measured.
   - **User control, no dark patterns (19 Oct, v12–v13):** the card always shows three choices: "Set up autopay" (primary), "Save once" (one-time, no mandate, amount chosen by the user) and "Not now". The two text options have equal size. Declining needs no extra step and costs nothing (the streak still counts).
   - No confirmshaming ("No, I don't want to save"), no pre-selected options, no hiding the one-time option after repeated declines.

## 4. Daily cycle (state `active`)
1. **Pre-debit notice:** the bank or partner sends one; mirror it in-app ("₹50 will be saved tomorrow morning"). ⚠ Verify against RBI's e-mandate rules: as I understand them, a pre-debit notification is required before each recurring debit. If that means an SMS every day, consider defaulting to a weekly debit with a daily *display* of progress.
2. **Debit success:** the Save step auto-completes, and the running total updates.
3. **Debit failure:**
   - **No same-day retry** (avoids bank charges and anxiety).
   - The state becomes `failed_today` and the card explains it without blame.
   - After **3 failures in 7 days**, suggest a lower amount or weekly ⚠ (proposal).
4. **Low-balance guard:** skip the debit when the known balance after upcoming dues would go negative. Only if bank data and the partner allow a skip ⚠. Until then, don't promise it in copy.

## 5. Underspend top-up (state `active`)
- **Show when** yesterday's everyday spend is below the usual day by at least ₹100 ⚠ (threshold to tune).
  - *Everyday spend* excludes rent, EMIs, investments, transfers, card-bill payments, insurance and family support.
  - *Usual day* = the median of the last 30 days.
- **Suggested amount:** the difference rounded down to the nearest ₹10, capped at ₹500 ⚠.
  - Example from the sample family: usual ₹1,197 − yesterday ₹775 = ₹422, suggested ₹420 (computed in code).
- A **one-time** payment, separate from the mandate. Fake door until the partner supports it.
- **"Not today"** hides it for the day.

## 6. Check-in and streak
- **Check-in order:**
  - autopay `off`/`reserved`/`stopped`: **Save → Yesterday → One fix**;
  - `active`/`paused`/`failed_today`: **Yesterday → One fix → Save**.
- **The Save step is complete when** any of these happen:
  - "Reserve my autopay" → Done;
  - "Save once" with a chosen amount (fake door: "Tell me when I can save ₹X");
  - "Not now";
  - an auto-tick on a successful debit;
  - "Okay" on a failed debit.
  Saving is never required to finish the check-in.
- **Streak:** counts **check-ins**, not debits, so autopay users still have a reason to open the app daily. The exact counting rules are **deferred** (user decision, 19 Oct). Proposals to decide later: weekly goal of 5 of 7 days, streak freezes.

## 7. Controls (always one tap from the Save card)
- **Pause:** 1 day, 1 week, or until resumed.
- **Change amount:** takes effect from the next debit.
- **Stop:** confirm once, then revoke the mandate through the partner.
- No hoops, no "are you sure ×3". Easy exits are what make people trust turning it on.

## 8. Open questions (must be answered before building the real rail)
1. **Destination of the money:** liquid fund (needs an AMFI distributor registration or a partner), digital gold, a bank RD, or a partner's savings product. This changes copy, risk disclosure and licence needs.
2. **RBI e-mandate specifics:** pre-debit notice timing, additional-authentication thresholds, mandate limits. ⚠ Verify against the current RBI circulars and the partner's NPCI implementation; I'm not certain of the current figures.
3. **Default frequency:** daily (stronger habit) or weekly (fewer notices)? Decide from the notice rules in Q2.
4. **Minimum amount and partner fees.**
5. **Streak rules** (deferred).

## 9. Events (names now; provider wired last, D-031)
| Event | Properties |
|---|---|
| `save_card_shown` | `position` (1–3), `state`, `trigger` (default / good_day / streak3 / salary_day) |
| `autopay_cta_tapped` | `amount`, `trigger` |
| `autopay_reserved` | `amount` |
| `save_just_today` / `save_skipped` | `consecutive_count` |
| `autopay_mandate_started` / `_approved` / `_failed_setup` | `amount` |
| `autopay_debit_succeeded` / `_failed` | `amount`, `reason` |
| `autopay_paused` / `_resumed` / `_amount_changed` / `_stopped` | `from`, `to`, `duration` |
| `topup_shown` / `topup_tapped` / `topup_dismissed` | `suggested_amount` |
| `salary_raise_shown` / `_accepted` / `_declined` | `from`, `to` |

No PII in properties (AGENTS.md rule 4).

## 10. Metrics
- **Autopay intent rate** (fake-door stage): `autopay_reserved` ÷ users who saw the Save card. Track by trigger and position.
- **Activation:** approved mandates ÷ mandates started.
- **Autopay 30-day survival:** still active or paused, not stopped, after 30 days.
- **Average daily amount**, and the share accepting the salary-day raise.
- **Guardrails:**
  - stop rate within 7 days;
  - debit failure rate;
  - check-in completion rate (must not drop because of the Save ask);
  - complaints about the asks.

## 11. Weekly and monthly recaps that feed autopay
- **Sunday Money Call** (weekly, voice-first, about 2 minutes). Five beats:
  1. Win (autopay saved this week).
  2. Where money went.
  3. Next week's dues.
  4. Investments (weekly moves only once two statements exist).
  5. One decision.
  - Mock figures for the sample family, week of 9–15 Oct, all computed in code:
    - ₹17,163 spent, against a usual week of ₹9,290 (median of the last 8 weeks);
    - ₹12,039 due in the next 7 days;
    - ₹350 saved on autopay (scenario).
- **Close your month** (salary day, about 5 minutes). Steps:
  1. Report card.
  2. Net worth change with "Show the math".
  3. Subscription swipe.
  4. Card statement and credit check.
  5. Goal progress.
  6. Next month's plan, including the salary-day autopay raise (§3.5).
  - Ends with a shareable card that shows no rupee amounts.
