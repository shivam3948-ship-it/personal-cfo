# 42 · Design principles, and the psychology behind each decision (28 Oct 2026)

**What this is:** the one place that says *why* Munim looks and behaves the way it does. Each principle names the decision it drove and where it is written down. DECISIONS.md stays the log of what was decided; this file is the reasoning across decisions. Update both together.

**Honesty rule for this file:** a principle marked *named* is called that in the source doc. One marked *our label* is a standard name we've put on a choice the docs describe in other words. None of these principles has been tested with Munim's users yet (no interviews so far, D-054); they are reasoned choices, not findings.

## 1. Design goals, in priority order (Shivam, 19 Oct; docs/38)
1. **Cognitive load:** one decision at a time.
2. **Motor load:** fewest taps, big targets, thumb-friendly.
3. **Visual load:** fewest boxes and colours on screen.

When two goals conflict, the higher one wins: e.g. a second tap is accepted (motor) to keep a screen to one decision (cognitive), which is why the money path sits one tap behind "Why this?" instead of on Today (D-037).

## 2. Product principles
| Principle | What it means in Munim | Source |
|---|---|---|
| The user stays in control; no dark patterns | Every ask has an equal "Not now"; declining costs nothing (the streak still counts); no confirmshaming, no pre-selected options, no fake urgency, no "everyone is doing it" unless measured; one autopay ask a day at most, capped after 5 declines | docs/37 §3 |
| Numbers come from code, never from the AI | The engine computes every figure; Ask's answer is checked against the tool results before it's shown or spoken | AGENTS rule 2, D-058 |
| Show the math | Every big number can be opened to see how it was computed; statements show the check they passed | docs/38, D-047 |
| Your statements stay on your phone | Read in the browser; only filtered results reach the AI; no sign-up | D-036, D-049, D-050 |
| Honest fake doors | A feature that isn't built says "Coming soon", records the intent, and says plainly what doesn't work yet ("Munim doesn't move your money yet") | docs/37, D-063 |
| Sample data is always labelled | A banner says "Sample data · a made-up family" on every screen that shows it | D-049 |
| Design for the earlier stage | One user grows from saver to investor; when needs conflict, the first-time saver wins | D-035, D-054 |
| Education, not advice, before the licence | Your own funds named as facts; never told to buy, sell, switch or stop one; new money by category; "For education only, not investment advice." | D-051, D-066 |
| Clean and familiar over stylish | WhatsApp-like plainness for tier-2/3 users; no glassmorphism | Shivam, 22 Oct |
| Hindi-first, voice-first | Every screen in Hindi; the check-in can be done by voice | D-054, docs/40 |
| Check consequences before acting | Reversible and harmless: try it; otherwise confirm first | Shivam, 22 Oct |

## 3. Psychological principles used
| Principle | In one line | Where Munim uses it | Named or our label | Source |
|---|---|---|---|---|
| Cognitive load | People can weigh only a few things at once | One check-in card at a time; the card layout never changes, only its content | Named | docs/38 |
| Von Restorff (isolation) effect | The one thing that differs is the one remembered | The Ask orb stands out by form and motion (raised, moving ring, bold label), not a new colour; proposed: the motion stops after 3 uses so it doesn't become noise | Named | docs/38 (v13), D-034, D-042 |
| Fogg Behavior Model (prompt × ability × motivation) | A behaviour happens when a prompt meets enough ability and motivation | Prompts on income days and bill dates; ability via voice, ₹10 steps, one card at a time; motivation via streak, safety-net progress, leaks in rupees | Named | docs/13 §8 |
| Habit and streaks | Repetition at a cue builds a habit; a visible streak rewards it | The streak counts check-ins, not money saved, so autopay users still open the app; a failed debit says "your streak is safe" | Named | docs/37 |
| Defaults and automation | People tend to stick with the default; automation removes the daily decision | Autopay is the main ask on the Save card, with "Save once" always beside it | Our label | docs/37 |
| Save More Tomorrow | Commit to save more at the moment income arrives, not now | Salary-day prompt to raise autopay by ₹10, once a month at most | Named | docs/37 §3 |
| Loss aversion and rupee framing | A loss in rupees moves people more than a gain or a percentage | "₹8,349 a year in fees", "your money earned less than your funds" | Named | docs/13, D-051 |
| Avoiding nagging (habituation) | A repeated ask stops being seen, then annoys | One ask a day; after 5 declines ask only on a good day (salary day, below-usual spend, a 3-day streak) | Our label | docs/37 §3 |
| Variable reward, honestly | Novelty keeps a habit alive; manufactured novelty erodes trust | Phase 2 card pool changes with real money events, never invented urgency or slot-machine tricks | Our label | docs/38 Phase 2 |
| Celebrating milestones | Marking a finished step reinforces it | Finishing a money-path step becomes a celebration card ("Card cleared! Next: …") | Our label | D-037 |
| Progressive disclosure | Show the next thing; keep the rest one tap away | Money path behind "Why this?"; "What you can change" on Spends collapsed by default, savings card always visible | Our label | D-037, docs/41 |
| Conservation of complexity (Tesler's law) | Some complexity can't be removed, only moved; move it to the system | One upload button: Munim classifies the files, not the user; each file says what happened to it | Our label (Shivam: "we are transferring the complexity from user to the system") | D-068 |
| Trust through transparency | People act on numbers they can check | "Show the math"; statements rejected unless they reconcile; SMS rows marked provisional | Our label | docs/38, D-047, D-055 |
| Commitment by stated intent | Saying "tell me" is a small commitment and a demand signal | "Reserve my autopay" and "Tell me when it's ready" on every fake door; the phone remembers so it doesn't ask twice | Our label | docs/37, D-063 |

## 4. UX frameworks and methods used
| Framework | How it was used | Source |
|---|---|---|
| Jobs to be done | The saver's job ("when money comes in, help me put a little aside first, in my language") sets the priority of every journey | docs/11 §7, docs/13 |
| Five whys / problem depth | Used to get from "people don't save" to the real problem and probability of behaviour change | docs/13 |
| Fogg Behavior Model | Designing prompts, ability and motivation for the daily check-in (above) | docs/13 §8 |
| Dark-pattern checklist | Confirmshaming, pre-selection, fake urgency, hidden alternatives: all ruled out | docs/37 §3 |
| WCAG 2.1 AA | Marigold kept off buttons (2.0:1 on white, under the 3:1 minimum for UI edges, 1.4.11); teal at 7.6:1 for every primary button. Our own rule on top: tap targets of 44px or more | docs/38 |
| Thumb zone | Primary actions low and reachable one-handed (open: test on a 6.1" phone) | docs/38 (open) |
| Fake-door testing | Unbuilt features show a door that records demand before building | docs/37, docs/39, D-063 |
| Options with a logged decision | Every non-trivial choice compares 2–4 options and records the rejected ones in DECISIONS.md | DECISIONS.md |
| Side-by-side versions | Earlier versions stay next to the new one on the design canvas for comparison | Shivam, 19 Oct |
| Evals as a gate | AI behaviour changes must pass grounding, advice and privacy gates | tech/AI_EVALS.md, D-061 |

## 5. Decisions and the principle behind each
| Decision | Date | The question | What we chose | Principle applied |
|---|---|---|---|---|
| D-033 | 19 Oct | One look or several? | Monsoon + editorial everywhere, token-based dark mode, four screen states | Visual load; consistency |
| D-034 / D-042 | 19, 22 Oct | Where does voice live? | One Ask orb in the nav, on every screen; no in-card Ask buttons | Von Restorff; cognitive load |
| D-035 | 19 Oct | Savers or investors? | One user in stages; design for the earlier stage | Jobs to be done |
| D-037 | 21 Oct | Show the money path on Today? | No: it picks the cards; "Why this?" opens it; steps get a celebration | Progressive disclosure; cognitive load; celebration |
| D-038 / D-039 | 21 Oct | What is Spends for, and how big is the chart? | "Where did my money go and what can I change"; a medium chart labelled directly, no legend | Visual load; colour never alone (accessibility) |
| D-041 | 21 Oct | Invest: next move or portfolio first? | Investing first with a CAS, next move without one | Design for the user's stage |
| D-049 | 22 Oct | Sign-up first? | No sign-up: language first, sample data labelled | Cognitive and motor load; trust |
| D-051 | 23 Oct | How far does advice go? | Categories only, the education disclaimer | Trust; regulation |
| D-052 | 23 Oct | When is a subscription "unused"? | Only when statements prove it; otherwise ask "Still using it?" | Trust through transparency |
| D-057 | 26 Oct | How do we learn if answers help? | Thumbs + a fixed-list reason; usage counts only, disclosed with a switch | User control; privacy |
| D-058 | 26 Oct | Stream voice token by token? | No: check the whole answer, then speak it sentence by sentence | Trust (no unchecked number spoken) |
| D-060 | 28 Oct | Home-screen icon? | Yes, मु on teal | Habit (a cue on the home screen); Hindi-first |
| D-062 | 28 Oct | One version or two? | AI on and AI off from one config | User and builder control |
| D-063 | 28 Oct | What happens on a coming-soon button? | A "Coming soon" sheet, "Tell me when it's ready", intent recorded | Honest fake doors; commitment |
| D-064 | 28 Oct | Should people see whether AI answered? | Always: 'AI (Claude)' or 'rules, no AI' on every answer | Trust through transparency (AI disclosure); visual load (one word on an existing line) |
| D-066 | 28 Oct | Advice for some people, not all? | A private unlock key per browser; picks from an owner-curated list; an honest not-registered disclaimer (adviser and distributor); outside it, a removed instruction is replaced by a plain no-licence line, not silence | User and builder control; trust through transparency (say what it is, and say why something was left out) |
| D-068 | 28 Oct | Should people sort their own files? | No: one 'Choose files' button; Munim works out which file is which; one result line per file | Conservation of complexity (move it from the user to the system); cognitive and motor load (one decision, one tap) |

## 6. Open design questions
- Do people miss the Ask orb because it shares the teal of the button above it? If tests say yes, go back to indigo (docs/38).
- Should Tools (Goals, FIRE, Insurance, Family) stay on Today or move behind a "More" row (visual load)?
- The streak rules and the autopay frequency caps are proposals; tune them with data (docs/37).
- Is the primary button reachable one-handed on a 6.1" phone?
- Every "our label" principle above is untested with users; the concierge test is the first evidence.


## Settings live where the app already points (D-080, 29 Oct)
The avatar's label already said "language, name and your data", so the You page sits behind it rather than adding a new control to every screen. Principle: keep a signifier's promise (Don Norman's "signifiers" from *The Design of Everyday Things*; the name is from that source). Each choice applies at once with no Save button, which keeps a reversible setting cheap to try (our label: "undo is the confirmation").


## Conversation, not commands (D-082, 30 Oct)
Voice works like a phone call, not a walkie-talkie: one tap starts it, turns hand over on silence, and the user can interrupt. Principle: turn-taking in conversation (Sacks, Schegloff and Jefferson's 1974 paper on turn-taking; the name is from that source): people expect to take the floor by speaking, not by pressing a button, and to cut in when they've heard enough. The 8-second quiet ending is our label: "the call ends when nobody talks".


## Show the shape first, then the rows (D-087, 2 Nov)
"What you own" leads with one bar of the money by type, then each fund with its share, gain and yearly return. Principle: overview first, details on demand (Shneiderman's visual information-seeking mantra, 1996; the name is from that source).


## A button for every voice action (D-090, 7 Nov)
While Munim speaks in a conversation, the text box becomes one wide "Tap to talk" button: cutting in no longer depends on the microphone noticing you. Principle: user control and freedom, the "clearly marked emergency exit" (Nielsen's 10 usability heuristics, 1994; the name is from that source). It sits where the thumb already is and is as wide as the bar, so it is quick to hit (Fitts's law, 1954; the name is from that source). Voice stays the first way to cut in; the button is the one that always works (our label: "voice first, tap always").


## One row, one sheet per card (D-092, 8 Nov)
Today keeps a single "Card bill" row (the total left to pay across cards, the earliest due date, whether the bank balance covers it); tapping it opens one block per card. Principle: progressive disclosure, the summary first and the detail on request (Nielsen Norman Group's term; the name is from that source). The minimum-only cost sits next to the minimum itself, at the moment of choosing what to pay, because a cost is weighed when it is visible at the decision point (our label: "the price beside the button"). Nothing alarming is said before it is true: no interest or late-fee warning until the due date has passed, and "not seen" instead of "missed" when Munim can't see every account.


## Credit: the total first, then what's due, then each thing (D-094, 8 Nov)
The Credit tab opens on one number, what you owe, then the next few payments by date, then each card and loan. Principle: answer the question the user came with before the detail (our label: "the total, the next step, the parts"), the same inverted pyramid used in news writing (the name is a common journalism term, not from a UX source). Due dates are chips at the start of each row because the date is what decides urgency (recognition over recall, Nielsen's heuristic; the name is from that source). The share of salary going to EMIs is shown without a verdict: no sourced threshold fits this user, so Munim states the fact and doesn't grade it.
