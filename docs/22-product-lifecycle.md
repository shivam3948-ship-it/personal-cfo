# 22 · Product lifecycle (revised 16 Oct 2026)

**Where we are:** end of **Stage 3 (Build MVP)**, entering **Stage 4 (Validate)**. We have more product than evidence: a working 12-screen app and a voice prototype, but no structured user interviews and no users yet.
Supersedes the phase order in [07](07-roadmap.md) where they differ; phases (P1–P4) still describe *what* we build, this file describes *when we know enough to move on*.

## Stages and gates
| # | Stage | Goal | Status | Exit gate (all must hold) |
|---|---|---|---|---|
| 0 | Discover | Is the problem real? | ✅ done, **weakly** | Secondary research + personal experience with friends and relatives (docs/08). ⚠ No primary interviews yet (D-018 moved them after the MVP) |
| 1 | Define | Who, what wedge, what we won't do | ✅ done | Segments (docs/11), wedge, regulatory boundary (docs/03, D-021), decision log |
| 2 | Design | Journeys and screens | ✅ done | Journeys (docs/09, 21 §2), 12 mock screens (Design canvas), PRDs P1/P2 |
| 3 | **Build MVP** | A product people can use with their own data | 🟡 **finishing** | ☐ Supabase sign-in live · ☐ deployed on Vercel · ☐ real CAS parsed correctly on the founder's machine · ☑ engine, 12 screens, voice, tests, CI |
| 4 | **Validate** (problem–solution fit) | Do target users get value from *this* product? | ⏭ next | 10 interviews on the working app (kit: docs/research) **and** a closed alpha of 10–20 invited users. Proposed pass bar (⚠ set before starting): ≥ 6/10 upload a real CAS within 24 h; first insight in < 3 min; ≥ 5 users take one verified action; no number reported wrong |
| 5 | Closed beta (PMF signal) | Will they keep coming back? | later | 100–300 invite-only, free, `guided` mode. Weekly return (D7/D28), verified actions per user (NSM, docs/05), "very disappointed if it disappeared" ≥ 40% (Sean Ellis survey, a common benchmark, not a law) |
| 6 | License + launch | Become allowed to advise and market | later | RIA route live (D-OPEN-2, L-5); counsel sign-off (L-8); DPDP notice, retention and processor contracts. **No GTM before this** (D-021) |
| 7 | Grow | Revenue and reach | later | Revenue model chosen (D-OPEN-5); Account Aggregator via partner; Expo apps (docs/18); P3 goals, P4 tax |
| 8 | Scale | Efficient growth, B2B | later | Unit economics positive; white-label for RIAs |

## What changed vs the original plan
- **Breadth arrived before depth.** The buildathon pulled Phase 1.5 (voice) and Phase 2 (money picture, loans, insurance, credit) forward. Useful as a demo; it also means three surfaces are unvalidated instead of one.
- **Interviews moved after the MVP (D-018).** Stage 4 is now the riskiest step: it is where we learn whether the CAS-first wedge holds.
- **Advice:** guidance with a disclaimer to invite-only, non-paying users (D-021) is allowed in Stages 4–5; public launch waits for Stage 6.

## Rules for moving between stages
1. Write the pass bar before the stage starts; don't move it after seeing results.
2. One stage at a time for the product; the career track (buildathon, Bachatt case study) runs in parallel and does not count as validation.
3. If a Stage 4 kill signal appears (users won't fetch a CAS, or don't trust the numbers), revisit the wedge (D-OPEN-1 options) before building more screens.

## Next 2 weeks (Stage 3 → 4)
1. Finish Stage 3: Supabase + Vercel live; run your own and a family member's CAS (with permission) through the parser on your machine.
2. Buildathon (17 Oct): fork and adapt; collect judge and attendee reactions as qualitative input, not validation.
3. Recruit 10 interviewees from the primary persona (docs/11); run the kit on the live app; log results in docs/08.
4. Open the closed alpha to 10–20 people; track the pass bar above weekly.
