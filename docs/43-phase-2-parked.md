# 43 · Phase 2: parked features

Phase 1 is frozen (D-074, 29 Oct 2026): no new features until Munim has been shared with Bachatt's CPO and real users have used it. This file is the only place a new idea goes. Nothing moves from here into a sprint until it passes the gate below.

## The gate (every item, every time)
An item comes back only when all four are true, written down in its row:
1. **A named user and problem.** Which user (D-054: the tier-2/3 first-time saver, unless stated), in what moment, failing at what.
2. **Evidence the problem is real**, strongest first:
   - an interview or concierge-test observation;
   - usage data from the event store (D-057) or 👎 feedback;
   - an eval failure;
   - the owner's own use.
   A plausible idea on its own is not evidence.
3. **Why now beats the next item** on this list.
4. **The cost, and what it costs the promise.** Days, money, and any change to "your statements stay on your phone" (D-036) or to the advice boundary (D-051, D-066).

Evidence column key:
- **None yet:** an idea, no observation behind it.
- **Indirect:** a market signal, a competitor, or reviews.
- **Direct:** a user, the data, or an eval.

## Data in
| Item | User need it serves | Evidence | Why parked | Comes back when |
|---|---|---|---|---|
| PhonePe and Google Pay statement PDFs | UPI is where a tier-2/3 saver's money moves; without it, Spends misses most of their life | Indirect (UPI share of payments; Play Store reviews, 16 Oct) | No reader exists; about a day per app; needs a real statement of each | Interviews show savers can and will export these statements (many may not know how) |
| Loan and insurance documents on the phone | "Am I covered / what does my loan cost" from the user's own papers | None yet from users. The sample family uses them | Readers exist in the engine; about half a day to wire. The primary user is a first-time saver who usually holds neither | A test user uploads one and gets "can't read this one yet", or interviews show loans and EMIs drive the saving problem |
| More file formats on the phone: bank CSV, statement text, JSON, bank emails, credit reports (loan and insurance papers are the row above) | Users whose bank gives a CSV or email, not a PDF in our five formats, can still add their data | Indirect (owner, 29 Oct: "allow CSVs and other formats if feasible") | The readers exist in the engine but run only on the server for the sample family; the phone path was wired for the CAS and five PDF formats only (D-036/D-046/D-047). Not flagged when it narrowed (owner's catch) | Each format, on the phone: (1) passes the same checks as PDFs (totals or balance walk reconcile, or it is shown and not saved); (2) no slower: reading a typical month stays under about 2 s on a mid-range Android phone (a bar to confirm when measured); (3) no AI fallback for unknown formats on the phone path: that would send document text to a server. Excel (.xls/.xlsx), which some banks export, has no reader yet |
| Automatic SMS reading (Android app, Expo, docs/18) | No manual paste: transactions arrive by themselves | Indirect (Jar, Bachatt and others read SMS) | A web app can't read SMS. Needs a native app, Play Store SMS-permission review and a privacy review | The habit loop needs daily data and a native app is planned (pasting SMS was removed, D-079) |
| Account Aggregator | One consented link instead of uploads | Indirect (the "coming soon" CTA records intent, D-005) | Needs an AA partner (FIU onboarding) and puts data on a server | Intent counts from the event store justify a partner conversation |
| More bank and card formats (ICICI and others) | Users of other banks can upload | Direct (a user hits "can't read this one yet", once data flows) | Each format is about half a day; we read five today | The event store shows which unsupported banks people actually try |

## Sorting spending (D-078 follow-ups)
| Item | User need it serves | Evidence | Why parked | Comes back when |
|---|---|---|---|---|
| One "who is this?" card for the biggest unknown payee | Turns "Paid to people" into rent, maid, a friend, family, in one optional tap that sorts every past and future payment to them | Direct: owner's SBI statements, 29 Oct (Paid to people is 62% of August's money out after D-078) | Needs saved user fixes that the engine applies (today a fix in All transactions lives only on that screen) | Usage shows people open Spends; or the next build after the Bachatt share |
| Make the category fix in All transactions real | A correction should stick, change every total and make a rule | Direct: it resets on reload and changes no total (found 29 Oct) | Same piece of work as the card above | With the card above |
| Shared directory of shop UPI handles | A shop one user sorted is sorted for everyone | None yet | Needs a server and consent; handles of small shops can be personal numbers | The server database starts (Platform below) |
| Account-holder name match for self transfers | Money to your own other account isn't spending | Indirect (owner's statement: the name sits elsewhere in the PDF header) | The SBI header layout differs between statements; needs a careful reader | Next statement-reader change |

## Portfolio X-ray (owner, 2 Nov: "it should tell about fund overlap and any other analysis available from such reports")
| Item | User need it serves | Evidence | Why parked | Comes back when |
|---|---|---|---|---|
| Real fund overlap (shared stocks between your funds) | "Am I paying two fees for the same stocks?" | Direct: owner's own CAS shows no overlap card, because a CAS lists what you hold, not what each fund holds | Needs each scheme's monthly portfolio from every AMC (no central source; SEBI makes each AMC publish its own), a monthly refresh job and a holdings table sent to the phone: about 2–3 days. The X-ray's overlap card works today only on the sample family's made-up holdings. The primary user (D-054) holds no funds yet | After the Bachatt share, if investors (the later stage, D-035) are the next segment |
| Same-category duplication (a CAS-only stand-in for overlap) | "You hold 3 flexi-cap funds": the likely overlap, without stock data | Owner's ask | About 1–2 h; a weaker signal than real overlap | With the item above, or alone if real overlap stays too costly |
| Nominee missing, one scheme spread over several folios, small dormant holdings | Paperwork that bites later (claims, consolidation) | Owner's ask; the CAS prints these | About 1–2 h each | Next X-ray change |

## Channels
| Item | User need it serves | Evidence | Why parked | Comes back when |
|---|---|---|---|---|
| Phone calls and WhatsApp on the same agent | Reach users who prefer calls or chat to an app | Indirect (Saathi runs outbound call campaigns) | Answering on a server breaks D-036. WhatsApp's business terms (from Jan 2026, per earlier research; verify) restrict AI-first bots. Telephony cost | Server-side data with consent exists (below) and a partner wants the channel |

## Platform
| Item | User need it serves | Evidence | Why parked | Comes back when |
|---|---|---|---|---|
| Sign-in, server database, family accounts | Data survives a phone change; a parent's portfolio managed by a child | Indirect (family proxy segment, docs/13) | The owner's call: Phase 2, start only when he says (28 Oct). D-OPEN-6 is undecided | The owner starts Phase 2 |
| Supabase ↔ GitHub schema deploys | Schema changes apply themselves | None yet (one migration so far) | One table set; the migration filename doesn't fit the auto-deploy naming | The server database above starts changing often |

## Voice speed (latency sprint, D-073)
Measured 29 Oct: Munim takes 12.6–15.3 s from end of speech to first sound; Saathi takes 7.0–7.6 s.

| Item | User need it serves | Evidence | Why parked | Comes back when |
|---|---|---|---|---|
| Prompt caching (branch `perf/voice-latency`, built) | Faster, cheaper answers | Direct: answers about 0.6 s faster (within noise); cached tokens bill at a fraction of the normal price | Small gain; freeze | Merge with the next eval run (it changes no answer) |
| One-call answers (fact snapshot up front) | Cut 1.5–3 s per answer | Direct: model time is about 100% of answer time; 2–3 calls per answer | Risky (number check, evals) | Voice users in tests drop off on waits; check with `npm run voice:latency` |
| Faster model for voice turns | Cut 1–3 s | None yet (not measured) | Quality risk; needs the full live eval | After one-call answers, if still over 8 s |
| Streaming speech-to-text and text-to-speech (hands-free conversation and talk-over are built without it, D-082) | Cut 3–4 s off each turn | Direct: the Saathi teardown, 29 Oct | Needs a small server outside Vercel to hold the connections | Voice becomes the main way users ask (event store: voice vs typed share) |
| Shorter spoken answers (disclaimer on screen only) | Less to listen to | Direct: the Saathi comparison (tone) | Compliance review needed | With the latency work above |

## Answer quality and safety follow-ups
| Item | User need it serves | Evidence | Why parked | Comes back when |
|---|---|---|---|---|
| Weekly test-set refresh from real 👎 answers | Evals that track what real users hit | Waits on data (the event store went live 29 Oct) | No real users yet | 20+ real answers with feedback |
| AI check: "top up a held fund" recall | Catch "put the bonus into your ELSS" phrasings | Direct: missed 3/3 held-out cases (29 Oct) | Passes its gates; the word patterns and Claude's own rules also apply | Next prompt change to the AI check |
| Unknown insurer's plan with no cover words | Catch a product pick from memory | Direct (reviewer finding) | The AI check, live in production, is the layer for it | An eval or live answer shows one getting through |
| Grow the held-out guard sets to about 60 sentences | Gates that aren't same-author and small | Direct (reviewer caveat) | Freeze | Before the next AI check change |

## Product features already marked phase 2
| Item | User need it serves | Evidence | Why parked | Comes back when |
|---|---|---|---|---|
| Heads-up spending alerts (D-039) | Warn before overspending | None yet | Replaced by "save what you skip" | Usage shows Spends is opened weekly |
| Goals, FIRE calculator, family (coming-soon buttons, D-063) | Plan beyond the next step | Intent taps recorded | Coming soon by design | Intent counts justify one of them |
| Variable check-in card pool; streak rules | Keep the daily check-in fresh | None yet | Deferred 19 Oct | Retention data from the habit loop |
| Real autopay rail (docs/37) | Daily saving actually happens | Indirect | Needs a partner, an RBI e-mandate and a destination product | A partner (Bachatt-like) exists |
