# 28 · Ship check: security and performance audit of apps/web (17 Oct 2026)

**Verdict:** safe to demo. There are no secrets in the repo. Every data route resolves the session on the server. Abuse of the money-spending routes (Claude, Sarvam) is now capped.

It is **not ready for real users' data at scale.** Rate limits live in each server instance's memory, there is no full Content Security Policy, and PDF statements are parsed on the server. Fixed items are marked ✅; the rest are open.

## Security (static review)
| # | Finding | Severity | Status |
|---|---|---|---|
| S1 | **No rate limit on routes that cost money.** Anyone could loop `/api/agent` (Claude), `/api/tts` and `/api/stt` (Sarvam). | High (cost) | ✅ `lib/ratelimit.ts` sets per-instance limits: agent 30/min, falling back to the free rules agent instead of refusing; host agent 60/min (Claude skipped over the limit); TTS 40/min; STT 20/min; upload 10/min |
| S2 | **TTS accepted text of any length,** so one request could cost a lot. | Medium | ✅ capped at 800 characters (413 above that) |
| S3 | **Anonymous session ids could be 4 characters,** so they were guessable, and requests with no id shared one bucket (`anon`). | Medium | ✅ anonymous ids now need 16–64 characters (the browser makes a UUID). Uploads are refused for `anon`. Signed-in ids keep `_`, which anonymous ids can't contain |
| S4 | **The agent's 500 response returned the provider's error message.** | Low | ✅ the response is now generic; the detail goes to the server log only |
| S5 | **Clickjacking:** the app could be framed by another site. | Low | ✅ `X-Frame-Options: DENY` and a CSP with `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` |
| S6 | **`npm audit`:** postcss below 8.5 inside `next` (GHSA-qx2v, -6g55, -fxqj, -r28c; 1 moderate, 1 high). | Low (build-time only; our own CSS) | Open: the fix is Next 16, a breaking upgrade. Upgrade after Saturday |
| S7 | **No full script CSP.** Next's inline scripts need a nonce. | Medium | Open: add a nonce-based CSP before public beta |
| S8 | **Rate limits are per instance.** On Vercel they reset whenever a new instance starts. | Medium | Open: move to a shared store (e.g. Upstash Redis) before public beta |
| S9 | **Statement uploads (CSV/TXT/EML/PDF) are parsed on the server.** Text is redacted before any LLM call, but files still reach the server. (The CAS PDF stays on the device.) | Medium (privacy) | Open: beta copy says to use test or masked statements. Move parsing to the device, or use Account Aggregator, before real users (D-017, D-018) |
| S10 | **Secrets scan:** no keys or tokens in tracked files. `.env*` is git-ignored except `.env.example`. | n/a | ✅ checked with `git grep` |
| S11 | **Authorization.** Every route calls `resolve()`. Signed-in reads go through Supabase as the user, with row-level security. Member ids from the client are ownership-checked. | n/a | ✅ reviewed; cross-tenant tests exist in `tests/web-api.test.ts` |
| S12 | **Prompt injection.** User and document text is treated as data. The host prompt says to ignore instructions inside it. Numbers are checked against tool results. | Medium | Partial: no red-team eval set for the host agent yet (see docs/30) |

## Performance
**Measured on the production build in the cloud container** (`next start`, warm). Claude and Sarvam aren't configured there, so the agent ran on the rules path:

| Request | Time |
|---|---|
| `/api/summary` (12 tools on the sample family, 24.5 KB) | 0.14 s cold, **0.06 s** warm |
| `/api/agent`, rules path | **0.01–0.02 s** |
| `/api/host/agent`, rules path | **0.007–0.011 s** |
| Home page HTML (9.4 KB) | 0.02 s |

**First-load JavaScript** (from the build):

| Page | Size |
|---|---|
| Shared by every page | 103 KB |
| Heaviest page, `/talk` | 155 KB |
| `/host` | 112 KB |

No page goes over 160 KB.

**Not measured** (needs your keys, so it can only run on your Mac or Vercel):
- the Claude round trip;
- Sarvam speech-to-text and text-to-speech latency.

Time three spoken questions on the venue Wi-Fi before going on stage; the first sound should come back within about 3 seconds. ⚠ That target is a guess, not a benchmark.

## Ship checklist for today
- [x] Tests: 145 passed, 15 skipped (the live-key tests).
- [x] Production build passes; types check clean.
- [x] Fallbacks:
  - no Claude key → rules agent;
  - no Sarvam key or a Sarvam error → browser voice;
  - over the rate limit → rules agent.
- [ ] On the Mac: `npm run dev`, then open `/host?s=late`, `/talk` and `/research/bachatt` once each with Chrome's mic permission granted.
- [ ] Keep a phone hotspot as backup network.
- [ ] Remember the typing box on Talk if the mic fails.
