# 08 · Problem Validation (secondary research)

**Status:** v0.1 · **Last updated:** 2026-10-03 · **Owner:** Shivam Singh
**Rule:** every figure has a source and date. Derived numbers were computed in code (shown in the Calc column). Secondary research can show a problem exists *in the market*; only interviews (T-3) can show *our user* feels it enough to act.

> **How the problem was validated (read this first).** By **market research** (the secondary sources below) plus the founder's **personal experience** and informal conversations with **friends and relatives** who invest or look after a parent's money. **No traditional user research has been done yet:** no screened interviews, surveys or usability tests. That is a deliberate choice (D-018: build the MVP first, interview on it). The interview kit is ready (docs/research/interview-kit.md). Until those interviews run, treat every "our user feels X" claim as a hypothesis. This applies equally to the buildathon app, Munim (docs/17).

## 1. Verdict
| | |
|---|---|
| **Is there a real problem?** | **Yes, at market level.** Complexity is the #1 stated barrier, investors earn less than their funds, decisions run on finfluencer tips, and advisers are vanishingly scarce. |
| **Is it *our* user's problem?** | **Unproven.** Almost all evidence is about households or all investors, not DIY direct-plan investors. DIY investors self-selected as more confident, so the pain may be weaker for them. |
| **Biggest surprise** | The **cost** problem (regular plans) mostly belongs to the *secondary* persona (parents, bank-RM customers), not to DIY direct investors. The **behaviour** problem (churn, panic-stopping SIPs) is the one DIY investors are most exposed to. |
| **Implication** | Lead Phase 1 with *behaviour + clarity* insights for DIY investors, and *cost* insights for the family view. Interviews must test which of P1–P6 actually hurts. |

## 2. Problem hypotheses and evidence

### P1 · "Investing is too complex to understand" — **Strong evidence (market level)**
- SEBI Investor Survey 2025 (90,000 households): 63% of households are aware of at least one securities product, but only **9.5%** invest (Business Standard, 21 Jan 2026).
- Among non-investors, the top barrier is **product complexity and information gaps (74%)**, ahead of risk/return concerns (73%) and trust (51%) (Policy Edge summary of the SEBI survey).
- Only **27%** of Indian adults meet the OECD financial-literacy bar (NCFE FLIS 2019, n = 75,140; old, but the latest national survey we found).
- **Against:** these are mostly *non*-investors. DIY investors cleared the complexity bar to start, but not necessarily the bar to *manage* a portfolio.

### P2 · "Investors earn less than their funds do" (behaviour gap) — **Strong evidence**
- Axis MF research (2003–2022): investor returns (IRR on actual flows) were "significantly worse" than both point-to-point and SIP returns for equity, hybrid and debt categories; cause: buying after rallies, selling in falls (via Advisorkhoj).
- SIP churn: in Feb 2026, 49.70 lakh SIPs were discontinued against 65.72 lakh new ones, a **75.6%** stoppage ratio (Angel One citing AMFI; ratio computed by us). Sep 2025 was 76.27% (IIFL). Note: Jan–Apr 2025 ratios were distorted by an RTA clean-up of defunct folios.
- **Against:** stoppage includes SIPs that matured as planned; the ratio overstates panic exits.
- **Implication:** the most valuable Phase 1 insight may be "your *own* return vs your funds' return, and what drove the gap". It's diagnostic, so it's allowed.

### P3 · "Decisions are made on tips, not on the investor's own portfolio" — **Moderate evidence**
- SEBI survey 2025: **62%** of investors report making decisions based on financial influencers' recommendations (Policy Edge summary; ⚠ exact denominator not confirmed in the primary report, verify).
- HSBC/Ipsos (June 2026, 1,115 affluent Indians): **86%** use AI for finance or investing, the highest of 10 markets, but only **15%** say AI is most influential in final decisions vs 31% for professionals; 51% want a hybrid of AI + human.
- **Implication:** demand for AI explanations exists, but trust is the gating factor, which backs D-009 (verifiable numbers) and the RIA path.

### P4 · "Good advice is unreachable" — **Strong evidence**
- **1,050** SEBI-registered investment advisers listed on SEBI's register (fetched 2 Oct 2026) vs **6.09 crore** unique MF investors (Feb 2026): about **58,000 investors per RIA** (computed; different dates, indicative only).
- RIA fees are capped at ₹1.51L per family per year or 2.5% of AUA (Cafemutual, Feb 2025), which is expensive relative to small portfolios.

### P5 · "Hidden costs erode returns" — **Strong for the secondary persona, weak for DIY**
- SEBI's own illustration: 1.5% (regular) vs 0.5% (direct) expense ratio on 10% gross returns. On ₹1,00,000 over 10 years that is ₹2,26,098 vs ₹2,47,823, a ₹21,724 gap, or **8.8%** of the direct-plan corpus (computed from SEBI's example).
- The direct-plan share of *retail* AUM rose from 21.4% to 36.7% (Mar 2021 → Mar 2026; Business Standard citing AMFI–CRISIL), so **most retail money is still in regular plans**.
- **Against (for DIY):** DIY app users are mostly in direct plans already; for them, cost drag is mainly overlapping funds and high-TER categories.

### P6 · "My portfolio is a messy pile of funds" (over-diversification / overlap) — **Weak evidence, plausible**
- Only practitioner opinion found (Business Standard, Nov 2025: advisers' ranges for how many funds to hold, and a note that 65% of equity AUM sits in large caps, creating duplicate exposure).
- No published dataset on the number of schemes per Indian investor was found. **Our own data (pilot CAS files) will be the evidence**, and that's a publishable insight in itself.

## 3. Data-access finding that changes the product
- **Investors with demat accounts already receive a CAS by email every month** from NSDL/CDSL, covering *both* MF folios and demat holdings; dormant folios get one every six months (AMFI CAS page).
- CAMS/KFintech/MF Central produce a **detailed CAS on request within minutes**, with the full transaction history XIRR needs (FundSageAI guide, 2026). Friction: the request must use the KYC-registered email, and neither RTA alone covers every AMC; MF Central combines both.
- **So:** first-time onboarding needs the *detailed* RTA CAS (full history), but the **monthly refresh can come from the CAS already landing in the user's inbox**. This makes the refresh-and-diff journey (North Star) far more realistic. See D-013 and 09-user-journeys J5.

## 4. What secondary research cannot tell us → interview guide (T-3)
1. Which of P1–P6 does a *DIY* investor feel? Rank them, then ask "when did this last cost you money or sleep?"
2. What do they do today when unsure? (Reddit, a friend, ChatGPT, nothing)
3. Would they upload a CAS to a new product? What would make them refuse?
4. Have they ever changed their portfolio because of an insight? What triggered it?
5. Phone or laptop: where do they open their CAS email and where do they manage investments?
6. Willingness to pay: what would a monthly "portfolio check-up" be worth?

**Exit criteria for problem validation:** among the 6 primary-segment interviewees (time-poor engaged, docs/11), ≥ 4 rank P1, P2 or P6 as a top-2 pain *and* ≥ 4 say they'd upload a CAS; among the 3 family proxies, ≥ 2 say they'd upload a parent's CAS. Otherwise revisit the segments (D-015).

## Sources
- SEBI Investor Survey 2025 coverage: [Business Standard, 21 Jan 2026](https://www.business-standard.com/markets/news/two-thirds-of-domestic-households-aware-of-securities-products-sebi-survey-126012100349_1.html) · [Policy Edge](https://www.policyedge.in/p/sebi-investor-survey-2025-mapping)
- [NCFE Financial Literacy & Inclusion Survey 2019, executive summary](https://ncfe.org.in/wp-content/uploads/2023/12/ExecSumm_.pdf)
- [Axis MF investor vs fund returns, via Advisorkhoj](https://www.advisorkhoj.com/news/Mutual-Fund/MFs-Investor-Returns-vs-Fund-Returns)
- [Angel One: AMFI Feb 2026 data](https://www.angelone.in/news/mutual-funds/mutual-fund-industry-adds-7-64-lakh-unique-investors-in-february-total-crosses-6-09-crore) · [IIFL: Sep 2025 SIP data](https://www.indiainfoline.com/blog/sep-25-sip-flows-at-record-29361-crore-sip-stoppage-76-3)
- [HSBC/Ipsos AI investing survey, via ETV Bharat, Jun 2026](https://www.etvbharat.com/en/technology/indian-investors-top-global-ai-adoption-charts-yet-still-trust-human-advisers-for-final-call-enn26062406036)
- [SEBI register of investment advisers](https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=13)
- [SEBI investor page: regular vs direct](https://investor.sebi.gov.in/regular_and_direct_mutual_funds.html)
- [Business Standard: direct-plan share, Sep 2026](https://www.business-standard.com/markets/mutual-fund/markets-mutual-fund-retail-investors-direct-plan-mutual-fund-aum-growth-126090600173_1.html)
- [Business Standard: how many funds to hold, Nov 2025](https://www.business-standard.com/amp/finance/personal-finance/too-many-mutual-funds-in-your-portfolio-the-sweet-spot-may-surprise-you-125110300908_1.html)
- [AMFI: Consolidated Account Statement rules](https://www.amfiindia.com/investor/become-mf-distributor?zoneName=consolidatedAcct) · [FundSageAI CAS download guide](https://www.fundsageai.com/blog/cas-statement-download-guide-india)
