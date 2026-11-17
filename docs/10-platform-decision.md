# 10 · What kind of app, and web or mobile?

**Status:** v0.1 · **Last updated:** 2026-10-03 · Supersedes the short rationale in ADR-005

## 1. Decision
**Phase 1 is a mobile-first web app, installable as a PWA, that also works well on desktop.** No native app until one of the triggers in §5 fires.

## 2. What kind of app this is
| Dimension | Answer | Consequence |
|---|---|---|
| Category | **Portfolio intelligence**: read-only, explains and diagnoses | No KYC, payments or order flow in Phase 1; much smaller compliance surface |
| Money movement | None (D-007) | No transaction licence, no payment gateway |
| Usage frequency | **Low: monthly check-up + moments** (new CAS, market fall, tax season) | An app taking home-screen space for a monthly visit is hard to justify; the web suits "come when needed" |
| Core input | A PDF that arrives by **email** | Must be easy to get from Gmail (phone *and* laptop) into the product |
| Core output | Numbers + explanations + chat | Reads well on a phone; deep dives (tables, overlap matrix) benefit from a bigger screen |
| Data sensitivity | Very high | Trust signals matter: domain, privacy copy, app lock |

## 3. Evidence
| Fact | Source | Implication |
|---|---|---|
| **79.55%** of India's web page views come from mobile OSes (Android 74.63% + iOS 4.92%); desktop OSes 20.32% | StatCounter, India, Sep 2026 (sums computed) | Design for the phone first |
| On mobile, Android is **93.89%** and iOS **6.05%** | StatCounter mobile, India, Sep 2026 | Android-specific PWA features cover most users. ⚠ Affluent DIY investors likely skew more to iOS than average; check in interviews |
| PWAs can receive shared files ("Share to app") **only on Android/ChromeOS** after install, **not iOS** | web.dev, PWA OS integration | Android: share the CAS straight from Gmail. iOS: Files picker fallback |
| iOS web push needs **iOS 16.4+ and the site added to the Home Screen** | OneSignal iOS web push docs | Monthly reminders on iOS need install, or fall back to email reminders |
| Detailed CAS is delivered **by email within minutes**; monthly depository CAS also arrives by email | FundSageAI guide; AMFI CAS page | Email is the native channel; reminders by email are on-brand |
| Founder's goal includes a **portfolio piece** (D-002) | — | A link a recruiter can open in 5 seconds beats "install from Play Store" |

## 4. Options compared
| Criterion | **A. Mobile-first web / PWA** | B. Native (Expo / React Native) | C. Both from day one |
|---|---|---|---|
| Time to pilot | ✅ fastest; no store review | ⚠ store setup and reviews; finance apps may draw extra scrutiny | ❌ double the surface |
| Getting the CAS in | ✅ Android share target; desktop drag-drop; iOS file picker | ✅ share extension on both OSes | ✅ |
| Monthly reminder | ⚠ Android push OK; iOS needs install → **email fallback** | ✅ push on both | ✅ |
| Trust | ⚠ must earn it via domain, privacy copy, transparency | ✅ store presence helps | ✅ |
| App lock / biometrics | ⚠ passkeys / WebAuthn | ✅ native biometrics | ✅ |
| Voice (Phase 1.5) | ✅ browser mic APIs work | ✅ | ✅ |
| Recruiter / demo access | ✅ one link | ❌ install required | ✅ |
| Iteration speed on AI UX | ✅ deploy many times a day | ⚠ OTA updates help, but slower | ❌ |
| Fit with low-frequency usage | ✅ | ⚠ uninstall risk | — |
| Reuse of founder's stack | ✅ Next.js (LaborLink) | ✅ Expo (LaborLink apps) | — |
| **Verdict** | **Choose for Phase 1** | Revisit on triggers | Reject |

## 5. Triggers to build a native app (pre-committed)
Build the Expo app (sharing the same API) when **any** of these holds:
1. Interviews or pilot data show **≥ 30% of users are on iOS** *and* the iOS file-picker step is a top-3 drop-off in J2/J3.
2. 30-day re-upload rate misses target **and** users who enabled push re-upload significantly more than email-only users.
3. Phase 1.5 voice tests show the browser can't deliver acceptable latency or quality.
4. A partner (RIA / AA FIU) requires app-store presence.

## 6. What this changes in the build
- Responsive layouts designed at **360 px width first**; desktop gets a two-pane layout for x-ray deep dives
- PWA manifest + service worker; **Web Share Target** for `application/pdf` on Android
- Email as the default reminder channel; web push as an opt-in extra
- Passkey login option + idle timeout for an "app lock" feel
- Performance budget: first insight usable on a mid-range Android phone over 4G (budget to be set in S0)

## 7. Keeping a later move to native cheap
Rules for the Phase 1 build, so a native app later means rebuilding screens only:
1. **All business logic lives in the API** (FastAPI). The web app only renders and calls endpoints, so a native app reuses 100% of the logic.
2. **Shared contracts:** API types / zod schemas in `packages/shared`, importable by both Next.js and an Expo app.
3. **Auth via Supabase**, which has SDKs for both web and React Native; no web-only auth tricks.
4. **Design tokens** (colours, type scale, spacing) in one file, consumed by both.
5. **No browser-only dependencies in core flows** without a native equivalent noted (e.g. PDF picker → `expo-document-picker`; share target → native share extension).

Migration paths (rough estimates for one builder with AI help; to re-estimate when triggered):
| Path | What you get | Rough effort |
|---|---|---|
| Trusted Web Activity (Android) | The same PWA listed on the Play Store | Days |
| Capacitor wrapper (Android + iOS) | Store presence, native share extension, push, biometrics; UI unchanged | 1–2 weeks incl. store review |
| Expo / React Native rewrite of the UI | Fully native feel; reuses API, auth and shared types | 3–6 weeks for ~15 Phase 1 screens |
