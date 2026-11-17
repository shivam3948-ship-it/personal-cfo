# 40 · "Bharat" variant: tier-2 and tier-3 cities (19 Oct 2026, proposal)

**User's goal:** a version of Munim for tier-2 and tier-3 cities, with different nav copy and features.

## Recommendation: one app, a variant switch, not a second app
- **Same codebase, screens and engine.** The variant changes **copy packs, defaults and feature flags**, so fixes and compliance work ship once.
- **Choosing the variant:** chosen by the user (language and "simple mode" at onboarding, changeable in settings), seeded by app language.
  - **Never inferred from location or income.** Labelling people by city is inaccurate and can feel patronising.
- **Mock:** Today v15 has a Tweaks `variant` switch (`standard` / `bharat`).

## Nav copy (mocked)
| Standard | Bharat (Hindi) | Why |
|---|---|---|
| Today | आज | — |
| Invest | निवेश (invest) | Chosen by the user (19 Oct): बचत is avoided for now because it is close to the Bachatt brand name. Watch whether "निवेश" intimidates first-time savers in testing |
| Ask Munim | मुनीम से पूछें | — |
| Spends | खर्च | — |
| Credit | उधार | Everyday word for borrowing. ⚠ "लोन" may test better for formal loans; test |

- Other languages come later through the same copy packs: Marathi, Bengali, Tamil, Telugu, Kannada and others, in priority order from user data.

## Feature differences (flags, all to validate with users)
| Area | Standard | Bharat |
|---|---|---|
| Input | Tap first, voice in the centre | **Voice first**: the check-in can be done fully by voice; Hindi and Hinglish by default |
| Data in | Bank statement, CAS, SMS | **SMS and UPI first** (Android). CAS is optional, since many users won't have mutual funds yet |
| Saving amounts | ₹20 / ₹50 / ₹100 | **₹10 / ₹20 / ₹50** daily, plus Other; one-time saves from ₹10 |
| Saving destination | Undecided (docs/37 §8) | Same decision, but **digital gold and RDs may matter more**. Validate before choosing; no product picks before the licence |
| Credit tab | Cards, EMIs, credit score | **Loans and EMIs first**, informal-loan tracker (money lent or borrowed from family), and fraud and loan-app safety tips |
| Recaps | Sunday call | Same, shorter (about 60 seconds), **WhatsApp share** as a voice note |
| Device | — | Lite mode: low data, older Android, offline-first cache |
| Advice | Ladder in docs/12 | Same ladder. Rung 1 (generic guidance) carries more weight here |

## Open
1. Research before building: 10–15 interviews in 2 tier-2 or tier-3 cities, plus the Play Store review analysis already done (docs/26, docs/27).
2. Does the variant need its own Today verdict style? For example, plainer numbers, and "₹" before every amount spoken aloud.
3. ~~The tier-2/3 segment was parked in D-015. Confirm the priority.~~ **Resolved by D-054 (26 Oct): the tier-2/3 first-time saver is the primary user.** Whether "Bharat" becomes the default rather than a variant is still open.
