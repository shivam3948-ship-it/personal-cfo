# JM Financial "Your Investment Playbook": review and ideas to borrow (22 Oct 2026)

**Source:** the 16-page PDF Shivam shared on 22 Oct. It is a JM Financial Services brochure. The footer lists the firm as a broker, a mutual fund distributor (ARN), a PMS distributor and an investment adviser. The PDF itself is not stored in the repo. Numbers below come from `docs/research/jm_playbook_check.py`.

## Verdict
- The principles are sound but generic: the same ten rules for everyone, with none of the reader's own numbers.
- Several facts are out of date or wrong (below).
- It is also a sales funnel: almost every section ends in "Suitable approach: Advisory", which is the firm's paid service.
- **The value for Munim isn't new principles.** The brochure is the status quo we're replacing. Munim applies the same rules to *your* statement and turns each one into a computed fact. That's the interview story.

## Errors and weak spots (verify before quoting any of them)

| Page | What it says | Issue |
|---|---|---|
| 8 | SIP ₹10,000/month for 10 years → ₹23.2 lakh; lump sum ₹12 lakh → ₹37.3 lakh, both at 12% | **The arithmetic checks out:** ₹23,23,391 (1% a month, start of month) and ₹37,27,018. **The comparison is unfair:** the lump sum needs ₹12 lakh on day one, while a SIP's money arrives over 10 years. It also states 6% inflation but never applies it. In today's rupees the two are ₹12,97,369 and ₹20,81,147. |
| 12 | Gold (physical/ETF): long term after 24 months | **Gold ETFs are long term after 12 months (12.5%)**; gold FoFs after 24 months (HDFC AMC leaflet, Aug 2024). |
| 9, 12 | Sovereign Gold Bonds offered as an option | **No new SGB has been issued since Feb 2024.** The government confirmed in Feb 2025 that the scheme is effectively discontinued. Existing bonds are unaffected. |
| 12 | Sections 80C, 80CCD, 54, 54EC | **The Income-tax Act, 2025 took effect on 1 Apr 2026**, and old 80C is now section 123. The brochure also never mentions the new (default) regime, where I believe 80C-type deductions such as ELSS aren't available. Verify against CBDT before any copy uses this. |
| 4 | Two sentences end mid-word ("harder to", "time to") | Editing defects. |
| 10 | Starting at 30/40/50: "Highest / Moderate / Limited" | No numbers. Illustratively, ₹10,000/month at 12% to age 60 gives ₹3,52,99,138 from 30, ₹99,91,479 from 40 and ₹23,23,391 from 50. To match the age-30 figure, you'd need ₹35,329/month starting at 40 or ₹1,51,929/month starting at 50. These are assumptions, not forecasts. |
| 10–11 | Allocation by age band ("Higher / Balanced / Moderate") | Age alone is a weak proxy, and the table has no numbers. |

## What it confirms (we already do this)
- **Emergency fund of 3–6 months of essential expenses**, kept easy to reach. That's D-040: we chose 6 months, on essentials only.
- **Keep insurance and investing separate:** the endowment "Know your return" card.
- **Past returns don't promise future ones; behaviour beats prediction:** the "How?" sheet and the x-ray caveat.
- **Compare costs:** the regular-plan fees row.

## Ideas to borrow (proposals; Shivam picks)

| # | Idea | Where in Munim | How it uses the user's own data | Pri (my rec) |
|---|---|---|---|---|
| B1 | **Risk capacity vs risk appetite**: two separate things | Invest → x-ray "mix" row; Ask Munim | **Capacity is computed:** emergency-fund months, EMI share of income, dependants, income steadiness. **Appetite is one question,** plus behaviour from the CAS: did they pause or sell in a fall? If appetite is above capacity, say so. Category level only. | P1 |
| B2 | **Review after life events**, not just yearly | Today's Sunday money call | Detect events: a salary change, a new EMI, a new premium, a large one-off credit. Then: "Something changed; review your plan?" | P1 |
| B3 | **Nomination check** | Cover sheet → rename to "Cover and family readiness" | Start as a three-tap checklist: funds, bank, policies. I'm not sure the CAS shows nominee status, so verify before trying to detect it. | **P1, cheapest** |
| B4 | **Post-tax view** | X-ray, under "Your money vs your funds" | "If you sold today, estimated tax ₹X": FIFO lots from the CAS, equity LTCG at 12.5% above ₹1.25 lakh a year. Also flag unused ₹1.25 lakh headroom before 31 Mar. Engine: lot-level FIFO, not built. | P2 |
| B5 | **Bias nudges at the moment of risk** | Invest, Ask Munim | **In a market fall:** "pausing SIPs is what puts investors behind" (reuse the x-ray caveat). **If the bank statement shows transfers to a trading app:** show SEBI's finding that 93% of individual equity F&O traders lost money (FY22–FY24). Education, not judgement. | P2 |
| B6 | **Cost of waiting, made personal** | Next move card for first-time savers (no CAS) | Replace the generic 30/40/50 table with "each year you wait, the monthly amount needed rises by ₹X", using their age and spare money. Label the return assumption. | P2 |
| B7 | **Every goal gets a horizon and a home** | Goals (already an open item) | Emergency → bank/liquid; under 3 years → debt; over 7 years → equity. Category level only. | P2 |
| B8 | **Raise the SIP when income rises** ("step-up") | Spare money card | Detect a salary rise from bank credits, then suggest moving part of the raise into the SIP. This is "Save More Tomorrow" (Thaler & Benartzi): commit future raises, not today's money. | **P1** |
| B9 | **Each asset class has a job** (growth, stability, diversifier, liquidity) | Mix row labels; Ask Munim answers | Copy only. | P3 |
| B10 | **Rebalancing drift** | X-ray, later | Only if the user sets a target mix; show drift. | Later |

**My top 3:**
- **B3 nomination:** cheap, and the harm it prevents is real.
- **B8 step-up:** uses data only Munim has, the salary credits.
- **B1 capacity vs appetite:** the honest version of a risk profile.

## Don't borrow
- Allocation tables by age band.
- "Suitable approach: Advisory" tags. That's a sales funnel, and it conflicts with our rule never to position as an adviser.
- The SIP vs lump-sum framing.
- The PMS/AIF/InvIT product shelf (wrong audience, D-035).
- FAQ answers that boil down to "it depends".

## Engine and doc follow-ups if picked
- **B1:** `riskCapacity()` from existing facts.
- **B2/B8:** `incomeRange()` (already pending) plus event detection.
- **B4:** `lotsFIFO()` and `taxIfSoldToday()`.
- **B5:** a merchant tag for trading apps in Spends.
- **Docs:** each pick gets a row in DECISIONS.md and events in docs/39.
- **Tax copy:** update it for the Income-tax Act, 2025 section numbers.

## Sources
- [HDFC AMC: Gold and silver simplified taxation leaflet (Aug 2024)](https://files.hdfcfund.com/s3fs-public/Others/2024-08/Gold%20and%20Silver%20simplified%20taxation%20Leaflet%20(August%202024).pdf)
- [Wikipedia: Sovereign Gold Bond](https://en.wikipedia.org/wiki/Sovereign_Gold_Bond) (cites the Feb 2025 post-Budget statement)
- [TaxGuru: Chapter VI-A deductions reorganised under the Income-tax Act, 2025](https://taxguru.in/income-tax/chapter-vi-a-deductions-reorganised-chapter-viii-income-tax-act-2025.html)
- [SEBI press release, Sep 2024: 93% of individual traders lost money in equity F&O, FY22–FY24](https://www.sebi.gov.in/media-and-notifications/press-releases/sep-2024/updated-sebi-study-reveals-93-of-individual-traders-incurred-losses-in-equity-fando-between-fy22-and-fy24-aggregate-losses-exceed-1-8-lakh-crores-over-three-years_86906.html)
