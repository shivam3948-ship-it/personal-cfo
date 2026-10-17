# 29 · Pre-mortem (17 Oct 2026)

Imagine it is six months from now and Munim failed. These are the most likely reasons, ranked by likelihood × damage, each with an early warning sign and what we do now. Part A covers today's demo; Part B covers the product.

## A · The buildathon demo failed today
| # | Why it failed | Early sign | Prevent now |
|---|---|---|---|
| A1 | The mic didn't work on stage (no permission, wrong input device, noisy hall) | The mic button stays grey; "Allow the microphone" error | Grant Chrome's mic permission beforehand; use the typing box on Talk and the tap chips on /host as backup; rehearse by tapping chips |
| A2 | Venue Wi-Fi blocked or slowed Claude and Sarvam | First answer takes more than 5 s | Phone hotspot. The rules agent answers with no network to Claude, and browser voice needs no Sarvam |
| A3 | Hindi speech recognition misheard a question live | Wrong intent on stage | Demo with chips first, then one spoken line we have rehearsed ("मेरे पैसे अभी तक नहीं आए") |
| A4 | Judges asked "why should Bachatt care?" and we answered with features | Questions about the business, not the tech | Lead with /research/bachatt: 38.2% of low ratings are about withdrawals, then the four /host scenarios |
| A5 | It looked like an impersonation of Bachatt | "Is this Bachatt's app?" | The host is the fictional "Daily Saver", labelled as such. Never use Bachatt's logo |
| A6 | Advice-boundary question ("are you giving investment advice?") | A judge asks about SEBI | "Guidance with a disclaimer; category level; no fund picks; registered advice only after an RIA licence" (D-021) |

## B · The product failed
| # | Why it failed | Likelihood | Early sign | Prevent now |
|---|---|---|---|---|
| B1 | **Savers didn't trust a bot at the moment of a stuck withdrawal.** The 38 anti-AI-support reviews were right. | High | Handoff rate above 50%, low 👍 rate | One-step handoff is built. The concierge test (docs/26) runs before any partner pilot |
| B2 | **No host app would integrate.** The value to them was unproven, and Munim looked like support cost, not revenue. | High | Partner calls end at "send a deck" | Lead with support deflection and saving retention (docs/34). Offer an 8-week free pilot with a measured A/B |
| B3 | **Voice cost more than a small saver is worth.** | Medium | Cost per user above ₹5/month at 4 sessions a month | Voice only at high-stakes moments, short answers, rules first, cached TTS (docs/26 §4) |
| B4 | **Regulatory line crossed:** guidance read as advice, or distributor commission conflicted with advice. | Medium | A partner's compliance team pushes back | Advice-mode gating and disclaimer (D-021). Counsel review of the advice boundary (L-8) before any partner launch |
| B5 | **Data breach or a leak to the LLM.** | Low–Medium | A PII pattern in logs or prompts | Redaction, row-level security, delete-all. Fix S7–S9 from docs/28 before public beta |
| B6 | **Answers built on the host's state were wrong because the host's data was wrong or late.** | Medium | "Munim said ₹X, the app shows ₹Y" | Munim only reads the host's own record. Show "as of" times, and hand over on any mismatch |
| B7 | **We built for Rohan and Sunita at the same time and won neither.** | Medium | Roadmap split across the x-ray and the host voice layer | Pick the beachhead after the concierge test: host voice layer first (D-029) |
| B8 | **Hindi only reached half of India's first-time savers.** | Medium | Requests for Bengali, Marathi or Tamil (seen in the reviews) | The Sarvam voice stack covers more Indian languages; add the next language by partner demand |
| B9 | **Nobody discovered the voice option.** | Medium | Hint views high, voice starts low | In-task hints and a proactive offer are built; A/B test them (docs/23) |

## Decisions from this pre-mortem
1. Run the concierge test (B1) before writing more code for partners.
2. Close S7–S9 before any real user's data (B5).
3. Get the counsel read on the advice boundary before a partner pilot (B4).
