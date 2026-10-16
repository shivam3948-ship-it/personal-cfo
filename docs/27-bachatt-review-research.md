# 27 · Bachatt deep dive: 15,530 Android + 74 iOS reviews (16 Oct 2026)

**One line.** Bachatt's problem is not getting people to save; it is the moment they want the money back. That moment has three parts, and a voice agent with account context can fix each one:
- **Slow or unclear withdrawals:** about 72% of withdrawal complaints.
- **Rules nobody explained:** the instant-access cap, separate folios, the ₹49 charge.
- **Replies that can't see the account,** so users are asked to explain again.

The page is `/research/bachatt`; the data is `apps/web/data/research-bachatt.json`.

## Data and method
- **Android.** Every written Google Play review the store returned when sorted newest-first: **15,530 reviews from 24 Apr 2025 to 15 Oct 2026**. This was topped up with 2,000 "most relevant" and 2,000 sorted by rating.
  - The listing shows 4.6★ from 1.77L ratings; most ratings have no text.
  - Bachatt's reply text was captured too.
  - Names were dropped. A flag was kept for display names that look like referral codes.
- **iOS.** 74 App Store India reviews, which is everything the RSS feed returned.
- **Raw files** stay on Shivam's Mac (`~/Downloads/bachatt_*_reviews_2026-10-16.json`), **not in the repo**.
- **Coding.**
  - I read 110 low-rated and 45 high-rated reviews to build a Bachatt codebook (`docs/research/bachatt-reviews/bcodebook.py`).
  - The codebook was applied to the 1,020 reviews rated 1–3★ with at least 20 characters.
  - Withdrawal sub-types were **hand-coded on a random 100** (`wsample_labels.json`, labels only).
  - Precision of the main themes: withdrawal 94/100, support 8/8, "instant" promise 8/8, fees 7/8, OTP/KYC 7/8, debit not reflected 6/8. "Double debit" scored 3/8 and is not used.

## Findings
**1. Ratings.**
- Written Android reviews average 4.4★; 10.8% are 1–2★.
- iOS averages 3.0★ (n=74), and 36 of the 74 are 1–2★. The sample is small but the gap is large.
- 79.6% of written reviews are 15 characters or fewer ("good", "nice").

**2. What low ratings are about** (share of 1,020):

| Theme | Share |
|---|---|
| Any withdrawal problem | 38.2% |
| Calls it fraud / scam / fake / chor | 25.3% |
| Support unreachable or unhelpful | 10.1% |
| Fees: ₹49 Elite/maintenance/"AMC" charge, commission, unexplained deduction | 5.1% |
| "Instant withdrawal" or "no charges" promise not met | 3.7% |
| Debited but "in progress" / failed / missing | 3.6% |
| OTP, KYC, PAN, penny-drop, bank change | 3.6% |
| Got back less than put in | 2.5% |
| CIBIL check, permissions, data | 1.9% |
| Loan section (rejections, calls) | 1.6% |
| Separate folio per daily saving | 1.2% |
| Referral reward not received | 1.1% |

- "Fraud" appears in 29.2% of withdrawal complaints and 22.9% of the others.
- The earlier four-app pass (docs/26) gave 44.1% for withdrawals. That used a different sample (3,837 reviews) and a different codebook; this number is the better one.

**3. Inside withdrawal complaints** (100 read by hand, 94 on topic; a review can carry more than one tag):
- Slow, taking days or weeks: **43.6%** (95% range 34–54%).
- "Doesn't happen", with no detail: **28.7%** (20–38%).
- Shows "successful" but the money isn't in the bank: 11.7%.
- Charges, or got back less: 11.7%.
- Failed or cancelled, often repeatedly: 8.5%.
- Only part can be withdrawn (folios, 70–90%): 8.5%.
- Flags: 8 cite the "instant withdrawal" promise and 6 needed the money for an emergency.

**4. Promise vs rule.**
- The listing says Insta Fund withdrawal is "instant… redeem in seconds… subject to SEBI's Instant Access Facility limits".
- The limit is the lower of **₹50,000 or 90% of holding value**, per investor, per day, per scheme. Source: PPFAS AMC's summary of SEBI's MF Master Circular (27 Jun 2024, 14.9); ⚠ verify against the circular itself.
- Some reviews say 90% came out at once. Others report 70% or half, which this rule alone doesn't explain.
- Gold, silver and other funds are not instant, but several users expected them to be.
- Liquid-fund exit loads are tiny: 0.0070% on day 1, nil from day 7 (SEBI, Oct 2019). So complaints about "5% charges" probably come from other charges. **I couldn't verify which.**

**5. Replies.**
- Bachatt replies to 89.5% of reviews, with a median of 1 day.
- On 1–2★ reviews, 72.3% of replies point to a phone number.
- On withdrawal complaints, 54% of replies say the problem wasn't understood. This is fair, since a public review has no account details, and it is exactly what an in-app agent with context fixes.
- Five templates cover 51.7% of replies to low ratings.
- Templates appear to follow the review text rather than the stars:
  - 228 one-star reviews (16.5%) say only "good" or "nice", which suggests a mis-tap on the stars;
  - about 22 clearly negative reviews still got a "please rate 5 stars" reply.

**6. Over time.** Withdrawal complaints per 1,000 reviews:

| Quarter | Per 1,000 reviews |
|---|---|
| 2025 Q3 | 36.4 |
| 2026 Q1 | 41.0 (highest) |
| 2026 Q2 | 32.2 |
| 2026 Q3 | 31.1 |
| 2026 Q4 to date | 23.2 |

Review volume grew about 10× over the period, so the early quarters are noisy. By app version, 5.0.3 had the most withdrawal mentions (52.1 per 1,000) and 5.2.1 the fewest (19.5).

**7. The "most relevant" list.**
- 24 near-identical 5★ reviews describe a different kind of app ("syncing", "stop an entry"). Together they carry 516 helpful votes, and they sit in the "most relevant" list a new visitor sees first.
- Treat the newest reviews, not the "most relevant" ones, as the voice of users.
- This is a data-quality note. It is not a claim about who wrote those reviews.

**8. Praise is thin and early.** Among 1,452 written 4–5★ reviews:
- easy: 6.3%;
- safe: 3.8%;
- "just started, will see when I withdraw": 3.1%;
- daily habit: 3.0%.

Most 5★ reviews are written before the user has ever withdrawn.

## What this changes in the prototype
- **New:** "पूरा पैसा एक साथ क्यों नहीं?" uses `instantSplit()` to say how much comes now and how much on the next working day. The maths is in integer paise, and the numbers are checked.
- **Already built** (docs/26): withdrawal status from the request record, with a bank reference once paid and a person in one step if it's late; a debit check; a value breakdown.
- **For the pitch** (see `/research/bachatt`):
  1. A withdrawal tracker you can ask.
  2. Say the instant-access split before the user withdraws.
  3. Explain each charge the moment it hits.
  4. Support that sees the account, instead of "WhatsApp us".
  5. One spoken "withdraw all" across folios.
  6. Measure satisfaction from text or voice, not star taps.

## Limits
- Reviews show what goes wrong, not how often; most savers never write one.
- There was one coder. The precision checks used small samples, and recall was not measured.
- Bachatt's internal data (tickets, payout timings, the Elite fee terms) was not available, so causes are users' words, not facts.
- The iOS sample is 74 reviews.
