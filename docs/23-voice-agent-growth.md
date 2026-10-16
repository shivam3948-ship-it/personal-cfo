# 23 · Growing an in-app voice agent (discovery → adoption → usage)

**Goal (16 Oct 2026):** increase discovery, adoption and usage of a voice agent *inside a host app* like Bachatt. Munim becomes the voice layer, not a separate app.
**User for this goal:** the host app's user. For Bachatt: first-time savers, often self-employed, Hindi or code-mixed speakers, low-end Android, noisy places, patchy data (from public sources as of 3 Oct 2026; verify). This differs from Rohan (docs/11); for this goal, Rohan is secondary.

## Problem statement
Voice agents inside apps get little use because: (1) users don't find them (an icon in a corner, a separate tab); (2) the first try fails (noise, code-mixed speech, slow or vague answers), and users don't try twice; (3) they aren't tied to what users came to do (save today, check balance, withdraw, pause), so there is no reason to come back.

## Jobs to be done (host-app user)
| When… | I want to… | So I can… |
|---|---|---|
| I'm unsure on a screen (save, withdraw, SIP) | ask in my own words and get a straight answer | finish what I came to do without fear |
| I can't read or type comfortably | just say it | use the app like a phone call |
| money is tight this week | pause, lower or skip a saving without losing everything | keep the habit instead of quitting |
| I wonder if it's working | hear how much I've saved and what it earned | trust the app and keep going |
| something looks wrong (a debit, a fee) | ask and get it fixed or explained | not feel cheated |

## Levers by stage
| Stage | Main barrier | Levers |
|---|---|---|
| **Discovery** (first tap) | Doesn't know it exists or what it's for | Mic **inside each task screen** with a task-specific hint ("बोलकर पूछिए: कितना बचा?"), not a separate tab · **proactive offer on hesitation** (long dwell, back-and-forth, failed payment, withdrawal attempt) · notification that opens straight into voice (weekly "money call") · outbound call or WhatsApp voice note for users who don't open the app |
| **Adoption** (first success) | First attempt fails or feels risky | Tappable example prompts in the user's language · first questions are ones the agent answers perfectly (balance, last save, next debit) · transcript shown at once, "did you mean…?" on low confidence · fast first reply (stream speech) · numbers traced to data, disclaimer once · text fallback and human handoff |
| **Usage** (habit) | No reason to come back | Voice that **does** things with a spoken "haan" confirm (pause/raise daily saving, reminder, raise a complaint), idempotent · weekly ritual (Sunday money call) with progress · remembers context · voice becomes the fastest path for the top 5 tasks |

## Metrics
- **North Star:** weekly users who complete a task by voice (answer accepted or action done).
- Discovery: entry-point views → taps (by placement); share of new users who try voice in week 1.
- Adoption: first-session success rate (answered without repeat/fallback); time to first audio (p50/p90); % who try a 2nd time within 7 days.
- Usage: voice WAU/MAU; sessions per user per week; % sessions ending in an action; D7/D30 voice retention; share of key tasks done by voice.
- Guardrails: wrong numbers = 0 (guard); advice-boundary violations = 0; complaint rate; speech-recognition errors on Hindi/code-mix; cost per session.

## First experiments
1. Entry point: floating mic vs in-task mic with hint (primary: taps → successful sessions).
2. Proactive offer on hesitation vs none (primary: task completion on that screen).
3. Example prompts vs empty mic (primary: first-session success).
4. Weekly money call by push vs outbound voice call (primary: D30 voice retention).
