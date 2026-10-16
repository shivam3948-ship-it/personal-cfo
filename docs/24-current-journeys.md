# 24 · How people solve this today (current-state journeys)

**Status:** hypothesis v0.1, 16 Oct 2026. Built from secondary research (docs/08), founder experience and conversations with friends and relatives, **not interviews**. Every row is something to confirm or kill in Stage 4 (docs/22).
**The problem being solved:** "Is my money okay, where should it go, and what should I do next?" (docs/11, 23).

## Persona A · Digitally native: Rohan, 31, Bangalore
Salaried engineer. Uses 10+ finance apps. Comfortable reading English, filling forms, sharing OTPs. Short of time, not of tools.

| # | Step | What he does | Who's involved | How he feels | Pain | Where Munim fits |
|---|---|---|---|---|---|---|
| 1 | Trigger | Bonus, appraisal, tax-proof email, market fall, colleague talks about returns | Colleagues, HR (tax proofs) | Restless, slightly behind ("everyone else seems sorted") | No regular moment to check; only reacts to events | Weekly money call creates the moment |
| 2 | Research | Reddit threads, YouTube finfluencers, ChatGPT screenshot of his portfolio, friend's tip | Finfluencers, friends, ChatGPT | Curious, then overwhelmed by contradicting advice | Generic advice; can't tell who's selling | Answers from *his* numbers, with the math |
| 3 | Decide and buy | Picks funds by 3-year returns in Groww/Zerodha/Kuvera; starts an SIP | Investment app; sometimes spouse | Relief ("done for now"), quiet doubt | Ends up with overlapping funds and NFOs | Portfolio x-ray: mix, overlap (later), real return |
| 4 | Track | Opens 4–6 apps (broker, bank, card, CRED, insurer), maybe a spreadsheet he stops updating | Apps | Fragmented; mild guilt about not checking | No single view; app shows fund return, not his | One net-worth view; his own XIRR |
| 5 | Protect | Buys insurance from the bank RM or a colleague's agent; employer health cover | Bank RM, insurance agent, HR | Pressured, unsure if he was sold | Endowment policies sold as investments | Insurance reality check from the policy's own illustration |
| 6 | Tax season | Jan–Mar scramble: ELSS, insurance, 80C proofs; hands to a CA | CA, HR | Stressed, deadline-driven | Buys tax products in a hurry | Earlier reminders; gains report (P4) |
| 7 | Doubt moment | Market falls or a big expense; thinks of stopping SIP; asks a friend | Friends, spouse | Anxious | No one to ask who knows his numbers | "What happens if I pause" from his data |
| 8 | Drift | Ignores it for months; subscriptions and card fees pile up | — | Avoidant | Small leaks add up | Leak hunter, nudges before deadlines |

**Overall:** competent but alone. Trusts numbers he can check; distrusts anyone selling. Wants a verdict in minutes, not another dashboard.

## Persona B · Tier-2 digital beginner: Sunita, 36, Indore
Runs a small tailoring shop with her husband. Smartphone (Android, shared at times), UPI and WhatsApp daily, YouTube in Hindi. Reads Hindi comfortably, English a little. Irregular daily income. No mutual funds yet; maybe an LIC policy and a bank account.

| # | Step | What she does | Who's involved | How she feels | Pain | Where a voice agent fits |
|---|---|---|---|---|---|---|
| 1 | Trigger | Child's school fees, a festival, a health scare, a neighbour's gold purchase | Family, neighbours | Worried about the future, wants "something for the children" | Saving is reactive and lumpy | Daily small saving, spoken reminders |
| 2 | Ask around | Asks husband, elder brother-in-law, a neighbour; watches a Hindi YouTube video | Family elders, neighbours, YouTubers | Hopeful but unsure whom to believe | Advice is mixed; fear of being cheated | Answers in Hindi, by voice, with no jargon |
| 3 | Choose | Picks what people around her use: chit fund/committee, post office RD, gold, LIC through a known agent, bank FD | LIC agent, chit organiser, post office or bank staff | Safer because "someone we know" | Low returns, illiquid, chit fund risk | Explain options simply; show what each earns |
| 4 | Sign up | Branch visit or agent at home; forms, photos, KYC; or a relative installs an app for her | Agent, bank clerk, a relative or the phone-shop person who installs apps | Dependent, a little embarrassed to ask again | English forms, OTP fear, long queues | Voice-guided sign-up help inside the app |
| 5 | Pay regularly | Cash to the agent or committee, UPI to RD, or forgets in a slow month | Agent, committee members | Proud when she pays, anxious in lean months | Missed payments → penalties or lapses | "Pause this week" instead of quitting; reminders |
| 6 | Track | Passbook, agent's word, SMS she can't fully read; asks a family member | Agent, family | Blind ("I hope it's growing") | Can't see value or returns | "कितना बचा?" answered aloud |
| 7 | Need money | Breaks the FD, pledges gold, borrows from family or a moneylender | Bank, gold-loan shop, relatives, moneylender | Stressed, ashamed | Expensive borrowing; surrender losses | "When will I get my money, any charge?" before she breaks anything |
| 8 | Trust event | A friend loses money in a chit or app fraud; she stops | Neighbours, news | Scared, withdraws | One bad story ends the habit | Transparent answers on where the money goes |

**Overall:** wants safety and a person to ask; relies on trusted people more than on products. Text-heavy apps exclude her; a phone call or a voice note feels natural.

## Side by side
| | Rohan (digital native) | Sunita (tier-2 beginner) |
|---|---|---|
| Main question | "Am I doing okay?" | "Is my money safe, and how much do I have?" |
| Trusted sources | Data he can check; peers | People she knows (family, agent) |
| Channel he/she prefers | App, 3 minutes, English | Voice/WhatsApp, Hindi, someone to ask |
| Biggest fear | Wasting money unknowingly | Losing money to fraud |
| Moment to reach them | Market fall, bonus, tax season | Lean week, school fees, a scare |
| Why voice | Speed (no time) | Access (reading/typing is hard) and trust (feels like a person) |

## What this means for the product
1. **Same engine, two front doors:** x-ray and verdict for Rohan; voice-first savings helper inside a host app for Sunita (docs/23).
2. **Trust beats features for Sunita:** every answer must say where the money is and what happens if she withdraws or pauses.
3. **Put voice at the doubt moments:** withdraw, pause, a missed payment, a market fall. Those are the steps where both personas currently turn to a person.
4. **Replace the "trusted person", don't fight them:** Priya-style proxies (docs/11) and family members are a channel; a shareable spoken summary may spread better than an ad.

## To validate in interviews (Stage 4)
- Do tier-2 beginners already use any savings app, or is a relative always involved at sign-up? (⚠ assumption)
- Which step causes most drop-off: sign-up, the first payment, or the first lean month?
- Would they trust a voice in an app more or less than a call from a person?
- For Rohan: is "verdict in 3 minutes" valued enough to upload a CAS?
