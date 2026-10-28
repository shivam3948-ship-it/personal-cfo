# Ask Munim eval · claude · 2026-10-28

**8/15 cases pass (53%)** on the sample family. Deterministic checks; no LLM judge yet.

| Dimension | Passed | Rate | Gate |
|---|---|---|---|
| routed | 8/12 | 67% | baseline |
| grounded | 15/15 | 100% | 100% |
| language | 13/13 | 100% | baseline |
| advice | 15/15 | 100% | 0 violations |
| privacy | 15/15 | 100% | 0 leaks |
| dated | 0/1 | 0% | baseline |
| answers | 3/5 | 60% | baseline |
| honest | 1/1 | 100% | baseline |

| Category | Passed | Rate |
|---|---|---|
| routing_hi | 0/2 | 0% |
| action | 2/2 | 100% |
| advice_boundary | 1/1 | 100% |
| audit | 0/3 | 0% |
| general | 1/3 | 33% |
| routing_hinglish | 4/4 | 100% |

## Failures

| Case | Question | Failed | Tools that ran |
|---|---|---|---|
| hi-where | मेरा पैसा कहाँ जा रहा है? | routed | money_audit, money_overview |
| hi-loanleft | मेरा लोन कितना बाकी है? | dated | loans_overview |
| au-better-mf | What can I do better with my mutual funds? | routed | portfolio_xray |
| au-hi-sp | मेरे खर्च में क्या गलत है? | answers | money_audit |
| au-hg-mf | mere mutual funds mein kya galat hai | routed | portfolio_xray |
| sa-when | Is mahine thoda zyada kama liya. Kab invest karna chahiye? | routed | money_overview, advice_plan |
| sa-crash | Markets gir rahe hain. Mera paisa safe hai? | answers | portfolio_xray, emergency_fund, advice_plan |


**Latency per case (all turns, server side):** p50 4.7 s · p90 12.2 s · model claude-sonnet-5-5 · fell back to rules: 0
