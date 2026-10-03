# 07 · Roadmap

**Status:** Draft v0.1 · **Last updated:** 2026-10-03
Now / Next / Later. Dates are targets for a solo builder, re-planned at each phase gate.

## Now — Phase 0: Foundations (this week)
- [x] Decisions locked (DECISIONS.md D-001…D-010)
- [x] Vision, competitive analysis, regulatory reading, Phase 1 PRD, metrics, GTM
- [x] Architecture, data model, AI eval plan
- [ ] T-1 Size the DIY investor segment from AMFI/CRISIL data (sourced)
- [ ] T-2 Verify competitor rows (screenshots + dates)
- [x] Problem validation from secondary research (docs/08)
- [x] User journeys (docs/09) and platform decision (docs/10)
- [ ] T-3 10 user interviews (questions in docs/08 §4; exit criteria defined there)
- [ ] L-1 Book a lawyer review of the advice boundary
- [ ] Create the GitHub repo, project board and issues from the PRD

## Next — Phase 1: Portfolio X-ray (5–6 weekly sprints)
S0 spikes → S1 upload/parse → S2 x-ray engine → S3 insights + evals → S4 chat + guardrails → S5 diff, family, pilot hardening. Detail: PRD §18.
**Gate to Phase 1.5:** pilot metrics measured; no kill criterion hit.

## Next — Phase 1.5: Language & voice experiment (2 sprints)
- Hindi explanations (text), then voice Q&A on the chat (speech-to-text + text-to-speech; vendors to evaluate for Indian languages)
- Question: does language or voice raise comprehension and activation for less-confident investors? (D-OPEN-1)

## Later — Phase 2: Savings insights
- Bank and card statement parsing (builds on the existing statement-analysis work)
- Spend categorisation, leakage detection, "investable surplus" estimate
- Data: PDF upload first; AA later via a partner
- Regulatory: information only; not securities advice (⚠ confirm)

## Next — Advice engine v1 (internal + demo modes; D-016)
- A1–A3 recommendations with suitability and tax/exit-load simulation; founder-reviewed on family portfolios
- Public demo on synthetic personas; L-8 legal check before sharing the link
- Blind review of 30 recommendations by a practising RIA/CFP

## Later — Phase 3: Goal-based planning (**RIA required**)
- Goals → required corpus → SIP gap, using the risk profile captured in Phase 1
- Advice flag on; suitability check; client agreement; AI-use disclosure
- Gate: RIA route decided and live (D-OPEN-2, L-5)

## Later — Phase 4: Tax-aware investing (**RIA required for personalised moves**)
- Capital-gains view from CAS transaction lots (FIFO), LTCG harvesting analysis, ITR-ready gains report
- The factual gains report can ship before licensing; personalised harvesting suggestions cannot

## Parked
Account Aggregator integration (needs a regulated FIU partner) · demat CAS · native apps · B2B white-label for RIAs
