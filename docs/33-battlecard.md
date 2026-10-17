# 33 · Battlecard: Munim (voice layer for savings apps), 17 Oct 2026

**Who we sell to:** a savings or investing app's product lead and support head, not the end saver.

**Our one-liner:** "Voice that helps a first-time saver finish what they came to do, and reaches a person in one step when money is stuck."

## Alternatives the buyer has
| | **Munim (embedded)** | **Build in-house** | **Generic chatbot / WhatsApp bot support** | **Groww GR-1 (reference, not for sale)** |
|---|---|---|---|---|
| What it is | Voice and text layer inside the host app that answers from the host's own records and proposes actions | Own team builds an assistant | FAQ/LLM bot in chat or WhatsApp | Groww's in-app investing assistant, launched 24 Aug 2026 ([Groww](https://groww.in/updates/gr-1-ai-investing-assistant-groww)) |
| Answers from the user's account | Yes: withdrawals, debits, value, from host state | Yes, after months of work | Usually generic | Yes: holdings, watchlists, live prices |
| Hindi / Hinglish voice | Yes (Sarvam), browser-voice fallback | Depends | Rarely voice | Not mentioned on the launch page |
| Acts on the account | Proposes; host executes after "haan" | Depends | No | Alerts, watchlists, order review cards; never executes orders automatically |
| Human handoff | One step, with a written case | Depends | The top complaint: "only AI response" (38 reviews) | Not stated |
| Numbers checked | Every figure traced to data (number guard) | Depends | No | Not stated |
| Time to pilot | Weeks: host sends state, receives proposals | Months | Days | n/a |

## When we win
- The buyer's reviews or tickets are dominated by withdrawal and debit doubts. For savings apps in our sample this is 53.5% of low ratings; for Bachatt, 38.2%.
- The buyer has a bot today and its users complain they can't reach a person.
- The buyer's users are first-time savers more comfortable speaking than typing.

## When we lose
- The buyer wants trading or market insights (Groww's GR-1 territory).
- The real problem is payout speed. Munim explains delays; it doesn't fix them (non-goal, docs/30).
- Compliance won't allow any AI-generated text in the money flow. Answer: rules first, Claude only for open questions, and every figure checked.

## Objections and answers
- **"We already have Saathi or another assistant."** Bachatt's listing describes Saathi as presenting savings instruments. Munim is for the money-back moment: status, debits, charges, handoff. It can sit behind an existing assistant as its answers-from-records layer. ⚠ How Saathi actually works in the app is not verified.
- **"Bots annoy our users."** Exactly why handoff is one step and two misses hand over. We measure repeat contacts, not deflection alone.
- **"What does it cost?"** About ₹1.65 per conversation all-in (estimate). Pricing is per resolved conversation (docs/34).
- **"Is this investment advice?"** No. It answers from the account and the host's rules; no fund, stock or policy picks.

## Proof we can show today
- `/research` and `/research/bachatt`: review evidence.
- The opportunity tree.
- The `/host` scenarios: late withdrawal, paid but "not in my bank", charged twice, the instant split.
