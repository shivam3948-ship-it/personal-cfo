# Architecture

**Status:** Draft v0.1 · **Last updated:** 2026-10-03

## 1. Principles
1. **Deterministic core, generative edge.** Python computes every number; the LLM only explains facts it's handed (D-009).
2. **No PII crosses to the model provider.** Fact sheets use pseudonymous IDs.
3. **Advice is a server-side capability flag**, never a UI toggle (D-006).
4. **Every number is reproducible:** formula, inputs and data as-of dates are stored with it.
5. **Boring infrastructure.** Managed services and one language per concern.

## 2. System overview
```
┌──────────────┐  HTTPS + Supabase JWT   ┌───────────────────────────────┐
│  Web (PWA)   │ ──────────────────────▶ │  API service (FastAPI, Py)    │
│  Next.js     │ ◀────── SSE stream ──── │  ├─ cas/      parse + validate│
└──────┬───────┘                         │  ├─ engine/   x-ray metrics   │
       │ auth, storage                   │  ├─ insights/ rules + ranking │
       ▼                                 │  ├─ ai/       fact sheet, LLM,│
┌──────────────────────────────┐         │  │            guardrails, RAG │
│ Supabase                     │ ◀─────▶ │  └─ privacy/  delete, export  │
│ Postgres (+pgvector) · Auth  │         └──────────────┬────────────────┘
│ · Storage (encrypted, opt-in)│                        │ fact sheet (no PII)
└──────────────▲───────────────┘                        ▼
               │                              ┌──────────────────┐
┌──────────────┴───────────────┐              │ Claude API       │
│ Jobs (scheduled)             │              └──────────────────┘
│ AMFI NAV daily · scheme      │
│ master · TER · monthly       │
│ portfolio disclosures        │
└──────────────────────────────┘
```

## 3. Core flows
**A. Upload → insights**
1. Web posts the PDF + password to `POST /cas` (TLS). The password stays in memory only and is excluded from logs by a middleware allow-list.
2. `cas/` parses → normalised schemes, folios, transactions, valuations.
3. **Reconcile:** Σ scheme valuations vs the CAS total; on a mismatch, reject with a reason code.
4. The PDF is discarded (default) or stored encrypted if the user opted in.
5. `engine/` computes metrics → `facts` rows (id, type, value, unit, formula, inputs, as_of).
6. `insights/` rules evaluate facts → ranked `insights`.
7. `ai/` builds a **fact sheet** per insight (only the fact IDs it needs, no PII) → LLM → output checker → stored explanation with prompt version.

**B. Chat ("Ask your CFO")**
1. Intent classifier (small model): `explain_fact` | `education` | `advice_seeking` | `out_of_scope`.
2. Retrieval: the user's facts (SQL) + knowledge-base chunks (pgvector) for education.
3. Generation with a strict system policy → output checker (numbers ⊂ fact sheet values; recommendation-pattern detector) → stream to the user.
4. `advice_seeking` while `ADVICE_ENABLED=false` → compliant template response (facts + questions to ask + "needs a registered adviser").

**C. Refresh & diff:** a new CAS → scheme-level unit deltas vs the previous snapshot → action-matching rules → `detected_actions`.

## 4. Repo layout (monorepo)
```
personal-cfo/
├── apps/web/            # Next.js PWA
├── services/api/
│   ├── cas/             # parse + reconcile (deterministic)
│   ├── engine/          # x-ray metrics → facts (deterministic)
│   ├── insights/        # rules + ranking + template fallbacks
│   ├── ai/
│   │   ├── prompts/     # versioned prompt files + registry.py (typed, never inline strings)
│   │   ├── pipeline.py  # fact sheet → LLM → checks
│   │   ├── router.py    # intent classifier
│   │   └── kb.py        # curated-KB retrieval (pgvector)
│   ├── guards/          # 3 layers: input (intent / PII), content (untrusted PDF + KB text), output (numbers + advice)
│   ├── observability/   # trace_id per request across parse→engine→LLM; cost per request; feedback joined to trace
│   └── privacy/         # delete, export
├── jobs/                # reference-data ingestion (AMFI)
├── evals/               # golden, red-team, benign, bait sets; offline harness; online monitor; results/ history
├── supabase/            # migrations, RLS policies, seed
├── docs/ tech/          # this documentation
├── .claude/rules/       # compliance.md, code-style.md, testing.md for the AI coding agent
└── .github/workflows/   # CI: lint, tests, evals gate
```

## 5. Architecture Decision Records
### ADR-001 · Python service for parsing and finance maths
- **Context:** CAS parsing, XIRR and holdings look-through are data-heavy; the best tooling (pdfplumber, pandas, `casparser`) is Python.
- **Decision:** FastAPI service owns all computation. The web app owns no business logic.
- **Consequences:** two deploy targets (web + API). Accepted for correctness and testability.

### ADR-002 · Supabase for auth, Postgres, storage, vectors
- **Context:** proven on LaborLink; RLS, auth and pgvector in one managed service.
- **Decision:** Supabase, India region if available (⚠ verify the region list and pricing).
- **Consequences:** vendor coupling; mitigated by plain Postgres migrations.

### ADR-003 · LLM as explainer over a fact sheet (no free computation)
- **Context:** LLMs make arithmetic and recall errors; this is a money product.
- **Decision:** the LLM receives typed facts with IDs and must cite them; a post-check rejects any number not in the fact sheet (after unit and format normalisation).
- **Alternatives rejected:** letting the LLM call a calculator tool on the fly (harder to audit); free-form RAG over the raw CAS (PII exposure, wrong numbers).
- **Consequences:** less "creative" answers; that's intended.

### ADR-004 · CAS PDF first, Account Aggregator later
See D-005. The parser interface is source-agnostic (`HoldingsSource`), so AA plugs in later.

### ADR-005 · Mobile-first PWA, not native apps, for Phase 1
Faster iteration, no store review, one codebase. Revisit for voice (Phase 1.5) or push-notification needs.

### ADR-006 · Model provider: Claude API behind a thin interface
- Larger model for explanations and chat; small, fast model for intent classification and checks.
- `ai/llm.py` wraps the provider so models can be swapped and A/B-tested by the eval harness.
- ⚠ L-3: review data-retention and region terms before the pilot.

### ADR-007 · RAG only over a curated knowledge base
Sources: SEBI and AMFI investor-education material and our own methodology docs, each chunk tagged with source URL + date. No open-web retrieval in production answers.

### ADR-008 · Advice capability flag
`ADVICE_ENABLED` per environment *and* per user (requires a completed risk profile + signed agreement + an RIA-of-record). Checked in the API, logged in the audit log.

### ADR-009 · What we took from the generic "production RAG app" layout, and what we rejected
- **Context:** A widely shared 9-layer template (services, agents, prompts, security, evaluation, observability, .claude, …) was reviewed on 2026-10-03. It's designed for document Q&A. Our core data is structured (facts in Postgres), not documents.
- **Adopted:**
  - Prompt registry (typed, versioned)
  - Three guard layers, with the *content* layer meaning untrusted text inside CAS PDFs and KB chunks
  - Per-request tracing with feedback and cost joined to the trace
  - An online eval monitor (sampled LLM-judge on production answers) plus stored eval history
  - `.claude/rules/` split
- **Rejected:**
  - **Semantic cache:** a "similar" question about a different portfolio or date returns a wrong number. We cache only on the exact `fact_sheet_hash`.
  - **Hybrid retriever + reranker, query rewriter and decomposer:** retrieval of the user's data is SQL by fact ID. The curated KB is small enough for plain pgvector top-k. Revisit only if KB recall evals fail.
  - **Agentic "document grader" / self-correcting loops:** add latency, cost and non-determinism. Our correction is a single, rule-checked regeneration (AI_EVALS §6).
  - **Web search tool:** production answers come only from facts and the curated KB (ADR-007).
- **Consequence:** fewer moving parts, every answer reproducible. Each rejected component has a named eval that would justify adding it back.

## 6. Security & privacy
- TLS everywhere; secrets in the platform secret store; no secrets in the repo
- PAN stored as a salted hash plus last 4 characters; names and emails encrypted at the application layer (⚠ choose a KMS)
- Log redaction middleware, with tests asserting no PAN, password or folio patterns in logs
- RLS on every user table; the API uses the user's JWT for user-scoped queries
- Audit log (append-only): uploads, deletions, advice-flag checks, AI responses (hash + prompt version)

## 7. Environments & CI
- `local` → `preview` (per PR) → `prod`
- CI gates: lint + unit tests + **eval suite** (AI_EVALS gates must pass) + migration check

## 8. Cost model (to fill with real numbers in S3)
Track per active user: LLM tokens (explanations are cached per fact-sheet hash), hosting and storage. No estimate is given until measured.
