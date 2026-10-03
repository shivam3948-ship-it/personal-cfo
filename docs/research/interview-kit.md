# Interview Kit (T-3)

**Goal:** decide whether the problem is real for our primary and secondary segments, and whether they'd upload a statement. Pass criteria live in docs/08 §4.
**Prototype:** see [prototype-notes.md](prototype-notes.md).
**Format:** 30 min, video or in person, phone in hand. ~15 min conversation, ~10 min prototype, 5 min wrap.
**Mix (10–11 people):** 6 × time-poor engaged (Rohan), 3 × family proxies (Priya), 1–2 × DIY (control). Optional 2 × first-time savers (Ramesh) for the Phase 1.5 voice idea.

## 1. Screener (WhatsApp / Google Form, 2 min)
1. Do you hold any mutual funds? (Yes / No) → **No = stop** (unless recruiting Ramesh)
2. Roughly how many funds? (1–3 / 4–8 / 9+ / not sure)
3. Hours a month on your investments? (<1 / 1–2 / 3–5 / 5+) → **Rohan: ≤ 2 · DIY: 5+**
4. Who picked most of your funds? (Me after research / Me from tips or friends / An app's suggestion / A bank or agent)
5. Do you look after anyone else's investments (parents, spouse)? (Yes / No) → **Yes + parent holds regular plans = Priya**
6. Phone: Android or iPhone? (feeds the native-app trigger, docs/10 §5)

## 2. Recruiting message (edit freely)
> Hey [name]! Building something on the side for people who invest in mutual funds but don't really have time to keep track. Not selling anything. Could I grab 30 mins of your time this week to hear how you manage yours and show you a rough prototype? Your honest take would help a lot. Happy to buy coffee ☕

## 3. Script
Written to be said out loud, so it's loose on purpose. Don't read it; glance at it.

**Warm-up (2 min)**
- "Thanks for doing this. No right answers, and you won't hurt my feelings: the prototype's rough and I want it torn apart."
- "Mind if I take notes? Nothing gets shared with your name on it."

**Their world (8 min)**
- "Walk me through how you invest right now. Which apps, how'd you pick the funds?"
- "When did you last actually look at the whole portfolio? What made you look?"
- "Honestly, do you think it's in good shape? How would you even know?"
- "Last time you weren't sure about something, a fund or stopping a SIP, what did you do?" *(Listen for: Reddit, a friend, ChatGPT, nothing.)*
- Priya only: "How did your dad's investments get set up? What do you worry about with them?"

**Pain ranking (3 min).** Show the 6 cards (docs/08 P1–P6 in plain words); ask for the top 2:
1. "Investing feels too complicated to manage properly"
2. "I'm not sure I'm earning what my funds earn"
3. "I make decisions on tips and gut feel"
4. "I can't afford or find advice I trust"
5. "I'm paying fees I can't see"
6. "My portfolio's a messy pile of funds"
- Follow-up on #1 pick: "When did that last actually cost you money, or sleep?"

**Upload test (2 min), before showing anything**
- "Say an app asked for your mutual fund statement, the PDF from CAMS or MF Central. Would you upload it? What'd stop you?"
- Then: "What if the PDF never left your phone and only the numbers went to the server?" *(Tests the D-017 promise.)*

**Prototype (10 min).** Hand over the phone with the prototype link. Say: "Think out loud. I'll mostly shut up."
- Task 1: "You want to check your portfolio. Start here." *(Watch the 'get your statement' screen: do they understand it?)*
- Task 2: "Upload it." → "What do you expect to happen to this file?"
- Task 3: On the x-ray: "What's this telling you? Anything surprising?"
- Task 4: Open an insight → "Do you believe this number? How would you check?" *(Do they find 'Show the math'?)*
- Task 5: "Ask it anything you'd want to know." *(Note the first question; it's gold.)*
- Task 6: Advice tab: "This is a prototype on sample data. Would you act on this? What's missing before you would?"

**Wrap (5 min)**
- "If this existed tomorrow, would you use it? How often?"
- "What would you pay a month for a check-up like this? What would be too cheap to trust?"
- "Who else should I talk to?"

**Don't:** pitch, defend the design, explain screens before they try, or ask "would you use this?" without a "why".

## 4. Notes template (one per interview)
```
ID: R1 / P1 / D1      Date:        Segment (screener):       Phone: Android / iPhone
Funds held:     Hours/month:     Who picked funds:
Current behaviour (apps, last full look, what triggered it):
What they do when unsure:
Top-2 pains (card #s) + their exact words:
Would upload? (Y / N / Only if…) — reason:
After the on-device promise? (changed? Y/N):
Prototype: J2 understood? Y/N · found 'Show the math'? Y/N · first question asked:
Advice reaction (would act? what's missing):
WTP (₹/month):
Best quote:
Surprises:
```

## 5. Synthesis grid (fill after each interview)
| ID | Segment | Top pain 1 | Top pain 2 | Upload? | Upload after on-device promise? | J2 understood | Found math | Would act on advice | WTP ₹ | Phone |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | | | | | | | | | | |

**Decision rule** (docs/08 §4): among the 6 Rohans, ≥ 4 rank P1/P2/P6 in their top 2 *and* ≥ 4 would upload; among the 3 Priyas, ≥ 2 would upload a parent's statement. Otherwise revisit D-015.
