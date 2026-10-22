# Portfolio insights: what six Indian apps give customers (22 Oct 2026)

**Why:** Shivam found X-ray v1 generic: it described the portfolio but never said "do this, worth ₹X". This scan checks what newer Indian wealth apps actually show, so X-ray v2 is at least table stakes and better where it can be.
**Method:** public pages only (websites, App Store or Play listings, press). Nothing was tested in-app, so each claim is "as described by the company". Sources are at the end.

## Summary
| App | Data in | Portfolio insights they describe | Actions | Model / status |
|---|---|---|---|---|
| **PowerUp Money** | MF portfolio fetched by PAN + consent | Each equity/hybrid fund rated In-form / On-track / Off-track / Out-of-form; rank trends; peer comparison (consistency, recency, volatility); rolling returns; portfolio vs Nifty 50; monthly review alerts | Start / pause SIP, exit fund; quarterly tax-efficient rebalancing (Elite) | SEBI RIA (INA000019798); fund picks ("Power Rank") |
| **Stack Wealth** | Stocks, MFs, bank, insurance | Free portfolio review with a "health score": risks, overlaps, diversification gaps, underperformers | Alternatives to underperformers, rebalancing, curated portfolios; monthly reports | SEBI RIA, fixed fee only; multi-asset incl. US stocks, PMS |
| **Corpus Labs** | CAS upload or Account Aggregator | Regular vs direct cost gap, fund overlap, idle bank balances, realised / unrealised gains, asset-allocation drift; old vs new tax regime tool | None: "read-only", no fund recommendations | Pre-seed ($4.2 Mn disclosed); reported talks with Stellaris |
| **Cruise Money** | Account Aggregator + CAS | "WealthSpan Score"; time-sensitive alerts (idle cash, overlapping funds, tax-saving deadlines); regular vs direct; retirement falling behind; Q&A on your own data; "Safe to Spend" | AI recommendations reviewed by a SEBI RIA; an "agentic card" was previewed (awaiting approval) | Subscription; founded 2025 |
| **Tribe Money (tr/be)** | Spending, savings, investments, loans | Suggestions such as idle savings into an FD, regular to direct, an unused tax opportunity, a better card | "AI autopilot" for idle cash and goals | Peak XV Surge (2026); about 1K Android installs; no regulator registration listed |
| **Curie Money** | Its own liquid-fund account | None described; it's a savings and payments product | Park money in a liquid fund and pay by UPI from it | NPCI approval reported Oct 2025; seed $1.2 Mn |

## What this means for Munim
1. **Table stakes:** regular-to-direct, overlap, idle cash and a tax deadline appear across Corpus, Cruise and Tribe. An x-ray without them looks behind.
2. **Nobody we read prices the switch.** Corpus, Cruise and Tribe flag "regular costs more". None of their public pages shows the tax and exit load of switching, a payback period, or the zero-cost first step (send new SIPs to direct). Munim can own "**net of the cost of acting**".
3. **Fund ratings and exit calls need a licence.** PowerUp's In-form / Out-of-form and Stack's "alternatives to underperformers" are fund-level advice, given as RIAs. Before a licence, Munim stays at plan type, tax, timing and comparison with a plain index fund. It never says "exit this fund" or names a fund to buy (AGENTS.md rule 1).
4. **The differentiators Munim already has:** "your money vs your funds" (behaviour-aware), the link to the safety net (the debt fund counts towards it), and voice/Hindi. Corpus is closest in scope but read-only, with no voice.
5. **Curie points to the savings pot.** Curie answers the open question in docs/37 §8 of where pot money goes: a liquid fund you can still spend from via UPI. Worth a look when the pot design is picked up.

## X-ray v2 (mocked, awaiting review)
Every insight leads with a rupee figure, gives a next step and, where one exists, a deadline. The numbers come from `docs/research/xray_v2_numbers.py` (FIFO lots from the sample CAS):
1. **Book ₹1,25,000 of gains tax-free before 31 Mar** (167 days left). There are ₹3,92,302 of long-term gains; booking them cuts future tax by about ₹15,625. The plan does this by moving 26 old regular-plan instalments (₹2,42,817, gain ₹1,24,817) to direct: no tax now, about ₹15,602 less tax later and about ₹2,185 a year less in fees.
2. **Regular plans cost about ₹8,349 a year** (estimate), with three options, cheapest first:
   - send the ₹7,000-a-month SIPs to direct (₹0 cost);
   - move units within the tax-free limit (no tax);
   - move all long-term units (₹8,41,520): tax about ₹27,315, saves about ₹7,574 a year, pays for itself in about 3.6 years.

   Leave units under a year old (₹86,149) where they are.
3. **₹2,78,978 of Teak ELSS is out of lock-in.** All three lump sums are past 3 years. Note that buying ELSS again starts a new lock-in, and the new tax regime gives no deduction.
4. **Monsoon Small Cap trails a plain Nifty 50 index fund by ₹17,933 on the same 41 SIP dates** (₹92,440 vs ₹1,10,373 on ₹82,000 invested). This is framed as "what its extra risk has paid so far, not a forecast". Kestrel and Teak need index prices from 2021, which the sample doesn't have (a data gap; the build needs AMFI/NSE index history).

**⚠ To verify before launch:**
- the ₹1.25 lakh exemption and 12.5% / 20% rates for FY 2026-27 under the Income-tax Act, 2025;
- exit loads per scheme (not in the CAS);
- the regular-vs-direct fee gap (still an estimate, D-OPEN-3).

## Deeper scan (22 Oct, same day): traction, users, founders
Two research passes (traction signals; user and founder statements). Facts below are as reported, with dates; unverified items are marked. Reddit, X and YouTube turned up nothing usable for any of the six. Archive snapshots of Corpus and Tribe couldn't be fetched.

| | Funding | Play installs | Ratings (Play / iOS) | Regulatory | Pricing | Stated scale |
|---|---|---|---|---|---|---|
| **PowerUp Money** | $7.1M seed (Jun 2025) + $12M Series A, Peak XV (Dec 2025) | 1M+ | 4.7 (10.6K) / 4.4 (442) | RIA INA000019798 | Free tracking; Elite ₹999/yr | 5L+ users, ₹65,000 Cr tracked, 25K+ paid (Dec 2025); ~₹2.5 Cr ARR (= 25K × ₹999) |
| **Stack Wealth** | $4.5M seed (Dec 2021); nothing newer found | 50K+ (new app) / 5K+ (old) | 4.3 (110) and 3.3 (101) / 3.7 (65) | RIA INA000021313 + an ARN (numbers conflict across listings) | ₹2,471.66–3,177.91 a month, billed yearly | FY25 revenue ₹51.7L, down 43% (Inc42); AUM claims conflict |
| **Corpus Labs** | $4.2M pre-seed (site); Stellaris talks unconfirmed | no app | n/a | "In process of getting SEBI registration" | not found | not found |
| **Cruise Money** | not found | no app (beta waitlist, "Diwali 2026") | n/a | site shows RIA INA000018294 (not checked on SEBI's register) | "commission-free"; no prices | under 10 staff |
| **Tribe (tr/be)** | Peak XV Surge 12; $1M only on an auto-generated site (unverified) | 1K+ | 4.1 (30) | none shown | not found | not found |
| **Curie Money** | $1.2M seed (Dec 2024) | 500K+ | 4.4 (4.83K) / 4.1 (198) | AMFI distributor (ARN), NPCI third-party UPI app | Free; 0.05–0.20% commission from fund houses | FY25 revenue ₹31.8L (Inc42) |

**What users and founders say:**
- **PowerUp:**
  - *Bet:* the advice gap. People start SIPs, then neglect their portfolios for years.
  - *Pitch:* trust through a flat fee and human-reviewed calls.
  - *Praise:* the clean four-tier fund verdict.
  - *Complaints:* rebalancing stays within the same category; one user found the analysis "not very useful"; an offer wasn't honoured; deactivating needs an email.
  - *Claims:* users beat category averages by 3–7% (company claim, unverified).
- **Stack:** most complaints are about money movement (slow withdrawals, double-debited SIPs). The relationship manager and monthly reports are liked. Most reviews are from 2024.
- **Corpus:** its search title read "See What Your Mutual Funds Are Costing You", so cost was the hook. It's now in maintenance mode, seeking SEBI registration, and mentions Gmail read-only statement discovery. **A read-only analyser seems to hit a ceiling unless it can say what to do** (inference).
- **Cruise:** the co-founder frames the problem as "whether any of it is actually working": the same job as our P0. Its positioning (AI, an RIA reviewing recommendations, Q&A on your own data, no selling) is **the closest to Munim's**. It hasn't launched.
- **Tribe:** money movement (remittance, transfers) generated its worst reviews. It's now being rebuilt.
- **Curie:** users are confused about whether the balance can fall, and about the ~₹50K instant-withdrawal cap.

**What changes for Munim:**
1. **Users pay for a verdict plus an action, not for diagnostics.** PowerUp is the only one with paid traction, and it sells a call on each fund (in-form or out-of-form, then start, pause or exit). Before a licence, Munim's call has to come from plan type, tax and timing, which is what X-ray v2 does. A per-fund verdict needs the RIA path or a licensed partner.
2. **Close the loop: "did it work?"** No one shows whether past advice paid off. Add a follow-up line after an action, e.g. "since you moved to direct: ₹X fees saved so far". That makes the "measured savings" business goal (D-038) visible to the user.
3. **Don't move money yet.** The worst reviews at Tribe and Stack are about transfers. Our "no real money movement" rule (D-036) avoids that failure for now.
4. **Watch Cruise.** It has the same job and the same AI pitch, and it's launching around Diwali 2026. It's the most direct competitor for the interview story.
5. **Curie's 500K+ installs suggest "spend from a liquid fund" works as a hook.** Use it as a reference when designing the savings pot.

**Still open:**
- App-store review mining (the stores block both our sandbox and your Mac's Linux environment; the script runs from your Mac's own terminal).
- SEBI complaint tables (these pages need JavaScript).
- Cruise's funding.
- Checking the RIA numbers on SEBI's register.

**Extra sources (deeper scan):** [Entrackr: PowerUp Series A](https://entrackr.com/news/powerup-money-raises-12-mn-in-series-a-round-led-by-peak-xv-10930747) · [Inc42: PowerUp $12 Mn](https://inc42.com/buzz/powerup-money-bags-12-mn-to-expand-mutual-fund-advisory) · [Outlook Business: PowerUp seed](https://www.outlookbusiness.com/corporate/wealthtech-start-up-powerup-bags-71-mn-from-accel-blume-ventures-other-investors) · [The Week/PTI: PowerUp CEO interview](https://www.theweek.in/wire-updates/business/2025/07/24/dcm23-powerup-money-ceo-interview.html) · [Blume: why we invested](https://infullblume.substack.com/p/why-we-invested-in-powerup-money) · [PowerUp: in-form and out-of-form](https://www.powerup.money/blog/newsletter/in-form-and-out-of-form-what-does-this-mean) · [Random Dimes review](https://randomdimes.com/powerup-money-review/) · [DesiDime thread on PowerUp](https://www.desidime.com/discussions/anyone-using-powerup-money-app-for-rebalancing-mfs) · [Inc42: Stack Wealth](https://inc42.com/company/stack-wealth/) · [Stack pricing](https://stackwealth.in/pricing-plan) · [Corpus Labs site](https://corpuslabs.in/) · [Cruise Money site](https://www.cruise.money/) · [exchange4media: Cruise co-founder](https://www.exchange4media.com/people-movement-news/dream-sports-vikrant-mudaliar-joins-cruise-money-as-co-founder-157838.html) · [Inc42: Peak XV Surge 12](https://inc42.com/buzz/meet-the-startups-from-peak-xvs-surge-12/) · [Tribe Money site](https://www.tribemoney.ai/) · [Entrackr: Curie seed](https://entrackr.com/snippets/fintech-startup-curie-money-raises-12-mn-in-seed-round-8495734) · [Curie terms](https://www.curie.money/terms) · [Curie on Play](https://play.google.com/store/apps/details?id=com.yield.curie_money&hl=en_US)

## App-review mining (22 Oct): Google Play, newest first
Scripts: `docs/research/reviews/` (run on Shivam's Mac; reviewer names dropped; the raw file stays out of the repo). Counts come from keyword rules in `analyse.py`, so treat them as indicative, not exact.

| App | Reviews pulled | Period | Avg ★ (pulled) | 1–2★ |
|---|---|---|---|---|
| PowerUp Money | 6,000 (cap) | Oct 2025 – Oct 2026 | 4.55 | 576 (9.6%) |
| Curie Money | 1,591 | Nov 2024 – Oct 2026 | 3.67 | 471 (29.6%) |
| Stack Wealth (new + old app) | 166 | Jun 2024 – Sep 2026 | 3.84 | 47 |
| Tribe Money | 18 | Jul – Sep 2026 | 3.56 | 7 |

**PowerUp:**
- 84.2% of the pulled reviews are 5★ and 77.7% are under 40 characters. One widely upvoted 1★ review claims the ratings are inflated (unverified).
- Among the 576 1–2★ reviews:
  - worries about spam calls, data use or asking for PAN + phone: 91;
  - upsell or price rise: 89;
  - slowness or bugs: 81;
  - stale prices or failed fetch: 67.
- **Asks that matter for the x-ray:**
  - many funds are unrated (thematic, sectoral, debt);
  - "recommends a top fund from the same category; doesn't check whether I should be in that category at all";
  - doesn't suggest merging similar funds;
  - doesn't say whether I'm over- or under-diversified;
  - can't save or print reports.
- **Praise:** clean, uncluttered UI; learning about regular vs direct; capital-gains insight; "suggests what to fix".

**Curie:**
- Users love the concept (spend by UPI from a liquid fund).
- 86 of the 471 1–2★ reviews are about money stuck on withdrawal or redemption. Support complaints follow.
- A request from students: lower the minimum top-up.

**Stack:** withdrawals not credited, no support, account deletion ignored (mostly 2024).

**What changes for Munim:**
1. **Trust is the top complaint, not insight quality.** Don't ask for PAN + phone before showing value. Say clearly that the CAS is read on the phone. No spam, no hard upsell.
2. **Cover every fund.** A rating system leaves unrated dead ends. Munim's plan-type, tax and lock-in insights work for any fund, debt and thematic included.
3. **Advice across categories is what users ask for.** The money path (safety net, then debt, cover and the equity/debt mix) already works across categories. Lean on it in the x-ray.
4. **Merging similar funds** needs fund overlap (D-OPEN-3).
5. **Add "Save or share this report" (PDF)**: it's cheap, and users ask for it.
6. **Show data freshness** ("CAS of 15 Oct"). We already do; keep it.

## Sources
- [PowerUp Money website](https://powerup.money/) · [PowerUp App Store listing](https://apps.apple.com/in/app/powerup-money-mutual-funds/id6470202376)
- [Stack Wealth website](https://stackwealth.in/) · [Stack Wealth llms.txt](https://stackwealth.in/llms.txt)
- [Inc42 on Corpus Labs](https://inc42.com/buzz/peak-xv-alum-saksham-mittals-corpus-labs-in-talks-to-raise-funding-from-stellaris/)
- [Cruise Money on GetApp](https://www.getapp.com/all-software/a/cruise-money/) · [Cruise Money on YourStory](https://yourstory.com/companies/cruise-money) · [Cruise agentic card press release (sponsored)](https://theprint.in/ani-press-releases/cruise-money-showcases-indias-first-agentic-card-an-ai-money-companion-that-plans-decides-pays-on-the-users-behalf/3050638/)
- [Tribe Money on Google Play](https://play.google.com/store/apps/details?id=ai.tribemoney.app&hl=en_IN) · [Tribe Money on Peak XV Surge](https://surge.peakxv.com/companies/tribe-money)
- [Curie Money App Store listing](https://apps.apple.com/in/app/curie-money/id6446487532) · [D2C Insider on Curie's NPCI approval](https://pulse.d2cinsider.com/curie-money-gets-npci-nod-launches-nationwide-upi-investing-platform/)
