# Case study: Ditto Insurance (reference, 16 Oct 2026)

Source: case-study text shared by Shivam, checked against public pages on 16 Oct 2026. Claims are marked ✅ confirmed by a public source, ⚠ not verified.

## What Ditto does
- ✅ Advisory-first health and term insurance, started by the Finshots team; backed by Zerodha via Rainmatter. Free 30-minute call, free follow-ups, WhatsApp for urgent questions, "spam-free" promise, advisors described as "not sales agents". Shows up *inside* Zerodha (Console family view, Coin). Close to 1,00,000 customers advised in ~1.5 years at the time of Zerodha's post. ([Zerodha Z-Connect](https://zerodha.com/z-connect/featured/introducing-ditto-insurance-made-easy), [YourStory 2022](https://yourstory.com/2022/01/zerodha-backed-startup-finshots-ditto-insurance/amp))
- ⚠ No app by design; conversation over phone and WhatsApp instead.
- ⚠ Revenue from insurer commissions as a broker, with renewal commissions every year (standard for insurance distribution; Ditto's exact licence and numbers not checked).
- ⚠ Advisors on fixed pay with no sales targets (the public page only says they are not sales agents).
- ⚠ "Over 35% of new business from referrals" and "highly profitable": no public source found.

## Lessons for Munim
| Ditto lesson | What it means for us |
|---|---|
| **Frequency decides the form factor.** Insurance is bought every few years, so an app is the wrong container; a conversation is right | Rohan's money check is monthly, not daily: lead with a WhatsApp/voice check-in and a link, not an app he must open. Sunita's daily saving *is* frequent, so the host app is the right home; the voice layer rides on it (docs/23) |
| **Meet users where they already talk** (phone, WhatsApp) | Add WhatsApp voice notes and an outbound weekly call (Sarvam Samvaad) as channels for the tier-2 user (docs/24) |
| **Contextual distribution inside a bigger platform** (Ditto inside Zerodha) | Strongest support for the embedded strategy: Munim inside a host app at the moment of need (`/host` demo) beats a standalone download |
| **Owned audience = low CAC** (Finshots readers) | Build an audience before the product needs it: Hindi explainers, the "regular plan cost" calculator as a shareable hook, the build-in-public case study |
| **Trust is the product:** no spam, no targets, sometimes "don't buy" | Keep "never sells" as a hard rule: category-level guidance only, no product pushes, a visible "why we're saying this" (show the math). A "you don't need this" answer is a feature |
| **Recurring revenue without new CAC** (renewals) | Our recurring moments are premiums, SIPs, monthly CAS and card bills; each is a reason to come back and a retention lever for a host app |
| **Spend on the hard moment** (24/7 claim support) | Invest in withdrawal, missed payment, claim and market-fall moments (claim helper exists; withdrawal Q&A in `/host`) |
| **Humans for trust** | Plan a human handoff from the voice agent for high-stakes questions; AI handles volume, people handle doubt |

## Where Ditto's model does NOT transfer
- **Commission vs advice:** if Munim becomes an RIA, it generally cannot also earn distribution commission on the same client (SEBI separates advice from distribution; ⚠ confirm the current rules with counsel, L-8). A Ditto-style commission engine conflicts with the RIA route (D-OPEN-2, D-OPEN-5); a host app that is a distributor (like a savings app) may be able to, but then Munim's guidance must stay inside what a distributor may say.
- **Human advisors don't scale cheaply** to a ₹50-a-day saver; that is exactly where an AI voice agent earns its place, with humans as escalation.
