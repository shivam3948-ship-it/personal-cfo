# 34 · Pricing (17 Oct 2026)

**Recommendation:** B2B. Charge host apps **per resolved conversation**, with a monthly minimum and an 8-week free pilot whose A/B decides whether there is a contract.

We have **no willingness-to-pay data**. Every price below is a floor worked out from cost, not a market price.

**Why not consumers first:** a ₹50-a-day saver is worth little to us directly. Advice fees need an RIA licence, and distribution commission sits with the host. The host saves support cost and keeps savers, so the host pays.

## Our cost per conversation (computed in code, 16–17 Oct)
**Inputs:**
- Speech: ₹0.45 per voice turn. This uses Sarvam list prices and the median spoken reply of 135 characters, measured across 12 demo replies (docs/26 §4).
- Claude fallback: $0.0026 per turn (assumed 700 input and 120 output tokens at $2/$10 per million; the price is from a third-party page, verify).
- **Assumptions:**
  - 3 turns per conversation;
  - Claude on 30% of turns;
  - ₹88 per US dollar (verify);
  - ₹0.10 of hosting and logging per conversation.

**Result: about ₹1.65 per conversation.**

## Price floor per *resolved* conversation (we absorb the cost of unresolved ones)
| Resolution rate | 60% gross margin | 70% gross margin |
|---|---|---|
| 50% | ₹8.23 | ₹10.97 |
| 60% | ₹6.86 | ₹9.14 |
| 80% | ₹5.14 | ₹6.86 |

**Worked example** (illustrative):
- A host with 10 lakh monthly active users, 5% of whom use voice, 2 conversations each, 60% resolved.
- That is 60,000 billable conversations a month.
- At ₹5 each: revenue ₹3,00,000 against cost ₹1,64,602, a **45% margin**.

So ₹5 is too low unless the resolution rate is high. **Start at about ₹9 per resolved conversation** and lower it as resolution improves.

## Why the host would pay
The host saves its cost per human support contact, minus our price, on every resolved conversation.

We don't know any host's cost per contact. Illustratively:

| Host's cost per contact | Our price | Host saves per resolved conversation |
|---|---|---|
| ₹20 | ₹5 | ₹15 |
| ₹40 | ₹5 | ₹35 |
| ₹80 | ₹5 | ₹75 |

**Ask the partner for their number in the first meeting.**

## Pricing tests to run
1. **Partner interview.** Their cost per support contact and the share of tickets about withdrawals and debits. This sets the value ceiling.
2. **Pilot contract.** 8 weeks free. After that, per resolved conversation with a monthly minimum (⚠ amount set from pilot volume).
3. **Consumer premium tier, later, after the RIA licence.** A Van Westendorp survey in Hindi with 4 questions: at what monthly price would it be too cheap to trust, a bargain, getting expensive, too expensive.
   - Benchmark to check, not use: ET Money Genius ₹249/month as noted on 16 Oct (⚠ verify the current price).

## Open
- D-OPEN-5 (revenue model) moves to **"B2B per resolved conversation for the host-app track"**, to be confirmed after the first partner conversations.
