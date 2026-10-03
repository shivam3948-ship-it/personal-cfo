# 02 · Competitive Analysis

**Status:** Draft v0.1 · **Last updated:** 2026-10-03
**Rule for this doc:** every feature claim carries a source and date. Anything unverified is marked `⚠ verify` and tracked as task T-2. Competitor products change fast; re-check before any external use.

## 1. Bottom line
- **The portfolio x-ray is commoditised.** At least one free tool (FundSageAI) already offers CAS parsing, overlap, XIRR, family view and a health score. We can't win on x-ray features alone.
- **The closest direct competitor is Bachatt's "Saathi"**, an AI wealth co-pilot doing portfolio analysis, goal planning and tax optimisation at ₹99/month. Bachatt is an AMFI-registered *distributor*, not an RIA, per its own site.
- **The real substitute is a general-purpose chatbot.** A user can upload a CAS to ChatGPT or Claude today. We have to beat that on correct numbers, fund-level holdings data, persistence over time and trust.
- **The open position:** unbiased (no distribution), numerically verifiable, with explanation quality you can measure and a path to licensed advice. Nobody in the set below claims all four.

## 2. Competitor table

| Player | What it does (relevant to us) | Regulatory / business model | Source |
|---|---|---|---|
| **Bachatt (Saathi + Basket Optimizer)** | AI co-pilot: "investment advice, portfolio analysis and goal planning", fund comparisons, tax optimisation; MF and stock analysers. Tiers: Free (10 AI messages/month), Wealth ₹99/month, Private (₹50L+). Claims 1.4 lakh active users. | AMFI-registered distributor (ARN on site). Raised a $12M Series A led by Accel (31 Mar 2026); core segment is merchants and the self-employed. | wealth.bachatt.app (fetched 2026-10-03); Business Standard, 31 Mar 2026 |
| **FundSageAI** | CAS parsing (CAMS + KFintech), XIRR, health score, overlap, family view for up to 4 members, goal projections, risk analysis. Free to start. No AI chat mentioned on its homepage. | States it is *not* an RIA, RA or distributor, and gives no personalised advice. | fundsageai.com (fetched 2026-10-03) |
| **Groww MCP** | Connects a Groww account to Claude, Cursor and others for chat-based portfolio questions and orders. At launch: stocks and F&O only; MFs "slated for future". | Broker / distributor | groww.in/updates/groww-mcp (announced 4 Aug 2025) |
| **INDmoney** | Multi-asset tracker; external MF tracking. ⚠ verify current AI features | ⚠ verify | — |
| **Kuvera** | Direct MF platform; imports external holdings. ⚠ verify | ⚠ verify | — |
| **ET Money / Value Research / Morningstar India** | Portfolio tracking and fund research. ⚠ verify current x-ray and AI features | ⚠ verify | — |
| **General LLM chat (ChatGPT, Claude, Gemini)** | Upload a CAS and ask anything | Not regulated as advice providers | User behaviour; ⚠ size this in interviews |
| **Fee-only RIAs (humans)** | Real personalised advice | Registered; fees capped at ₹1.51L per family per year or 2.5% of AUA (Cafemutual, 18 Feb 2025; verify) | — |
| **Open-source analysers** | e.g. GitHub "Mutual-Fund-Analyzer" (multi-agent) | — | github.com/krish-7104/Mutual-Fund-Analyzer |

## 3. Positioning map
Axes: **Depth of personalisation** (generic → specific to my holdings) × **Conflict of interest** (paid on products sold → paid only by the user / free).

```
                  specific to me
                        │
     Bachatt Saathi ●   │        ● Fee-only RIA (human, expensive)
   (distributor)        │
                        │   ◎ Personal CFO (target)
 conflicted ────────────┼──────────────────── unconflicted
                        │
       Distributor apps │    ● FundSageAI (x-ray, no advice)
                        │    ● General LLM chat (unverified numbers)
                    generic
```
Placements are our judgement, not measured.

## 4. Where we must be at parity (table stakes)
CAS parsing for both RTAs · XIRR · overlap · expense drag · asset-allocation view · family view · deleting data on request.

## 5. Where we differentiate
| Differentiator | Why competitors can't easily copy it | Proof we'll publish |
|---|---|---|
| Numbers you can verify: every figure links to its formula and inputs; the LLM never computes | Retrofitting grounding into an existing chat product is costly | Public eval scorecard: numeric fidelity, groundedness |
| No product sales, ever (if RIA) | Distributor revenue models can't drop commissions without losing revenue | Stated in the product and the client agreement |
| "Did it help?" measured via CAS diff | Needs the explanation and action layer built around re-uploads | Verified-actions metric |
| Advice boundary enforced in code, with tests | Most AI chats rely on disclaimers | Red-team eval pass rate |

## 6. Threats
1. **Bachatt or Groww ships the same "explain my portfolio" feature to millions of users.** Response: compete on trust and verifiability, not reach; stay small and excellent.
2. **General LLMs get good enough at CAS analysis.** Response: our moat is holdings data, history and diffs, plus the licence path, not the chat itself.
3. **A regulator treats "diagnosis" as advice.** Response: get legal review before launch (see 03-regulatory).

## 7. Open research tasks
- T-2: verify the INDmoney, Kuvera, ET Money and Value Research rows (feature, price, licence), with screenshots and dates
- T-3: in 10 user interviews, ask what they use today and whether they've pasted a portfolio into ChatGPT
