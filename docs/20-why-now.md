# 20 · Why now

**Status:** v1 · 2026-10-15 · consolidates and extends docs/01 §4 and docs/13 §6. Every item has a date and a source; ⚠ marks what still needs a primary-source check (a SEBI circular or gazette, not a news summary).
**The one-line answer:** the regulator has made it **cheaper to become a licensed, AI-using adviser**, **harder to win with unlicensed tips and data shortcuts**, and (Sep 2026) has opened a **low-ticket, direct-plan-only PMS route for mutual-fund portfolios**. Meanwhile LLMs and Indian-language voice became cheap enough to give a ₹-level answer to anyone. A trusted, licensed, AI-native personal CFO fits through that window.

## 1. Regulation: tailwinds
### 1.1 Becoming an investment adviser got much easier (Dec 2024)
**What changed:** SEBI (Investment Advisers) (Second Amendment) Regulations, 2024, notified December 2024 (details in docs/03 §2).

| Before | After |
|---|---|
| Post-graduate qualification plus years of experience | Graduate in any discipline + NISM certification; **experience requirement removed** |
| Net-worth requirement | **Deposit** instead: ₹1L (≤150 clients) up to ₹10L (1,001+ clients) |
| Full-time only | **Part-time advisers allowed**; they must say so in all client communication; a cap of 75 clients is reported |

Fee caps (₹1.51L per family per year, or 2.5% of AUA) are confirmed in the SEBI IA FAQ, Aug 2025.
- **Why it helps us:** the RIA licence that gates our advice and our launch (D-006, D-021) is now a deposit plus an exam, not years of experience. Shivam is likely eligible (graduate); D-OPEN-2 becomes a real option, not only a partner deal.
- **Risk:** employment conditions for part-time advisers are unclear, and a full-time wealthtech job may conflict (D-OPEN-2). ⚠ Confirm which NISM exam(s) apply now.
- Sources: [Upstox, 17 Dec 2024](https://upstox.com/news/business-news/financial-regulations/sebi-allows-part-time-investment-advisers-puts-conditions-for-ai-use-all-you-need-to-know/article-135636/); SEBI IA FAQ (Aug 2025, cited in docs/03).

### 1.2 Clear rules for advisers using AI (Dec 2024)
**What changed:** the same amendment says an adviser using AI tools must **disclose the extent of AI use to clients** and is **solely responsible** for client data security and confidentiality and for the compliance of the AI's output.
- **Why it helps us:** the rules are now explicit instead of grey. Our design already meets them: an AI-use disclosure screen, a per-answer AI label, numbers from code (D-009), a number guard, an audit trail and evals as gates. "Compliant AI advice" becomes a feature competitors must retrofit.
- **Related, not final:** SEBI's consultation paper on AI/ML guidelines for market participants, **20 June 2025**. It proposes model governance, records of model development, testing and monitoring, and clear accountability for AI-driven decisions, covering advisory and portfolio management. ⚠ I found no confirmation that it has been finalised; check SEBI's site. Source: [Taxmann summary](https://www.taxmann.com/post/blog/sebi-proposes-ai-ml-governance-framework-for-securities-markets).

### 1.3 New PMS rules: a low-ticket, mutual-fund-only route (approved 24 Sep 2026)
**What changed:** SEBI's 215th board meeting (24 Sep 2026) approved the **SEBI (Portfolio Managers) Regulations, 2026**, replacing the 2020 regulations. For us, the important part is the new **mutual-fund-only route ("PRIM")**: portfolio managers investing client money **only in direct plans of mutual funds**, including ETFs, index funds and Specialised Investment Funds.

| Item | PRIM route (as approved) | Ordinary PMS |
|---|---|---|
| Minimum per client | **₹25 lakh** | ₹50 lakh |
| Portfolio manager net worth | **₹2 crore** | ₹5 crore (as reported for the 2020 regime) |
| Fees | Fixed fee capped at **1% of AUM** + performance fee (the July 2026 proposal said 2.5%; the board approval as reported by Khaitan & Co says 1%) | Not capped this way |
| Other | Exit loads waived; group-AMC schemes capped at 25%; MF distribution and PRIM segregated (except accredited investors); simplified principal-officer qualification (graduate/CFA/CA + 2 years + a simplified NISM certificate) | — |

The same package also covers overseas investments, IPOs, up to 10% in unlisted investment-grade debt, derivatives up to 1.25× AUM, independent fund managers, and a new accreditation route. Effective date: ⚠ not stated in the sources found; wait for the gazette notification.
- **Why it helps us:**
  1. **A second licence path beside RIA.** A family like Priya's father (₹40L, all regular plans) could have the portfolio *managed* in direct plans at ≤ 1% a year, instead of only being advised. That's a revenue model (D-OPEN-5) that monetises our analysis without distribution commissions (D-007 intact: direct plans only).
  2. **Data access.** PMS-licensed firms are among those who can pull MF data through Account Aggregator (docs/03, D-018), the same route the RIA licence opens.
  3. **Market signal.** The regulator is pushing mutual-fund investors from regular plans to direct plans through low-cost, licensed managers. That is exactly the "hidden cost" problem we diagnose (docs/08 P5).
- **Risk / honesty:** ₹2 crore net worth is out of reach for a solo founder, so this is a *partner or later-stage* path. The ₹25L minimum fits the secondary persona (family proxy), not Rohan. ⚠ Verify the final regulations once notified, since sources differ on the fee cap.
- Sources: [Khaitan & Co, Ergo on the 24 Sep 2026 board meeting](https://www.khaitanco.com/sites/default/files/2026-10/Ergo_Draft%20PMS_SEBI%20Board%20Meeting_06102026.pdf) · [Hubbis, approval summary](https://hubbis.com/news/sebi-approves-pms-overhaul-including-overseas-investments) · [Business Today, proposals, 23 Jul 2026](https://www.businesstoday.in/mutual-funds/story/sebi-plans-massive-overhaul-of-portfolio-manager-rules-here-are-the-proposed-changes-544903-2026-07-23) · [Cyril Amarchand on the proposed overhaul, Aug 2026](https://corporate.cyrilamarchandblogs.com/2026/08/sebis-proposed-overhaul-of-the-pms-regulatory-framework/)

### 1.4 The finfluencer crackdown cleared the field for licensed voices (Aug 2024, Jan 2025)
- **Aug 2024:** SEBI-regulated entities may not associate (payments, referrals, tech integrations) with unregistered people who give securities advice or claim returns; pure investor education is exempt. Board approval 27 Jun 2024; notifications 26 Aug 2024, effective immediately.
- **29 Jan 2025:** people offering investor education may not use market price data from the **preceding three months**, closing the "education as cover for tips" loophole.
- **Why it helps us:** the tips economy that drove decisions (docs/08 P3) lost its distribution through brokers and AMCs. Demand for *licensed, personalised* guidance has nowhere easy to go; that's our lane. It also constrains us: content marketing must stay educational until we're licensed (D-021).
- Sources: [Taxmann on the Aug 2024 rules](https://taxmann.com/post/blog/analysis-sebis-new-regulations-on-finfluencers-protecting-investors-from-unregistered-advisors) · [Business Standard on the Jan 2025 circular](https://www.business-standard.com/markets/news/sebi-finfluencer-circular-live-stock-data-market-education-rules-125013000571_1.html)

## 2. Regulation: shortcuts that closed (they favour licensed players)
| Change | Date | Effect on us | Source |
|---|---|---|---|
| AMFI asked MF Central to stop sharing investor data directly with fintech apps | Reported Sep 2025 (⚠ verify the circular) | Unlicensed portfolio aggregators lose the easy data route; AA via an RIA or PMS becomes the moat (D-018) | docs/03 |
| DPDP Rules notified | 13 Nov 2025; main obligations from 13 May 2027 | Raises the privacy bar; on-device parsing and minimal data (D-017) become a selling point, not a cost | docs/03 §4 |

## 3. Technology
| Shift | Why now | Source / confidence |
|---|---|---|
| LLMs can explain a *specific* portfolio or statement in plain language, with tools for exact maths | Became reliable and cheap from 2023 on; evals make quality measurable | General knowledge; our own evals (tech/AI_EVALS.md) |
| Indian-language voice is cheap and good | Sarvam STT about ₹0.49/min, TTS ₹2–3 per 1,000 characters (listed prices), so about ₹1 per voice turn (computed, docs/16) | Vendor pricing; ⚠ re-verify |
| Rails for data | CAS gives full MF history in minutes; Account Aggregator covers bank and MF data for regulated FIUs | docs/08 §3, docs/03 |

## 4. Market (evidence in docs/08)
- **Self-directed investors are growing:** retail direct-plan share rose from 21.4% to 36.7% (2021 → 2026). More money is invested without an adviser in the loop.
- **Advice is scarce:** 1,050 SEBI-registered investment advisers vs 6.09 crore unique MF investors, about 58,000 investors per RIA (computed; different dates, indicative only).
- **Investors want AI but trust humans for the final call** (HSBC/Ipsos, Jun 2026): a licensed, explainable AI fits that gap.

## 5. Why *not* earlier, and why not later
- **Earlier (before 2024):** becoming an RIA needed experience and net worth, AI rules were undefined, LLMs couldn't do grounded, cheap explanations, and Indian-language voice was poor or expensive.
- **Later:** funded players are already moving (docs/02). Once AA plus licensed advice is commoditised, the "trusted version" position is taken. The PMS 2026 rules will attract incumbents to the low-cost direct-plan route within a year or two (my estimate).

## 6. What this changes in our plan (proposals, not yet decisions)
1. Add **"PRIM / MF-only PMS via a partner"** as a third option in D-OPEN-2 and as a revenue option in D-OPEN-5.
2. Build the **AI-use disclosure screen** (Dec 2024 rule) into the Phase 1 onboarding, not later.
3. Track the **SEBI AI/ML guidelines** status (L-2) and the **PMS 2026 effective date** (new legal task).
