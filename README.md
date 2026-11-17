# Munim: a personal CFO for India

A Hindi/English money app for first-time savers in tier-2 and tier-3 India: a quick daily check-in, where your money went, whether your investing is really working, and an assistant you can ask by voice or text.

**Live demo:** https://personal-cfo-ruddy.vercel.app (sample data by default; you can try your own statements)

## What it does
- **Today:** a daily check-in, one action at a time, with the next step on your money path (starter buffer → costly debt → emergency fund → insurance → investing)
- **Spends:** reads bank and card statements and sorts spending automatically, including UPI to people and small shops
- **Invest:** a portfolio x-ray from your CAS: true cost, regular vs direct, your return vs your funds' return
- **Credit:** what you owe, what's due next, card bills with limit used, loans and EMIs seen in your statements
- **Ask Munim:** one voice/text button on every screen, in Hindi or English

Reads HDFC, SBI, Canara and Federal Bank savings statements, HDFC and Axis credit card statements, and CAMS/KFintech CAS.

## How it treats your data and money advice
- Statements are read on the phone; only computed, filtered totals go to the AI (D-036, D-050)
- Every number is computed in code, never by the model
- A second model reviews answers about investments against the advice rules (D-069)
- A browser-only mode runs with no AI model at all
- Not SEBI-registered: answers are for education, not investment advice

## Repo map
| Path | What |
|---|---|
| `apps/munim` | The current app (Next.js, mobile-first) |
| `packages/core` | Statement readers and the money engine |
| `apps/munim/evals` | Offline, live and red-team evals; dated results in `evals/results` |
| [DECISIONS.md](DECISIONS.md) | Every decision and trade-off, with the options rejected |
| [docs/42-design-principles.md](docs/42-design-principles.md) | Design principles and the UX reasoning behind each screen |
| `apps/voice-cfo`, `apps/web` | Earlier versions, incl. the Bachatt × Digia buildathon build |

## Run it
```bash
cd apps/munim
npm install
npm run dev   # http://localhost:3002
npm test
```
Works without API keys in browser-only mode; add your Anthropic and Sarvam keys in `apps/munim/.env.local` for AI answers and voice.

## Original phase plan
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
| [docs/20-why-now.md](docs/20-why-now.md) | Why now, sourced: Dec 2024 RIA amendments + AI rules, PMS 2026 MF-only route, finfluencer crackdown, data and AI shifts |
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
