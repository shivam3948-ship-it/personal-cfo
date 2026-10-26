# 16 · Voice stack decision (buildathon + Phase 1.5)

**Decision (D-019):** a cascaded pipeline. **Sarvam** handles speech in both directions (Saaras for STT, Bulbul for TTS) and **Claude** does the reasoning, with tool calls. If Sarvam is unavailable, the browser's Web Speech API takes over. If Claude is unavailable, a rule-based agent answers. All numbers come from code. Status: decided 2026-10-15 for the buildathon; revisit after it (see §6).

> Facts about vendors (models, prices, limits) were checked against vendor pages on 2026-10-15 and change often. The Sarvam docs pages disagree with each other on TTS field names, so the client tries several request shapes. Run `npm run smoke` before relying on any of it.

## 1. What the use case needs
| Need | Why it matters here |
|---|---|
| **Hindi, English and Hinglish in one sentence** | Users say "mera card ka bill kab due hai". STT must handle code-mixing, and TTS must say "EMI" and "₹36,343" naturally in Hindi. |
| **Exact numbers** | A misheard "50 hazaar" or a made-up "₹15,000" costs trust. The reasoning layer must be tool-driven and checkable. |
| **Indian voices** | The voice is the product. An American-accented Hindi voice undercuts it. |
| **Under ~5 s per turn** | Anything slower feels broken in a live demo. |
| **Works when the network is bad** | Venue wifi. The demo cannot depend on one vendor. |
| **Cost at scale** | A Phase 1.5 consumer feature for mass-market users (the Bachatt audience). |

## 2. Architecture: cascade vs speech-to-speech
| | Cascade (STT → LLM with tools → TTS) | Speech-to-speech realtime model |
|---|---|---|
| Number control | Text in the middle, so every figure is checked against tool output before it is spoken (`lib/agent/guard.ts`) | The model speaks directly; hard to verify figures before they are heard |
| "Show the math" | Free: the transcript, tool calls and results are all text | Needs a separate transcript and tool log |
| Hindi voice quality | Pick the best Indian TTS (Sarvam) | Limited to the vendor's voices; Indian-accent Hindi quality is uncertain (not verified) |
| Latency | Higher: three hops, about 3–6 s (my estimate, not measured; measure with `npm run smoke`) | Lower, sub-second turn-taking |
| Vendor swap | Each hop is replaceable | All or nothing |

**Choice: cascade.** In finance, exact numbers and an auditable trace matter more than natural turn-taking, so the higher latency is worth it. To cut latency: short spoken answers (≤ 70 words), a "thinking" state in the UI, and later streaming TTS (Sarvam lists a streaming/WebSocket option; not built yet).

## 3. Speech-to-text options
| Option | Hindi/Hinglish | Cost (verify) | Privacy | Notes | Verdict |
|---|---|---|---|---|---|
| **Sarvam Saaras** (`saaras:v4` default; `v3` has `codemix` / `translit` modes) | Built for Indian languages; detects language (`language_code: unknown`) | Listed at ₹0.49/min; free credits on signup | Indian company; check where data is processed | REST for clips under ~30 s; accepts WebM from browsers | **Primary** |
| Browser Web Speech API (Chrome/Edge) | `hi-IN` works; Hinglish comes out as mixed scripts | Free | Audio goes to the browser vendor's servers | Not on Firefox; needs network | **Fallback** |
| Whisper-class models (OpenAI etc.) | Multilingual; Hinglish handling unverified | Per-minute pricing | Data leaves India | Good general accuracy | Not chosen: no clear Hinglish advantage, plus cross-border data |
| Google Cloud STT | Has `hi-IN` | Per-minute | Google Cloud | Needs a GCP project and setup on the day | Not chosen: setup cost on the day |

## 4. Text-to-speech options
| Option | Indian Hindi voice | Cost (verify) | Notes | Verdict |
|---|---|---|---|---|
| **Sarvam Bulbul** (`bulbul:v3`; a `v4-flash` is also listed) | Indian voices, Hindi and Indian-English | Listed at ₹3 per 1k chars (v3), ₹2 per 1k chars (v4 Flash) | Docs advise commas in numbers above 4 digits; we also turn "₹" into "रुपये"/"rupees" and ISO dates into spoken dates (`forSpeech`) | **Primary** |
| ElevenLabs | Multilingual, high quality; Indian-accent Hindi unverified | Higher (not verified) | Named by the organisers as allowed | Backup if Bulbul sounds poor in the smoke test |
| Browser `speechSynthesis` | Depends on the OS (a `hi-IN` voice exists on many Android/Chrome setups; not guaranteed on a laptop) | Free | Robotic | **Fallback** |

**Cost per turn** (computed in Python, using the listed prices above, an ~8 s question and a ~300-character answer):

| Item | Cost |
|---|---|
| STT | ₹0.07 |
| TTS on Bulbul v3 | ₹0.90 |
| TTS on Bulbul v4 Flash | ₹0.60 |
| Total per turn (v3) | about ₹0.97 |
| A 300-turn demo day (v3) | about ₹290 |

Claude tokens come on top. Check current pricing in the Anthropic console; I have not included it. **TTS is about 93% of the voice cost, so keep answers short.** That is good for UX anyway.

## 5. Reasoning layer
| Option | Tool-use reliability | Hindi quality | Verdict |
|---|---|---|---|
| **Claude** (`ANTHROPIC_MODEL`, default `claude-sonnet-5-5`) | Strong multi-tool use, follows "numbers only from tools" well | Good Devanagari Hindi; keeps EMI/SIP in English, as instructed | **Primary**. Already our Phase 1 model (ADR-003); evals carry over. |
| Sarvam's own LLMs | Not evaluated | Built for Indian languages | Worth a timed eval after Saturday: could cut latency and keep everything with one Indian vendor |
| Rule-based agent (`lib/agent/offline.ts`) | Deterministic, 10 intents | Template Hindi/English | **Fallback**. The demo never dies. |

A faster model for latency (e.g. Haiku) is a one-line env change (`ANTHROPIC_MODEL`). Run `npm run eval:live` on both and compare `verified` and latency before switching.

## 6. Risks and revisit triggers
- **Sarvam field names differ across versions.** The TTS client tries 3 request shapes; `npm run smoke` shows which one works. Fix the order on Friday.
- **Phone mic needs HTTPS.** `localhost` works on the laptop, but a phone needs a deployed URL or a tunnel (docs/17 §2).
- **Revisit** if smoke-test latency is over 6 s per turn (try `bulbul:v4-flash`, a faster Claude model, or streaming), if Hinglish STT misses amounts in rehearsal (try `saaras:v3` + `SARVAM_STT_MODE=codemix`), or after Saturday for Phase 1.5 (cost at scale, data residency under DPDP).

Sources: Sarvam API reference pages for [speech-to-text](https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe) and [text-to-speech](https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert), read 2026-10-15. Prices are from Sarvam's pricing page as read earlier in this project; re-verify them.

## Update 26 Oct 2026 (D-058): piece-by-piece speech and stage timings
- Answers are checked whole (the number check), then spoken a sentence at a time: the first sentence plays while the next is synthesised (`splitForSpeech` in packages/core, `speakPieces` in apps/munim/ui/voice.ts). Not token streaming, so no unchecked figure is ever spoken.
- Every voice turn records three stages as a `voice_turn` event (D-057, metadata only): hearing (server STT), answering, and speaking (answer back to first sound). Test mode shows them under each answer.
- As of 26 Oct the live site has no `SARVAM_API_KEY` (TTS returns 501, so the browser voice reads answers) and no `ANTHROPIC_API_KEY` (the rules engine answers). Real latency numbers need both keys set on Vercel.
