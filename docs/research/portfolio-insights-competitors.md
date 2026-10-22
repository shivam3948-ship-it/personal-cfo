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

## Sources
- [PowerUp Money website](https://powerup.money/) · [PowerUp App Store listing](https://apps.apple.com/in/app/powerup-money-mutual-funds/id6470202376)
- [Stack Wealth website](https://stackwealth.in/) · [Stack Wealth llms.txt](https://stackwealth.in/llms.txt)
- [Inc42 on Corpus Labs](https://inc42.com/buzz/peak-xv-alum-saksham-mittals-corpus-labs-in-talks-to-raise-funding-from-stellaris/)
- [Cruise Money on GetApp](https://www.getapp.com/all-software/a/cruise-money/) · [Cruise Money on YourStory](https://yourstory.com/companies/cruise-money) · [Cruise agentic card press release (sponsored)](https://theprint.in/ani-press-releases/cruise-money-showcases-indias-first-agentic-card-an-ai-money-companion-that-plans-decides-pays-on-the-users-behalf/3050638/)
- [Tribe Money on Google Play](https://play.google.com/store/apps/details?id=ai.tribemoney.app&hl=en_IN) · [Tribe Money on Peak XV Surge](https://surge.peakxv.com/companies/tribe-money)
- [Curie Money App Store listing](https://apps.apple.com/in/app/curie-money/id6446487532) · [D2C Insider on Curie's NPCI approval](https://pulse.d2cinsider.com/curie-money-gets-npci-nod-launches-nationwide-upi-investing-platform/)
