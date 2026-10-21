# 39 · Event names for the Munim v2 screens (19 Oct 2026)

**Status:** names and properties are agreed now. The provider is wired last (D-031). Every event goes through `lib/analytics.ts` and is stored in the `events` table (tech/DATA_MODEL.md).
- Autopay events: docs/37 §9. This doc only references them.
- Mocks: the Munim v2 design canvas. Each screen's Tweaks switch `theme` and `state`.

## Rules
- **Naming:** `object_action`, snake_case, past tense for something that happened (`checkin_card_completed`) and `_shown` for impressions. A name never changes once it ships; add a new event instead.
- **No PII in properties** (AGENTS.md rule 4): no names, merchants typed by the user, account numbers, free text or voice transcripts. Rupee amounts go in **bands** (`<500`, `500–2k`, `2k–10k`, `10k–50k`, `>50k`), never exact figures, except saving amounts the user picked from fixed chips (₹20 / ₹50 / ₹100).
- **Every event carries these properties automatically:**
  - `screen`;
  - `theme` (light / dark);
  - `app_version`;
  - `platform` (web / android / ios);
  - `session_id`;
  - `days_since_signup`;
  - `autopay_state` (docs/37 §2);
  - `streak_days`.
- **States are events too.** Every screen logs its loading, error and empty states the same way (see "Screen states" below). A slow or broken screen otherwise looks like a user who left.

## Screen states (all screens)
| Event | Properties | Fires when |
|---|---|---|
| `screen_viewed` | `screen`, `entry` (tab / link / notification / deep_link) | The screen becomes visible |
| `screen_loading_shown` | `screen` | A skeleton shows for more than 300 ms |
| `screen_loaded` | `screen`, `load_ms`, `from_cache` | Real data has rendered |
| `screen_error_shown` | `screen`, `error_kind` (offline / timeout / server / parse), `stale_data_shown` (bool), `stale_age_min` | The error UI shows |
| `screen_retry_tapped` | `screen`, `error_kind`, `attempt` | Retry is tapped |
| `screen_empty_shown` | `screen`, `empty_reason` (no_statement / first_week / partial_month / no_recaps / first_open) | The empty UI shows |
| `empty_cta_tapped` | `screen`, `cta` (add_bank_statement / try_sample / add_month_statement / back_to_checkin) | The empty-state button is tapped |

## Today
| Event | Properties |
|---|---|
| `verdict_shown` | `verdict` (okay / bill_due / overspent / …), `bills_mode` (due_soon / pending / paid) |
| `checkin_card_shown` | `card` (save / yesterday / fix / bill / sunday_call / month_close), `position` (1–3), `card_type` (Phase 2 pool, docs/38) |
| `checkin_card_completed` | `card`, `position`, `action` (primary / secondary), `time_on_card_ms` |
| `checkin_dot_tapped` | `from_card`, `to_card`, `to_done` (bool) |
| `save_amount_chosen` | `flow` (autopay / once), `kind` (preset / custom), `amount` (preset value, or a band for custom), `custom_invalid_shown` (bool) |
| `checkin_answers_reviewed` | `entry` (all_done_button / dot) |
| `checkin_answer_changed` | `card`, `from_choice`, `to_choice`, `minutes_since_first` (a high rate means the first choice was unclear) |
| `checkin_answer_locked_shown` | `card`, `lock_reason` (payment_final / …) |
| `recap_day_daily_cards_opened` | `recap_kind` (sunday_call / month_close) |
| `checkin_all_done` | `cards_done` (2–3), `total_ms`, `streak_days_after` |
| `yday_off_opened` | (none) |
| `yday_off_reason` | `reason` (txn_wrong / missing / fraud) |
| `txn_fixed` | `fix` (category / shared / duplicate / disputed), `scope` (once / always), `from_category`, `to_category`, `amount_band` |
| `missing_spend_added` | `kind` (preset / custom), `amount_band`, `category` |
| `fraud_help_shown` / `fraud_call_tapped` / `fraud_reported_marked` | `entry` (reasons / transaction) |
| `yday_fix_undone` | `fix` |
| `fix_action_tapped` | `fix_type` (unused_sub / price_rise / duplicate / fee), `annual_band` |
| `bill_pay_tapped` | `bill_type`, `days_to_due`, `amount_band` (fake door until bill pay ships) |
| `bill_remind_tapped` | `bill_type`, `days_to_due` |
| `streak_sheet_opened` | `streak_days` |
| `bigpicture_math_toggled` | `open` (bool) |
| `amounts_hidden_toggled` | `hidden` (bool) |
| `recaps_row_tapped` | `latest` (sunday_call / month_close) |
| `tool_tapped` | `tool` (goals / fire / insurance / family) |
| `fake_door_shown` / `fake_door_notify_tapped` | `feature` (autopay / topup / bill_pay / save_now / bank_sync / …) |
| Save card and autopay | docs/37 §9: `save_card_shown`, `autopay_cta_tapped`, `autopay_reserved`, `save_just_today` (fires on "Save once" after an amount is confirmed), `save_skipped` (fires on "Not now"), … |

## Sunday Money Call
| Event | Properties |
|---|---|
| `sunday_call_started` | `entry` (today_card / notification / recaps), `mode` (listen / read), `week_start` |
| `sunday_beat_viewed` | `beat` (1–5: win / spend / upcoming / investments / decision), `mode` |
| `sunday_mode_switched` | `to` (listen / read), `beat` |
| `sunday_interrupt_tapped` | `beat` (the mic: the user asks a question mid-call) |
| `sunday_decision_made` | `decision_type` (review_subs / …), `choice` (accept / not_this_week) |
| `sunday_call_completed` | `listened_ms`, `beats_seen`, `mode_final` |
| `sunday_call_abandoned` | `last_beat`, `listened_ms` |

## Recaps
| Event | Properties |
|---|---|
| `recap_opened` | `kind` (weekly / monthly), `period`, `age_days` |
| `recap_missed_shown` | `kind`, `period` (shows the "Missed" tag; tells us how often calls are skipped) |

## Close your month
| Event | Properties |
|---|---|
| `month_close_started` | `entry` (today_card / notification / recaps), `month`, `days_after_salary` |
| `month_close_step_viewed` | `step` (1–6: report / worth / subs / card / goals / plan) |
| `subscription_marked` | `action` (cancel / undo), `annual_band`, `sub_category` (video / music / fitness / …; never the merchant name typed by the user) |
| `autopay_raise_answered` | `choice` (raise / keep), `from`, `to` (also counted under docs/37 `salary_raise_*`) |
| `month_close_completed` | `total_ms`, `subs_cancelled`, `annual_saved_band` |
| `share_card_tapped` | `channel` (whatsapp / other) |

## Ask Munim (talk sheet)
| Event | Properties |
|---|---|
| `ask_opened` | `entry` (nav_orb / sunday_interrupt / suggestion), `first_time`, `days_since_last_ask` (measures whether the indigo orb gets found and reused) |
| `ask_listen_started` | `lang_hint` (hi / en / auto) |
| `ask_listen_stopped` | `speech_ms`, `stop_kind` (tap / silence / cancel) |
| `ask_suggestion_tapped` | `suggestion_id` (the ID only; never the text) |
| `ask_typed` | `chars_band` |
| `ask_answer_shown` | `latency_ms`, `intent` (bill_cover / spend_where / sub_cost / …), `grounded` (bool: passed the fact check), `lang` |
| `ask_math_toggled` | `open` (bool), `intent` |
| `ask_followup_tapped` | `followup` (remind / see_bills / …) |
| `ask_error_shown` | `error_kind` (no_speech / mic_denied / offline / timeout / refused) |
| `ask_feedback` | `rating` (up / down), `intent` (later) |

## Spends (v4 mock, docs/41)
| Event | Properties |
|---|---|
| `pace_chart_scrubbed` | `day` (1–31) |
| `pace_how_opened` | `pace` (below / above), `delta_band` |
| `money_in_opened` | `earner_type` (salaried / irregular), `credits_count` |
| `spends_change_tapped` | `fix_type` (pace / unused_sub / duplicate / trial / rate), `rupee_band` |
| `save_difference_tapped` | `amount_band` |
| `skip_save_chosen` | `category` (food_delivery / …), `orders` (1–3), `amount_band` |
| `skip_save_undone` | `category`, `seconds_since_save` |
| `category_opened` | `category`, `kind` (choice / need / cash / member), `card` (skip / below / usual / essential / cash / member) |
| `cash_use_answered` | `use` (household_help / groceries / family / other), `scope` (rule / once) |
| `txn_fixed` (Transactions) | as on Today (docs/38): `fix` (category / shared / duplicate / not_mine / note), `scope` (once / rule), `from_category`, `to_category`, `amount_band`; plus `undone` (bool) |
| `duplicate_check_result` | `found` (bool) |
| `spends_month_switched` | `to` (current / past), `months_back` |
| `unsorted_shown` | `count`, `out_band`, `in_band` |
| `unsorted_answered` | `kind` (shop / person / in), `answer`, `remember` (bool), `position` |
| `unsorted_skipped` | `kind`, `position` |
| `all_categories_toggled` | `open` (bool) |

## Metrics these unlock
- **Habit:**
  - check-in completion: `checkin_all_done` ÷ `screen_viewed` (Today) per day;
  - D7 and D30 retention;
  - median `total_ms` (target under 60 s).
- **Recaps:**
  - Sunday call completion (`completed` ÷ `started`);
  - drop-off by beat;
  - month-close completion within 3 days of salary.
- **Trust and quality:**
  - `screen_error_shown` rate and median `load_ms` per screen;
  - share of Ask answers that pass the fact check;
  - `txn_fixed` and `missing_spend_added` rates (how often our numbers are wrong), and the share of fixes that become rules.
- **Fake-door demand:** `fake_door_notify_tapped` ÷ `fake_door_shown` per feature. This ranks which integration to build first.
