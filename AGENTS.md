# AGENTS.md — working rules for any AI coding agent (Claude Code, Codex, Cursor, …)

## Project
Personal CFO (working name): an AI personal CFO for Indian DIY mutual fund investors. Phase 1 = CAS upload → portfolio x-ray → grounded AI explanations + chat. Read `DECISIONS.md` first; it overrides anything stale elsewhere.

## Non-negotiables
1. **No investment advice in Phase 1.** Never write copy, prompts or logic that recommends buying, selling or switching a specific security, or an amount or timing. Advice code paths must check `ADVICE_ENABLED` server-side. Boundary table: `docs/03-regulatory-compliance.md` §3.
2. **The LLM never computes numbers.** All figures come from `services/api/engine` as `facts` with IDs. LLM output is post-checked against the fact sheet.
3. **Authorization before retrieval.** Every query for facts, insights, uploads or chat history is scoped to the caller's `user_id` and owned `member_id`s on the server; never accept a member/upload ID from the client or the LLM without an ownership check. Cross-tenant tests are mandatory.
4. **No PII to LLMs or logs.** No PAN, names, emails, folio numbers or CAS passwords in prompts, logs, analytics events or error traces. Tests enforce this.
5. **CAS passwords are never persisted.** Memory only.
6. **Money in paise (`bigint`)**; never floats for currency.
7. **Every number is reproducible:** store formula, inputs and as-of dates.
8. **Evals gate merges.** Any change to prompts, models or the output checker must run `evals/` and pass all gates in `tech/AI_EVALS.md`.

## Layout
`apps/web` (Next.js) · `services/api` (FastAPI: cas, engine, insights, ai, authz, guards, observability, privacy) · `jobs` (AMFI ingestion) · `evals` · `supabase` (migrations, RLS) · `docs`, `tech`

## Conventions
- Python 3.12, ruff, pytest, type hints; TypeScript strict; Conventional Commits (`feat(engine): …`)
- Every new table: RLS policy + deletion coverage in `delete_user`
- Every new insight rule: a deterministic template fallback + golden-set cases
- Update `DECISIONS.md` when a decision changes; never delete rows

## Workflow
- Small PRs; each references a PRD feature ID (F1…F14) or a task ID (T-, L-)
- Before committing: tests + lint + evals (if AI-touching)
- Checkpoint progress in `docs/07-roadmap.md` after each sprint
