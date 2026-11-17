# 31 · Stakeholder map (17 Oct 2026)

Power = ability to stop or shape Munim. Interest = how much Munim changes their day.

| Stakeholder | Power | Interest | What they want | What they fear | How we engage |
|---|---|---|---|---|---|
| **Host app product lead** (e.g. a savings app's PM) | High | High | Retention, fewer lean-week drop-offs, an AI story | Bot backlash, brand risk, engineering cost | Pilot proposal with an A/B on the withdraw screen (docs/34) |
| **Host support and ops head** | High | High | Fewer repeat contacts, cases arriving with context | Being blamed for slow payouts the bot exposes | Case summary format; measure repeat contacts |
| **Host compliance / principal officer (distributor)** | High (veto) | Medium | Nothing that reads as investment advice; clean disclosures | Distributor vs adviser line, mis-selling | Advice-boundary table (docs/03), red-team cases (docs/30), counsel memo (L-8) |
| **Host engineering** | Medium | Medium | A small integration surface | Owning someone else's AI in production | Contract: host sends state, Munim proposes, host executes (`lib/host/agent.ts`) |
| **Savers (Sunita persona)** | High (they leave) | High | Money back on time, a person when stuck, Hindi | Fraud, hidden charges, being ignored | Concierge test, interviews (docs/35) |
| **Family proxies** (son or daughter who installs the app) | Medium | Medium | Parents' money safe, without being on call | Being the support desk | Shareable spoken summary (docs/24) |
| **SEBI / AMFI** (indirect) | High | Low | Investor protection, proper disclosures | AI giving unlicensed advice | Guidance mode with disclaimer; RIA path (D-021, D-OPEN-2) |
| **AMCs and RTAs (CAMS, KFintech)** | Medium | Low | Clean transactions, fewer complaints | Data use outside consent | Read-only; the CAS stays on the device |
| **Voice and LLM vendors (Sarvam, Anthropic)** | Medium | Low | Usage | Abuse, policy breaches | Rate limits, redaction (docs/28) |
| **Buildathon judges / hiring managers** (today) | Medium | Medium | A clear problem, evidence, a working demo, judgement | Feature dumps, AI hand-waving | Research → opportunity tree → /host demo → limits |

**Order of attention:** compliance (veto) → support head (value) → product lead (sponsor) → savers (truth) → engineering (cost).
