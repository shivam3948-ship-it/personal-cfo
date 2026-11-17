# 25 · Architecture review: is this a self-improving, voice-first, AI-native product? (16 Oct 2026)

**Verdict:** the trust foundations are senior-grade; the *self-improving loop* and the *real-time voice* layer are not built yet. Today it is a well-guarded AI product, not yet a learning one.

## What already matches a senior bar
| Area | Evidence in the repo |
|---|---|
| Numbers never come from the model | Engine in code (paise), tools return figures, number guard + one repair round (`lib/agent/guard.ts`, D-009) |
| Agent design | Tool-use loop with typed tools; actions are proposals with idempotency keys; host executes (`lib/host/agent.ts`) |
| Graceful degradation | Rules agent when Claude is down; browser speech when Sarvam is down |
| Privacy by design | CAS parsed on device; redaction before any LLM call; RLS per user/member; delete-all |
| Evals exist | Golden questions (`evals/questions.json`), live eval runner, 100+ unit tests, CI on every push |
| Decision hygiene | DECISIONS.md, trade-offs log, compliance rules for agents (AGENTS.md) |

## Gaps for "self-improving"
| Gap | Why it matters | Fix |
|---|---|---|
| **No feedback capture** (no 👍/👎, no "that's wrong", no correction log) | Nothing to learn from | Per-answer feedback + implicit signals (repeat question, abandon, action confirmed) |
| **No trace store** (agent traces are returned to the UI, then lost) | Can't debug or build eval sets from real use | Store redacted traces: input, intent, tools, numbers, guard result, latency, prompt/model version |
| **Eval set doesn't grow from production** | Evals drift from real questions | Weekly: sample failures → label → add to golden set → gate merges (tech/AI_EVALS.md) |
| **Versioning is thin** (one `PROMPT_VERSION` constant) | Can't compare versions or roll back by cohort | Version prompt + model + tool schema per response; flags for cohort rollout |
| **No experimentation layer** | docs/23 experiments can't run | Feature flags + event pipeline (discovery → first success → repeat) |
| **No online quality monitors** | Regressions found by users | Dashboards: guard-fail rate, fallback rate, STT confidence, latency p90, task success |

## Gaps for "voice-first"
| Gap | Fix |
|---|---|
| Turn-based request/response (record → upload → answer → TTS) | Streaming STT + streaming LLM + streaming TTS; first audio target < 1.5 s (⚠ set from measurement) |
| Barge-in and turn-taking only in the browser | Server-side VAD and interruption handling |
| No phone/WhatsApp channel | Telephony via a voice-agent platform (e.g. Sarvam Samvaad) on the same tools API |
| No latency budget instrumentation | Per-stage timings (STT, LLM, tools, TTS) logged per turn |
| Hindi/code-mix quality unmeasured | Speech eval set: recorded clips with noise, scored for word errors and intent accuracy |

## Structural debt
- **Engine duplicated** in `apps/voice-cfo` and `apps/web` (D-024): extract `packages/core` after Saturday. **Done:** `packages/core` is the engine for `apps/munim`; the two old copies are frozen (D-056, 26 Oct).
- **Docs ahead of code:** tech/ARCHITECTURE.md describes a FastAPI service that does not exist (D-024 chose a Next.js monolith); update the doc.
- **State per serverless instance** (in-memory caches): fine for a demo, needs a store (Redis/Postgres) for pending actions and sessions at scale.

## Target shape (after Saturday)
`channels (in-app SDK, web, WhatsApp, phone)` → `voice gateway (streaming STT/TTS, VAD, barge-in)` → `agent runtime (intent router: rules first, LLM for the rest; tools; guard; policy for advice boundary)` → `domain engine (packages/core)` → `data (RLS Postgres, host-provided state)`; alongside: `learning loop (traces → feedback → labelled evals → gated releases)` and `experimentation (flags, funnel events)`.

## Order of work
1. Trace store + feedback buttons + funnel events (1–2 days; unlocks everything else).
2. Weekly eval refresh from production failures; version every response.
3. `packages/core` extraction; update ARCHITECTURE.md.
4. Streaming voice pipeline and latency instrumentation.
5. Phone/WhatsApp channel on the same tools API.
