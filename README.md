# Personal CFO (working name)

An AI personal CFO for Indian investors. Upload your mutual fund statement (CAS), see what's really in your portfolio, and get plain-language explanations you can verify, with no commissions behind the answers.

**Status:** Phase 0: documentation complete, build not started.
**Regulatory stance:** for users, Phase 1 is diagnosis only and is *not investment advice*. An advice prototype runs only on sample data (demo) and internally; personalised advice for users ships only under a SEBI RIA licence (see `docs/03-regulatory-compliance.md`, `docs/12-advice-engine.md`).

## Phases
1. **Portfolio X-ray + Ask your CFO**: overlap, true cost, asset mix, XIRR, grounded AI explanations
2. **Savings insights**: bank and card statements → leakage and investable surplus
3. **Goal-based planning**: RIA required
4. **Tax-aware investing**: RIA required for personalised moves

## Read in this order
| Doc | What's in it |
|---|---|
| [DECISIONS.md](DECISIONS.md) | Every locked and open decision, with reasons |
| [docs/01-vision-strategy.md](docs/01-vision-strategy.md) | Problem, user, why now, strategy, riskiest assumptions |
| [docs/02-competitive-analysis.md](docs/02-competitive-analysis.md) | Who else does this; where we differentiate |
| [docs/03-regulatory-compliance.md](docs/03-regulatory-compliance.md) | SEBI IA rules, the advice boundary, DPDP, AA |
| [docs/04-prd-phase1-portfolio-xray.md](docs/04-prd-phase1-portfolio-xray.md) | Phase 1 PRD (18-section template) |
| [docs/05-metrics-framework.md](docs/05-metrics-framework.md) | North Star, metric tree, guardrails, kill criteria |
| [docs/06-gtm-cold-start.md](docs/06-gtm-cold-start.md) | Trust-first cold start |
| [docs/07-roadmap.md](docs/07-roadmap.md) | Now / Next / Later |
| [docs/08-problem-validation.md](docs/08-problem-validation.md) | Market evidence for and against each problem hypothesis |
| [docs/09-user-journeys.md](docs/09-user-journeys.md) | All user journeys, failure paths, journey → metric map |
| [docs/10-platform-decision.md](docs/10-platform-decision.md) | What kind of app; web vs mobile, with native-app triggers |
| [docs/11-segments-personas.md](docs/11-segments-personas.md) | Segmentation model, primary/secondary/parked personas |
| [docs/12-advice-engine.md](docs/12-advice-engine.md) | Advice catalogue, engine design, internal/demo modes, advice evals |
| [tech/ARCHITECTURE.md](tech/ARCHITECTURE.md) | System design + ADRs |
| [tech/DATA_MODEL.md](tech/DATA_MODEL.md) | Postgres schema |
| [tech/AI_EVALS.md](tech/AI_EVALS.md) | AI components, guardrails, eval gates |

## Stack
Next.js (PWA) · FastAPI (Python) · Supabase (Postgres, Auth, Storage, pgvector) · Claude API

## Principles
- The LLM never computes numbers and never sees PII
- Every number shows its math
- No product sales, ever

*Not investment advice. Built by Shivam Singh.*
