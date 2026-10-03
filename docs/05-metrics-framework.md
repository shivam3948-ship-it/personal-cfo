# 05 · Metrics Framework

**Status:** Draft v0.1 · **Last updated:** 2026-10-03
All targets below are **our pre-committed hypotheses**, not benchmarks. We set them before the pilot so we can't move the goalposts afterwards.

## 1. North Star Metric
**Monthly Verified Actions (MVA):** the number of portfolio changes per month that (a) match an insight we showed the user, (b) are detected by diffing two CAS uploads, and (c) the user confirms our insight prompted.

**Why this and not MAU:** MAU rewards curiosity; MVA rewards *improved portfolios*, which is the value we promise. It's also hard to game: it needs real money to move.
**Known weakness:** it lags (it needs a second CAS upload) and is small in absolute terms. Hence the leading inputs below.

## 2. Metric tree
```
MVA (North Star)
├── Active analysed portfolios      = users with a CAS uploaded in last 30 days
│   ├── Sign-up → upload completion
│   ├── Parse success rate
│   └── 30-day re-upload rate
├── Insight quality
│   ├── Insights shown per portfolio (with ₹ impact)
│   ├── "Show the math" open rate (trust)
│   ├── Comprehension (1-question check, sampled)
│   └── 👍 rate on AI explanations and answers
└── Action conversion
    ├── "I'll do this" taps per insight
    └── Detected actions / "I'll do this" taps
```

## 3. KPIs and pilot targets
| Metric | Definition | Pilot target (hypothesis) |
|---|---|---|
| Upload completion | users who parse ≥1 CAS ÷ sign-ups | ≥ 50% |
| Time to first insight | p50 from upload click to insights rendered | < 3 min |
| Parse success | successful reconciled parses ÷ attempts | ≥ 95% (golden set: 100%) |
| 30-day re-upload | users uploading again within 30–45 days ÷ users with first upload | ≥ 30% |
| AI 👍 rate | 👍 ÷ (👍+👎) on explanations and chat | ≥ 80% |
| Insight → verified action | MVA ÷ users with actionable insights, per month | ≥ 10% |

## 4. Guardrails (any breach blocks release or pauses the pilot)
| Guardrail | Threshold |
|---|---|
| Numeric fidelity of LLM output (offline golden set) | 100% |
| Advice-boundary violations (red-team set + production sample) | 0 |
| PII in LLM payloads (automated scan) | 0 |
| Wrong number reported by a user and confirmed | Pause and root-cause within 24 h |
| Deletion requests completed within published SLA | 100% |
| LLM cost per monthly active user | Track; set the ceiling after week 1 |

## 5. AI quality metrics (detail in tech/AI_EVALS.md)
Numeric fidelity · groundedness (every claim traceable to a fact or source) · advice-boundary compliance · refusal correctness (doesn't refuse legitimate education questions) · readability · latency · cost.

## 6. Kill / pivot criteria (pre-committed)
After a 6-week pilot with ≥ 30 activated users:
- Upload completion < 25% → the trust or effort barrier is too high; test AA-first or concierge.
- 30-day re-upload < 15% and zero verified actions → diagnosis alone isn't valuable; revisit A4 (the advice-gated model) and the licensing timeline.
- 👍 rate < 60% → the explanation layer isn't the wedge; revisit D-004.

## 7. Instrumentation plan
- Product analytics: PostHog (self-serve, EU/US cloud; ⚠ check data region against DPDP and SEBI needs) or a Postgres events table for the pilot
- Event names: `cas_upload_started`, `cas_parse_succeeded`, `cas_parse_failed{reason}`, `insight_viewed{type}`, `math_opened`, `insight_intent_tapped`, `chat_question_asked{intent}`, `ai_feedback{rating,reason}`, `action_detected{type}`, `action_confirmed`, `data_deleted`
- No PII in event properties
