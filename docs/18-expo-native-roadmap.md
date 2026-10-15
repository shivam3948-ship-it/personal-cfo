# 18 · Roadmap: web app → Expo native apps

**Scope:** Munim (`apps/voice-cfo`) first, then the Personal CFO web app (`apps/web`), which follows the same path. This builds on docs/10 (the platform decision and the triggers for going native) and docs/10 §7 (migration rules).
**Principle:** keep one brain. The engine, parsers, tools and guard are plain TypeScript; native apps get a new shell, not a rewrite.

> Expo module names and behaviour below are from my knowledge as of mid-2026 and from the Expo docs pattern; **verify against the current Expo SDK docs** before each phase. Effort figures are my estimates for one builder with Claude Code, not measured.

## 1. Why go native, and when
| Trigger (docs/10 §5) | How it shows up for Munim |
|---|---|
| A habit that needs push notifications | The **Sunday Money Call** wants a weekly notification, and a reminder the day before each due date |
| Device integrations | Writing reminders into the calendar directly; the share sheet; the voice session surviving a locked screen |
| Distribution | Most of Bachatt's audience finds apps on the Play Store; a PWA install is a weaker funnel (assumption; test it) |
| Data access | Android SMS would remove manual uploads, but it is **policy-restricted** (see §5) |

Go native when the web MVP shows a weekly return habit (docs/05). Until then the PWA is enough.

## 2. What carries over
| Layer | Today (`apps/voice-cfo`) | Native plan | Reuse |
|---|---|---|---|
| Types, money, dates | `lib/types.ts`, `lib/money.ts`, `lib/dates.ts` | `packages/core`, as is | Full |
| Finance engine | `lib/finance/*` | `packages/core` | Full |
| Text/CSV/SMS/email parsers | `lib/ingest/{csv,parsers,json}.ts` | `packages/core` | Full |
| PDF text extraction | `unpdf` (Node) | Server endpoint first; on-device PDF later (needs a native module; evaluate) | Server-side |
| Agent tools, guard, prompt, offline agent | `lib/agent/*` | `packages/core`; the Claude call stays **server-side** (the key never ships in an app) | Full (logic) |
| Actions | `lib/actions.ts` (JSON file + .ics) | Native calendar write + share sheet; server keeps drafts | Rewrite (small) |
| Voice I/O | MediaRecorder + Web Speech | `expo-audio` record/playback → same `/api/stt` + `/api/tts`; `expo-speech` and a speech-recognition module as fallbacks | Rewrite (small) |
| UI | React DOM + CSS | React Native + Expo Router; same screens and states | Rewrite (design reused) |
| API | Next.js route handlers | Unchanged; the app calls them over HTTPS with auth | Full |

## 3. Phases
**N0 · Prepare the codebase (½–1 day, before any native code)**
- Move pure modules into `packages/core` (npm workspace); `apps/voice-cfo` imports from it. Rule: **no Node or DOM APIs in core** (lint with `no-restricted-imports` for `fs`, `path` and `window`).
- Replace the `x-sid` header with real auth (Supabase Auth, per ARCHITECTURE.md); the authz rule in AGENTS.md §3 applies to every endpoint.
- Add `/api/ingest-text`, so a phone can send extracted text instead of PDFs where possible (keeps D-017's on-device spirit).

**N1 · Expo thin client (2–3 days)**
- `apps/mobile`: Expo + Expo Router, TypeScript strict. Screens: Talk (mic hero + transcript), Actions, Data, Settings.
- Voice: record AAC/M4A with `expo-audio` → `/api/stt` (Sarvam lists MP4/M4A as supported); play the `/api/tts` audio. Fallbacks: `expo-speech` for TTS; a community speech-recognition module for STT (check maintenance status).
- Same states as the web UI: listening → transcribing → thinking → speaking, with barge-in.
- Builds: EAS Build development client; internal distribution to my phone plus 5 testers.

**N2 · Native actions (1–2 days)**
- Reminders → `expo-calendar` writes the event (ask permission in context: "Add to your calendar?"); the .ics stays as the web fallback.
- Email drafts → `expo-mail-composer`, prefilled; the user taps Send.
- Sunday Money Call → `expo-notifications` local weekly schedule (user picks the time); tap opens straight into the briefing.
- Due-date nudges: a local notification the day before each due, from `upcoming_dues`.

**N3 · Data on the device (2–4 days)**
- `expo-document-picker` for statements; parse CSV/text with `packages/core` **on the device**; send only categorised rows (D-017).
- Cache the dataset in `expo-sqlite`; session tokens in `expo-secure-store`.
- Offline mode: the rule-based agent runs entirely on the device (it is pure TS), so the app answers with no network, without voice (or with on-device TTS).

**N4 · Ship (2–3 days + store review time)**
- EAS Submit → Play internal testing → closed testing; TestFlight for iOS.
- Store declarations: financial-features questionnaire, data-safety form (what leaves the device, why), privacy policy; DPDP consent notice (docs/03).
- OTA updates with EAS Update for copy and prompt fixes; native changes go through review.
- Crash and latency telemetry without PII (AGENTS.md §4).

**N5 · Automatic data (later, gated)**
- **SMS:** Google Play restricts SMS permissions to approved use cases. I am not certain a budgeting app qualifies today, so **verify the current Play policy** before designing around it. iOS does not allow reading SMS at all.
- **Preferred route:** Account Aggregator via an RIA (D-018), which gives the same bank data with consent and works on both platforms.

## 4. Native risks
| Risk | Mitigation |
|---|---|
| Voice latency over mobile networks | Compress audio (AAC); short answers; stream TTS when Sarvam streaming is wired; show the transcript immediately |
| Background audio and locked screen | Keep sessions foreground-only in v1; set the audio mode explicitly |
| Store rejection for financial claims | Diagnosis-only copy (docs/03 boundary table); no "adviser" language; "Not investment advice" in the store listing |
| Two UIs drifting apart | Shared design tokens (colours, type scale) in `packages/core/tokens.ts`; one Figma page per screen |
| PDF parsing on the device | Server-side first; consider a native PDF module only if users demand offline PDF parsing |

## 5. Expo or Digia for the native shell?
[Digia](https://www.capterra.com/p/10033988/Digia/) (a buildathon co-host) is a low-code, **server-driven UI** platform for native apps: screens and flows change from the server without an app-store release. Capterra lists Web, Android and iOS; its free tier allows 1 app release and 1,000 monthly installs, paid tiers from $29/month (checked 2026-10-15).

| | Expo (React Native) | Digia (server-driven, low-code) |
|---|---|---|
| Reuse of our TypeScript core | Direct: same language, `packages/core` imported | None on the device; Digia screens call our HTTP APIs |
| Custom voice UX (record, silence detection, barge-in) | Full control in code | Depends on Digia's components or custom-code hooks (⚠ not verified) |
| Shipping UI changes | EAS Update for JS; native changes need review | **Its main strength:** UI changes without a release, good for fast copy and flow experiments with users |
| Lock-in | Open source | Vendor platform |
| For the **web** app | Not relevant (Next.js stays) | No advantage: we already ship web, mobile-first |

**Decision (D-023):** keep the **web app mobile-first in Next.js** (PWA, installable). For native, **Expo stays the default**, because our core is TypeScript and the voice UX is custom. **Digia is worth a spike** only if (a) the organisers' rules or judging reward it on Saturday, or (b) we need server-driven experiments on native onboarding flows. A Digia screen can consume `/api/agent` as-is, since the backend contract doesn't change.

## 6. Definition of done for "native v1"
- Talk → answer → action works in Hindi and English on a mid-range Android phone in ≤ 6 s per turn on 4G (measured).
- The Sunday notification brings the user back (track D7/D28 return; docs/05).
- Zero PII in logs (test); every spoken number passes the guard (same tests as web, now in `packages/core`).
