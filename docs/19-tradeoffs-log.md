# 19 · Trade-offs log

**What this is:** for every decision, what we **gave up** to get what we wanted, why that's acceptable, and what limits the damage. DECISIONS.md says *what* we decided and *when to revisit*; this file says *what it cost*. Append new rows; never delete (supersede instead).
**Last updated:** 2026-10-15

## A. Product and strategy
| Ref | We chose | We gave up | Why that's acceptable | Mitigation |
|---|---|---|---|---|
| D-001 | Module by module: portfolio → savings → goals → tax | A complete "money super app" on day one | Each module reuses the data and trust of the previous one; a solo builder can't do four at once | Net worth (Phase 2) ties the modules into one home screen |
| D-002 | Portfolio piece first, business second | Speed to revenue; picking a monetisable segment first | The proof needed now is an AI PM portfolio; a business can follow the signal | D-OPEN-5 stays open; usage metrics are tracked from the pilot |
| D-004 | Wedge = AI explanations + portfolio x-ray | Novelty: x-rays are commoditised | The explanation layer, grounded in computed numbers and evaluated, is the differentiator and the AI PM showcase | Evals measure whether explanations beat charts; revisit if not |
| D-015 | Primary = time-poor engaged investor; secondary via a family proxy; first-time savers parked | The biggest market (first-time savers, Bachatt's users) and the DIY enthusiasts who adopt fastest | Phase 1 needs an existing portfolio; this segment has the clearest job and the path to paid advice | Munim (voice, Hindi) prototypes the parked segment's interface early (D-020) |
| D-018 | Build the MVP first, interview after | Early evidence that *our* user feels the pain; risk of building the wrong thing | Building is cheap; interviews on a working product give richer signal than on a prototype | Kill criteria (docs/05); interview kit ready; validation so far is market research + personal experience with friends and relatives (docs/08) |
| D-020 | One engine covering five buildathon tracks, led by the Sunday Money Call | Depth in a single track; a narrower, more polished demo | Breadth shows product thinking; all tracks share the same engine, so depth isn't really sacrificed | Demo script leads with the three strongest stories in *their* data |
| D-022 | Adopt the foundation-first order (debt → buffer → protection → invest) | A purer "investing" product identity | It's the most useful single message for our users and is fully data-driven | Investing insights still lead Phase 1; the foundation verdict is a Phase 2 headline |

## B. Regulatory and trust
| Ref | We chose | We gave up | Why that's acceptable | Mitigation |
|---|---|---|---|---|
| D-006 → D-016 → D-021 | Pre-licence: guidance with a disclaimer, invite-only and free; **no GTM until the RIA licence** | Public launch, growth and revenue before the licence; product-level picks (named funds, policies) | A disclaimer alone doesn't make advice legal; no fee, no public offer and no holding out do. Waiting on GTM keeps us on the right side of the SEBI test | L-8 counsel check before inviting non-family; category-level only; "Guidance · not registered advice" badge; no "adviser" wording anywhere public |
| D-007 | No distribution commissions if we advise | The easiest Indian fintech revenue (commissions), and the first-time-investor economics (docs/13 §7) | "Unbiased by design" is the trust story; SEBI segregates advice and distribution anyway | Revenue model left open (D-OPEN-5): subscription, RIA fee or B2B |
| D-009 | The LLM never computes numbers or sees PII | Flexibility: free-form "what if" maths in chat, simpler pipelines | Wrong numbers end a money product; PII in a third-party model is a DPDP risk | A tool for each computation; the number guard checks every spoken figure; "Show the math" on every answer |
| D-017 | Parse the CAS on the device, compute in the cloud | Simplicity of server parsing; easy debugging on real files | "Your statement never leaves your phone" removes the biggest trust barrier | Opt-in debug upload; golden-set tests on parsers |
| D-020 | Munim parses uploads, PDFs included, on the server | Consistency with D-017 (AGENTS.md rule 5) | Mock data only, by event rule; it's a reference build, not the product | Recorded as an explicit exception; must never take real statements |
| L-9 | Insurance: category-level guidance only ("consider a super top-up", "get the surrender value first") | Product-level insurance advice, the clearest money-saving moment (mis-sold endowments) | Insurance recommendations need IRDAI registration, which a SEBI RIA licence doesn't cover | Return computed from the insurer's own illustration; user decides with the numbers |

## C. Data and platform
| Ref | We chose | We gave up | Why that's acceptable | Mitigation |
|---|---|---|---|---|
| D-005, D-018 | CAS / statement upload now; Account Aggregator later via an RIA | Automatic, always-fresh data; a lower upload drop-off | AA needs a regulated entity; AMFI stopped MF Central sharing with fintechs | Disabled "Connect automatically · coming soon" CTA measures demand; source-agnostic ingestion layer |
| D-013 | Monthly depository CAS for refresh; detailed CAS for history; no demat equity in Phase 1 | Stock-level analysis; one-file simplicity | MF is where the target users' money is; the monthly CAS makes refresh effortless | Equity analysis parked, not dropped |
| D-010, D-014 | Mobile-first PWA, not native | Push notifications, store distribution, device integrations | Low-frequency use, recruiter demo needs a link, fastest iteration | Pre-committed native triggers (docs/10 §5); Expo roadmap ready (docs/18) |
| D-011 | Structured facts; rejected semantic cache, rerankers, agentic self-correction loops, web search | Generality and "RAG-template" checkbox features | Our data is structured; reproducibility beats flexibility in money | Re-add a component only if a named eval fails without it |

## D. Munim (buildathon app) engineering
| Ref | We chose | We gave up | Why that's acceptable | Mitigation |
|---|---|---|---|---|
| D-019 | Cascade (STT → Claude + tools → TTS) | Sub-second speech-to-speech turn-taking; about 3–6 s per turn (estimate, not yet measured) | Text in the middle makes every number checkable and the trace showable; each hop swappable | ≤ 70-word answers; "thinking" state; streaming TTS later; `npm run smoke` measures latency |
| D-019 | Sarvam for speech | Possibly better English voices elsewhere; one more vendor | Best Indian Hindi/Hinglish options of those compared; listed prices are low | Browser speech fallback; ElevenLabs as the backup |
| E-1 | Rules-first parsing, Claude extraction only as a fallback | Coverage of unseen formats on the first try | Rules are exact and free; the extractor's output must pass the same reconciliation checks | Red rows in the Data card show exactly which file needs an adapter |
| E-2 | Numbers rounded to the rupee when spoken | Paise precision in speech | Nobody speaks paise; the engine stays exact in paise | Guard tolerates ≤ 0.5%; "Show the math" keeps exact values |
| E-3 | Number guard checks figures, not claims; one repair round, then a flag | Full fact-checking of prose (merchant names, dates) | Numbers are where trust breaks; claim-checking is costly and slow for voice | Tools return named facts; claim checks are a candidate for live evals |
| E-4 | Offline rule-based agent as a fallback | A second code path to maintain; template answers sound stiffer | The demo can't die on venue wifi or an API outage | Same tools and guard as Claude; golden-set tests cover both |
| E-5 | Single process, in-memory sessions, `x-sid` header, no auth | Multi-user safety, persistence across restarts | Prototype on mock data; one demo laptop | Authz rule (AGENTS.md §3) applies before any real users; docs/18 N0 adds auth |
| E-6 | Actions are drafts, reminders and plans; nothing is sent automatically | "Fully autonomous" wow factor (auto-sent emails, real payments) | Safety and consent: the user reviews before anything leaves; the brief accepts "meaningfully initiate" | One-tap "Open in mail" and "Add to calendar"; idempotent actions |
| E-7 | Content-keyed idempotency for actions | Two genuinely different actions with identical content collapse into one | Retries and double "haan" are far more common than true duplicates | Titles differ when intent differs; HTTP idempotency keys later |
| E-8 | Advice rules of thumb (6-month buffer, 10× income term cover, 12% "high-interest" threshold) | Personalised targets (dependants, job stability, city) | Disclosed, consistent, and better than silence for a first-time saver | Shown as rules in every step's `basis`; Phase 3 replaces them with goal-based needs |
| E-9 | Synthetic data with an independent generator and ground truth | Realism of messy real files | Lets tests compare the engine against independently computed numbers | PDF route tested; Saturday adapts to the organisers' real mock files |
| E-10 | Rebuild from a runbook on the day (or fork if allowed) | Time on Saturday that forking would save | Reps: a predictable, practised rebuild; complies if pre-written code is disallowed | Ask the organisers at check-in; cut list in docs/17 §2 |
