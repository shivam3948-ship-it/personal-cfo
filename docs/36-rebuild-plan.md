# 36 · Munim v2: rebuild screen by screen (19 Oct 2026)

**Track:** the personal CFO (12 screens). The host-app voice layer keeps running from `apps/web/host` and reuses whatever v2 builds (the view-model pattern, core and voice).

**Where:**
- `apps/munim` is the new app.
- `packages/core` is the engine: 56 tests, the single home for maths, parsers and guards.
- `apps/web` is frozen as the reference. Delete it once v2 reaches parity.

## How every screen is built (the data flow)
`Session` (sample now, signed-in later) → `dataset()` → `lib/views/<screen>.ts` builds a typed view model from core (all maths here, unit-tested) → `GET /api/view/<screen>` → `useView('<screen>')` (loading, error and ready, the same everywhere) → components only render.

Every figure is a `Figure`: its text plus the math behind it (formula, parts, source files, as-of date), which powers "Show the math".

## Definition of done, per screen
1. The view model is unit-tested against the sample family and against an empty dataset.
2. Loading, error (with retry) and empty states are designed, not left as defaults.
3. Matches the design canvas at 390 px, in light and dark, with no sideways scroll.
4. Event names are added to `lib/analytics.ts` with the screen (the provider is wired last).
5. Every number traces to a source ("Show the math").
6. Typecheck, tests and build pass in CI.

## Order
1. ✅ Home (S03)
2. Invest (S04), including the CAS upload read in the browser
3. Talk (S11), the voice
4. Money (S05)
5. Subscriptions (S06)
6. Plan (S10)
7. Loans (S07)
8. Insurance (S08)
9. Credit (S09)
10. You (S12), files and actions
11. Welcome and consent (S01)
12. Sign-in (S02), with auth, onboarding and the analytics provider (last, D-031)

**Why this order:** first the moment of value (Home, the x-ray), then the differentiator (voice), then the depth screens, and the gates last. A session interface from day one means auth plugs in without touching screens.
