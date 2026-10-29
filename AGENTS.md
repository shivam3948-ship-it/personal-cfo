# AGENTS.md — working rules for any AI coding agent (Claude Code, Codex, Cursor, …)

## Project
Munim: an AI personal CFO for India. **Primary user: the first-time saver in tier-2 and tier-3 cities** (Hindi-first, small amounts, no mutual funds yet; D-054), who grows into an investor (D-035). Time-poor investors and families checking a parent's portfolio are later stages, not the design target. See docs/13 §8 and docs/11. Phase 1 = CAS upload → portfolio x-ray → grounded AI explanations + chat, plus an advice engine running only in internal/demo modes. Read `DECISIONS.md` first; it overrides anything stale elsewhere.

## Non-negotiables
1. **No fund recommendations outside advice mode (D-051, D-066).** The user's own funds may be named as facts; never an instruction to sell, switch, exit, redeem or stop any fund, SIP or policy they hold (named or by category), and never a fund or insurance product they don't hold. Suggest generic categories by horizon (liquid fund, well-rated multi-asset or hybrid fund, low-cost index fund); if pushed, say Munim doesn't have an investment adviser licence yet. Every recommendation carries "For education only, not investment advice."
   **Advice mode (`private`, D-066)** is the only exception: the owner turns it on (`MUNIM_ADVICE=on` + `MUNIM_ADVICE_KEY`), and only browsers that opened `#advice=<key>` (an httpOnly cookie holding a keyed hash of it) get it. It may name funds and insurance products to buy ONLY from `lib/server/advicePicks.ts` (owner-chosen, dated; never from the model's memory; enforced by the prompt, the picks-only tool and the answer check: the word patterns in `lib/agent/tradeWords.ts` and `brands.ts`, which always run, plus the AI check in `lib/agent/judge.ts` when switched on, which can only add removals; D-069), give sell/switch/exit calls with amounts and dates from tool results, and always carries "Munim is not a SEBI-registered investment adviser or an AMFI-registered mutual fund distributor" instead of the education line. The picks file is server-only: never import it from code that runs on the phone. Never public, never marketed.
1a. **Advice only in permitted modes, always with the disclaimer.** Recommendations may appear only when the server-resolved `advice_mode` is `guided` (invite-only, free, pre-licence; D-021), `internal`, `demo` or (later) `advised`; every advice output carries the disclaimer "For education only, not investment advice." until `advised` (`private` carries its not-registered line instead) (D-051; it replaced the "not SEBI-registered" wording). Category level only before the licence: no new-fund, stock or insurance-product picks, no "surrender this policy" (the one exception is `private` mode, rule 1). `demo` never touches real data. No GTM (public sign-up, marketing, fees) and never describe the product publicly as an investment adviser until the RIA licence. Details: `docs/12-advice-engine.md`.
2. **The LLM never computes numbers.** All figures come from `services/api/engine` as `facts` with IDs. LLM output is post-checked against the fact sheet.
3. **Authorization before retrieval.** Every query for facts, insights, uploads or chat history is scoped to the caller's `user_id` and owned `member_id`s on the server; never accept a member/upload ID from the client or the LLM without an ownership check. Cross-tenant tests are mandatory.
4. **No PII to LLMs or logs.** No PAN, names, emails, folio numbers or CAS passwords in prompts, logs, analytics events or error traces. Tests enforce this.
5. **The CAS PDF and password never leave the device.** Parsing runs in the browser (`packages/cas-parser`); the API accepts only pseudonymised holdings (ADR-010). No endpoint may accept a PDF except the opt-in debug upload.
6. **Money in paise (`bigint`)**; never floats for currency.
7. **Every number is reproducible:** store formula, inputs and as-of dates.
8. **Evals gate merges.** Any change to prompts, models or the output checker must run `evals/` and pass all gates in `tech/AI_EVALS.md`.

## Layout
`apps/munim` (**the product**: Next.js on Vercel; your data is read and kept on the phone, see tech/ARCHITECTURE.md §0) · `packages/core` (**the only engine**, TypeScript, used by the phone and the server) · frozen, don't change (D-056): `apps/web` (first full app, keeps the /research pages) and `apps/voice-cfo` (buildathon; self-contained Next.js app with its own tests; **exception to rule 5:** its upload endpoint parses mock-data PDFs server-side, so it must never receive real statements, see D-020) · `packages/cas-parser` (TS, on-device) · `services/api` (FastAPI: holdings, engine, insights, advice, ai, authz, guards, observability, privacy) · `jobs` (AMFI ingestion) · `evals` · `supabase` (migrations, RLS) · `docs`, `tech`

## Conventions
- Python 3.12, ruff, pytest, type hints; TypeScript strict; Conventional Commits (`feat(engine): …`)
- Every new table: RLS policy + deletion coverage in `delete_user`
- Every new insight rule: a deterministic template fallback + golden-set cases
- Update `DECISIONS.md` when a decision changes; never delete rows
- A design decision also updates `docs/42-design-principles.md`: the principle it applies, the psychology or UX framework behind it, and whether that name comes from a source or is our label

## Scope (D-074)
- Phase 1 is frozen. A new feature request goes to `docs/43-phase-2-parked.md`, not into code, unless it passes that file's gate: a named user and problem, evidence it is real, why now, and its cost to the privacy and advice promises. Ask for the missing parts and push back; don't build on request alone.
- Fixes to failing core cases, evals and compliance are not features.

## Workflow
- Small PRs; each references a PRD feature ID (F1…F16) or a task ID (T-, L-)
- Before committing: tests + lint + evals (if AI-touching)
- Checkpoint progress in `docs/07-roadmap.md` after each sprint
