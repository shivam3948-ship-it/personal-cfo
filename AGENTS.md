# AGENTS.md — working rules for any AI coding agent (Claude Code, Codex, Cursor, …)

## Project
Personal CFO (working name): an AI personal CFO for Indian mutual fund investors who want to stay involved but lack time (primary), and for families checking a parent's portfolio (secondary); see docs/11. Phase 1 = CAS upload → portfolio x-ray → grounded AI explanations + chat, plus an advice engine running only in internal/demo modes. Read `DECISIONS.md` first; it overrides anything stale elsewhere.

## Non-negotiables
1. **Advice only in permitted modes, always with the disclaimer.** Recommendations may appear only when the server-resolved `advice_mode` is `guided` (invite-only, free, pre-licence; D-021), `internal`, `demo` or (later) `advised`; every advice output carries the "not SEBI-registered investment advice" disclaimer until `advised`. Category level only before the licence: no new-fund, stock or insurance-product picks, no "surrender this policy". `demo` never touches real data. No GTM (public sign-up, marketing, fees) and never describe the product publicly as an investment adviser until the RIA licence. Details: `docs/12-advice-engine.md`.
2. **The LLM never computes numbers.** All figures come from `services/api/engine` as `facts` with IDs. LLM output is post-checked against the fact sheet.
3. **Authorization before retrieval.** Every query for facts, insights, uploads or chat history is scoped to the caller's `user_id` and owned `member_id`s on the server; never accept a member/upload ID from the client or the LLM without an ownership check. Cross-tenant tests are mandatory.
4. **No PII to LLMs or logs.** No PAN, names, emails, folio numbers or CAS passwords in prompts, logs, analytics events or error traces. Tests enforce this.
5. **The CAS PDF and password never leave the device.** Parsing runs in the browser (`packages/cas-parser`); the API accepts only pseudonymised holdings (ADR-010). No endpoint may accept a PDF except the opt-in debug upload.
6. **Money in paise (`bigint`)**; never floats for currency.
7. **Every number is reproducible:** store formula, inputs and as-of dates.
8. **Evals gate merges.** Any change to prompts, models or the output checker must run `evals/` and pass all gates in `tech/AI_EVALS.md`.

## Layout
`apps/web` (Next.js) · `apps/voice-cfo` (Munim voice CFO, buildathon; self-contained Next.js app with its own tests; **exception to rule 5:** its upload endpoint parses mock-data PDFs server-side, so it must never receive real statements, see D-020) · `packages/cas-parser` (TS, on-device) · `services/api` (FastAPI: holdings, engine, insights, advice, ai, authz, guards, observability, privacy) · `jobs` (AMFI ingestion) · `evals` · `supabase` (migrations, RLS) · `docs`, `tech`

## Conventions
- Python 3.12, ruff, pytest, type hints; TypeScript strict; Conventional Commits (`feat(engine): …`)
- Every new table: RLS policy + deletion coverage in `delete_user`
- Every new insight rule: a deterministic template fallback + golden-set cases
- Update `DECISIONS.md` when a decision changes; never delete rows

## Workflow
- Small PRs; each references a PRD feature ID (F1…F16) or a task ID (T-, L-)
- Before committing: tests + lint + evals (if AI-touching)
- Checkpoint progress in `docs/07-roadmap.md` after each sprint
