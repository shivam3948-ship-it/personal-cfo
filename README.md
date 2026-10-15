# Personal CFO (working name)

An AI personal CFO for Indian investors. Upload your mutual fund statement (CAS), see what's really in your portfolio, and get plain-language explanations you can verify, with no commissions behind the answers.

**Status:** Phase 0 docs complete. First working code: `apps/voice-cfo` (Munim), a Hindi/English voice CFO built for the Bachatt × Digia buildathon (docs/16–18).
**Regulatory stance (D-021):** before the licence, invite-only users get guidance with a disclaimer (*not SEBI-registered investment advice*), category level only, free, with no public marketing. **Go-to-market only after a SEBI RIA licence** (see `docs/03-regulatory-compliance.md`, `docs/12-advice-engine.md`).

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
| [docs/13-problem-depth.md](docs/13-problem-depth.md) | 5 whys, today's alternatives, pain size, behaviour change, the Groww lesson |
| [docs/15-prd-phase2-money-picture.md](docs/15-prd-phase2-money-picture.md) | Phase 2 PRD: spending, net worth, insurance |
| [docs/14-prompt-benchmark.md](docs/14-prompt-benchmark.md) | The viral "10 AI finance prompts" vs our product: gaps, phases, adoptions |
| [docs/16-voice-stack-decision.md](docs/16-voice-stack-decision.md) | Voice stack analysis: Sarvam vs alternatives, cascade vs speech-to-speech, cost per turn |
| [docs/17-buildathon-runbook.md](docs/17-buildathon-runbook.md) | Buildathon plan: judging map, timeline, step-by-step rebuild prompts, demo script, failure drills |
| [docs/18-expo-native-roadmap.md](docs/18-expo-native-roadmap.md) | Web → Expo native: what carries over, phases N0–N5, risks |
| [docs/19-tradeoffs-log.md](docs/19-tradeoffs-log.md) | What every decision cost us, why that's acceptable, mitigations |
| [docs/research/appendix-wealth-creation-framework.md](docs/research/appendix-wealth-creation-framework.md) | Generic wealth-creation framework + gap evaluation (adopted in D-022) |
| [apps/voice-cfo/README.md](apps/voice-cfo/README.md) | Munim: run, test, architecture, known gaps |
| [docs/research/interview-kit.md](docs/research/interview-kit.md) | Screener, script, notes template, synthesis grid |
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
