# 21 · Munim app: build spec (v1, 16 Oct 2026)

**Status:** building · **Decisions:** D-024 to D-028 · **Mock screens + journey:** Design canvas "Munim app screens" (claude.ai artifact, private; share from its Share menu) · Journeys in depth: [09](09-user-journeys.md)

## 1. What v1 is
The full personal-CFO app in one mobile-first Next.js app (`apps/web`), built on the engine, tools, guard and voice that already work in `apps/voice-cfo`. Signed out: the sample family. Signed in (phone OTP): your own data, saved per user under row-level security.

## 2. User journey (Rohan, first week)
| # | Stage | Screen | Munim does | Measure |
|---|---|---|---|---|
| 1 | Discover | 01 | One promise; "Try the sample family" with no sign-up | Welcome → sign-in |
| 2 | Sign in + consent | 01–02 | Phone OTP; 3 consents (analyse, AI, voice); AI-use disclosure; CAS stays on the phone | Consent completion |
| 3 | Bring data | 04, 12 | CAS opened in the browser with its password; statements, SMS, policies, credit report; checks per file | Time to first data; parse success |
| 4 | First aha | 03 | Net worth, surplus, top 3 by ₹ impact | Time to first insight < 3 min |
| 5 | Understand | 04–09 | "Show the math" + source on every figure | Show-the-math opens |
| 6 | Decide | 10 | Foundation-first plan, guided mode, disclaimer | "I'll do this" taps |
| 7 | Act | 06, 12 | Drafts and reminders; nothing sent without the user | Actions → verified (NSM) |
| 8 | Talk + return | 11 | Sunday Money Call by voice, Hindi/English | D7 / D28 return |

## 3. Screens
| # | Screen | Route | Data |
|---|---|---|---|
| 01 | Welcome + consent | `/welcome` | consents |
| 02 | Sign in (phone OTP) | `/signin` | Supabase auth |
| 03 | Home | `/` | net worth, top 3, tiles |
| 04 | Investments (CAS x-ray) | `/invest` | holdings, mix, XIRR, regular-plan cost (estimate) |
| 05 | Money | `/money` | month picture, categories, dues before salary |
| 06 | Subscriptions & leaks | `/money/subscriptions` | recurring, leaks, actions |
| 07 | Loans | `/loans` | status, offers, prepayment |
| 08 | Insurance | `/protect` | policies, cover, illustrated return |
| 09 | Credit | `/credit` | score, factors, steps |
| 10 | Plan | `/plan` | foundation plan (guided) |
| 11 | Talk | `/talk` | voice agent over all data |
| 12 | You (actions, family, files, privacy) | `/you` | actions, members, uploads, consents, delete |

Bottom nav: Home · Money · Invest · Plan · Talk. Loans, Insurance, Credit, Subscriptions open from Home tiles; You from the avatar.

## 4. Data and privacy
- Tables (Supabase, RLS `user_id = auth.uid()` on every one): `profiles`, `members`, `consents`, `datasets` (per member: pseudonymised parsed data as JSON), `holdings` (per member, from CAS), `actions`. Delete-my-data removes every row for the user.
- The CAS PDF and password never leave the browser; only holdings (scheme, ISIN, units, NAV, value, cash flows) are sent. PAN, name, email and folio numbers are dropped before upload.
- Statement uploads go through the existing server parsers (mock data at the event; real-data path needs the D-020 exception closed first).

## 5. Known gaps (v1)
- Expense-ratio gap is an **estimate** (0.9% equity, 0.5% debt); AMFI TER data is not wired yet. Fund overlap is out.
- CAS parser is built against a synthetic CAMS-style sample; it must be checked on a real CAS on the user's own machine before anyone relies on it.
- Phone OTP needs an SMS provider + DLT for real numbers (D-028).
