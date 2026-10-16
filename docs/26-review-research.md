# 26 · Research: what 15,532 Play Store reviews say, and what it changed (16 Oct 2026)

**Question.** What a top PM would ask before building more: *what goes wrong for people who save small amounts in an app, and where would a voice agent actually help?*

**Answer in one line.** For micro-savings apps the problem is the moment people try to get their money back. More than half of low-rated Bachatt and Jar reviews are about withdrawals. When a withdrawal is stuck, an AI bot that won't hand over to a person makes things worse. So Munim's job is not chat. It is to:
- answer "where is my money" from the real record;
- show the math when the value looks wrong;
- catch extra debits;
- reach a human in one step.

## 1 · Raw material and method
- **Source.** Public Google Play reviews (hl=en_IN, gl=IN), collected on 16 Oct 2026 through the store's own review endpoint in a signed-in browser.
  - Per app: the newest 3,000 reviews plus the 1,000 "most relevant".
  - Apps: Bachatt (`app.bachatt.customer`), Jar (`com.jar.app`), Groww (`com.nextbillion.groww`) and ET Money (`com.smartspends`).
  - Total: **15,532 reviews**. Reviewer names and IDs were dropped at collection.
  - The raw text is kept on Shivam's Mac (`~/Downloads/playstore_reviews_2026-10-16.json`), **not in the repo**.
- **Coding.**
  - An inductive read of 140 random low-rated reviews produced a codebook of 12 themes. The codebook uses word-boundary regex in English, romanised Hindi and Devanagari: `docs/research/play-reviews/codebook.py`.
  - The codebook was applied to every 1–3★ review with at least 20 characters: 1,707 from the savings apps, 2,926 from the investing apps.
  - **Precision check:** I read 10 coded reviews per theme. Withdrawal 9/10, support 9/10, bugs 8/10, the other money themes 7/10. "Permissions/privacy" scored 4/10 and was dropped.
  - 33.1% of low-rated reviews matched no theme.
- **Reproduce:** `REVIEWS_JSON=<raw file> python3 docs/research/play-reviews/analyse.py`. The aggregates the app shows are in `apps/web/data/research-play-reviews.json`, and the page is `/research`.

## 2 · Findings (share of 1–3★ reviews with text)
| Theme | Savings apps (Bachatt, Jar) | Investing apps (Groww, ET Money) |
|---|---|---|
| Withdrawal delayed, failed or stuck | **53.5%** | 6.5% |
| Calls it fraud / scam / fake | 25.6% | 3.3% |
| Support unreachable or unhelpful | 23.7% | 18.3% |
| Got back less than put in (gold spread, GST, "loss") | 16.6% | 2.1% |
| App crashes, server down, glitches | 13.1% | 9.3% |
| Money debited unexpectedly | 3.6% | 1.5% |
| Paid plans / fees for basic features | 2.7% | **21.8%** (ET Money Genius) |
| Hard to pause / skip / stop | 0.6% | 0.9% |

- **Withdrawal is the moment of truth.**
  - 25.2% of savings-app withdrawal complaints mention a timeline or a status ("4 days", "pending", "abhi tak", "shows success").
  - 27.2% also say support didn't help.
  - Several say the app showed "success" but the money wasn't in the bank. A bank reference number would settle that.
- **AI support that blocks a human is punished.** 38 reviews rated 1–2★ attack chatbot or AI support (Jar 24, Groww 7, ET Money 6, Bachatt 1), and 18 of them were written while a withdrawal was stuck. The common thread: generic replies and no way to reach a person. The count is small, so treat it as a strong signal, not a rate.
- **"Fraud" is how people say they don't trust the app,** whether or not a withdrawal is involved: 27.7% of withdrawal complaints use the word, against 23.2% of others.
- **What people praise in Bachatt:** the small daily saving habit. It appears in 19.6% of its 4–5★ reviews with text.
- **Language.** In low-rated savings-app reviews, 9.6% are in romanised Hindi and 1.2% in Devanagari. Reviews under-represent people who don't type English, so this says little about how many users speak Hindi.
- **Hypothesis this weakens:** "pause my saving in a lean week" was a headline voice action. Only 0.6% of complaints are about pausing. It can stay in the demo, but the lead scenario is now withdrawal.

## 3 · What changed in the prototype (`/host`, `lib/host/agent.ts`)
| Theme | New behaviour | Test |
|---|---|---|
| Withdrawal stuck | `withdrawal_status` answers from the host's withdrawal record: date requested, date due, status. If it's late, it apologises with the number of days and **offers a person**. If it's paid, it gives the **bank reference** to look for in the bank SMS. | `tests/host-agent-research.test.ts` |
| Support unreachable / AI-only | "इंसान से बात कराओ" means **an immediate handoff with a case summary**, so the person never has to repeat themselves. Two misses in a row offer a person, and a 👎 does the same. There is never a bot loop. | same |
| Got back less | `value_breakdown`: put in + market move − charges = value now. | same |
| Unexpected debit | `debit_check` reads the week's debits. A double debit becomes a refund request after "haan". | same |
| Fraud worry | `trust` now catches fraud, scam and fake. | same |
| Presenter | Scenario chips (on time, 3 days late, paid "not in my bank", charged twice), deep links `/host?s=late`, and a `/research` page. | Playwright run, 16 Oct |

**Found by measuring:** 4 of the demo's own suggestion chips were falling through to "help":
- "पैसे कब मिलेंगे?"
- "कोई चार्ज लगेगा?"
- "अगली बचत कब कटेगी?"
- "Make it ₹30 a day"

All are fixed. A regression test now checks every chip. The inline host prompt moved to `lib/host/prompt.ts` (`host-v2`), as the code-style rule requires.

## 4 · Cost per voice turn (computed in code)
- **Inputs:**
  - Sarvam list prices (docs.sarvam.ai, read 16 Oct 2026): STT ₹30/hour, Bulbul v3 TTS ₹30 per 10K characters.
  - Median spoken reply measured across 12 demo replies: 135 characters.
  - Assumed question length: 5 s.
- **Result: ≈ ₹0.45 per voice turn, of which 91% is text-to-speech.**
- **Claude fallback:** about $0.0026 per turn, assuming 700 input and 120 output tokens at $2/$10 per million tokens. That price comes from a third-party page; ⚠ verify it on Anthropic's pricing page.
- **Implication:** at 4 sessions × 3 turns a month, voice costs ≈ ₹5.36 per user per month. At an *illustrative* 0.25% annual trail (not a sourced rate), the break-even balance is ₹25,730.
  - Voice for a ₹50-a-day saver has to earn its keep through **retention and fewer support contacts at withdrawal and debit moments**, not through chat.
  - Keep spoken answers short. Cache the fixed parts of the TTS.
  - Both effects are unmeasured.

## 5 · The four questions, answered for this project
1. **What a top professional would do that we weren't doing.** Start from the failure moment, not the feature list. Here that is withdrawal and support. Measure the cost per turn before promising voice everywhere, and treat the AI bot itself as a risk. All three are now done at the desk-research level.
2. **The rawest material.**
   - Done: 15.5K raw reviews, AMFI's July 2026 investor-trends PDF (B30 = 19.1% of AUM; direct = 29.9% of retail assets), and Sarvam's price sheet.
   - Not yet: Bachatt's own support tickets and call recordings, and interviews with first-time savers. Those come only with access or with fieldwork.
3. **Methods and tools.**
   - Done: inductive coding plus a codebook with a precision check (pandas, regex), a unit-cost model in code, and regression tests derived from the research.
   - Next: switch interviews (10), a concierge WhatsApp voice-note test (15–20 users, 2 weeks), and funnel events with a trace store (docs/25).
4. **What would show it's right, beyond us.** The pre-set pass bar for the concierge test and pilot:
   - Withdrawal or debit questions resolved without a human on at least 60% of turns.
   - Handoff to a person in at most one step, in 100% of cases.
   - 👍 on at least 70% of answers.
   - A partner app willing to A/B the voice layer on its withdraw screen, measuring support contacts and 30-day retention.

   ⚠ The thresholds are proposals, not benchmarks.

## 6 · Limits
- Reviews show what goes wrong, not how often it happens to the average user. Angry users and English writers are over-represented.
- The sample is "newest and most relevant", not random. Bachatt's store rating is 4.6★ from 1.77L ratings.
- There was one coder. The precision check was 10 reviews per theme, and recall was not measured.
- Theme shares are for low-rated reviews only.
- Nothing here is about Bachatt's internal data. The demo host is fictional.
