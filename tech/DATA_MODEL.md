# Data Model

**Status:** Draft v0.1 · **Last updated:** 2026-10-03 · **DB:** Postgres (Supabase)
Conventions: `uuid` PKs, `created_at timestamptz default now()`, RLS on every user-owned table (`user_id = auth.uid()`), money in **paise** as `bigint`, units as `numeric(20,4)`, rates as `numeric(10,6)`.

## 1. Reference data (global, read-only to users)
| Table | Key columns | Source / refresh |
|---|---|---|
| `schemes` | `isin` PK, `amfi_code`, `name`, `amc`, `category`, `sub_category`, `plan` (direct/regular), `option` (growth/IDCW), `benchmark`, `paired_isin` (direct↔regular twin) | AMFI scheme master; daily |
| `nav_history` | `isin`, `nav_date`, `nav` | AMFI daily NAV file; daily |
| `scheme_ter` | `isin`, `effective_date`, `ter_pct` | AMFI TER disclosure; on change |
| `scheme_holdings` | `isin`, `as_of_month`, `instrument_isin`, `instrument_name`, `industry`, `pct_nav`, `asset_class` | AMFI monthly portfolio disclosures; monthly (D-OPEN-3) |
| `benchmarks` / `benchmark_values` | `code`, `name`; `code`, `date`, `value` | Index providers / TRI (⚠ licensing check) |

## 2. User & consent
| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `user_id` PK→auth.users, `display_name_enc`, `created_at` | Name encrypted |
| `members` | `id`, `user_id`, `label` ("Self", "Mother"), `pan_hash`, `pan_last4`, `consent_attested_at` | Family view (F10) |
| `consents` | `id`, `user_id`, `purpose` (`analysis`, `product_improvement`, `marketing`), `version`, `granted_at`, `withdrawn_at` | DPDP purpose-wise consent |
| `risk_profiles` | `id`, `member_id`, `answers jsonb`, `score`, `category`, `version`, `completed_at` | Reused for RIA suitability |
| `advice_eligibility` | `member_id`, `risk_profile_id`, `agreement_signed_at`, `ria_of_record`, `enabled` | For `advised` mode (later) |
| `advice_allowlist` | `user_id`, `mode` (`internal`), `added_by`, `reason`, `added_at` | Founder + consenting family only (D-016) |
| `recommendations` | `id`, `upload_id`, `member_id`, `type` (A1–A6), `actions jsonb`, `rationale_fact_ids text[]`, `expected_impact_paise`, `costs jsonb` (tax, exit load), `assumptions jsonb`, `suitability_passed`, `rules_version`, `mode`, `reviewed_by`, `reviewed_at` | Deterministic output of the advice engine |
| `tax_rules` (config file, versioned) | `rule`, `value`, `effective_from`, `source_url` | `config/tax_rules.yaml`; CI fails if `source_url` is missing |

## 3. Portfolio snapshot (one per CAS upload)
| Table | Key columns | Notes |
|---|---|---|
| `uploads` | `id`, `member_id`, `source` (`cams`,`kfintech`,`aa`), `cas_type` (detailed/summary), `statement_period`, `status`, `error_code`, `file_path` (null unless opted in), `parser_version` | Never stores the password |
| `folios` | `id`, `member_id`, `folio_hash`, `amc` | Folio number hashed |
| `holdings` | `id`, `upload_id`, `folio_id`, `isin`, `units`, `nav`, `nav_date`, `value_paise`, `cost_paise` | Snapshot at statement date |
| `transactions` | `id`, `folio_id`, `isin`, `txn_date`, `type` (purchase, SIP, redemption, switch_in/out, dividend, stamp_duty, STT), `units`, `amount_paise`, `nav`, `upload_id` | Deduped across uploads by (folio, isin, date, type, units, amount) |
| `reconciliations` | `upload_id`, `cas_total_paise`, `parsed_total_paise`, `diff_paise`, `passed` | AC3 of US1 |

## 4. Computation & AI
| Table | Key columns | Notes |
|---|---|---|
| `facts` | `id` (stable, e.g. `F-xirr-portfolio`), `upload_id`, `type`, `subject` (isin / portfolio / pair), `value numeric`, `unit` (`pct`, `paise`, `ratio`, `count`), `formula`, `inputs jsonb`, `as_of jsonb`, `engine_version` | Single source of truth for every number |
| `insights` | `id`, `upload_id`, `rule_id`, `severity`, `impact_paise_per_year`, `fact_ids text[]`, `rank` | Rules engine output |
| `ai_outputs` | `id`, `insight_id` or `chat_message_id`, `prompt_version`, `model`, `fact_sheet_hash`, `text`, `check_status` (passed / rewritten / blocked), `latency_ms`, `input_tokens`, `output_tokens` | No PII; cached by `fact_sheet_hash` + `prompt_version` |
| `chat_sessions` / `chat_messages` | `id`, `user_id`, `role`, `content`, `intent`, `fact_ids_cited`, `kb_chunk_ids_cited` | User question text may contain PII; retention policy applies |
| `ai_feedback` | `id`, `ai_output_id`, `rating`, `reason`, `comment` | Feeds the eval set |
| `kb_chunks` | `id`, `source_url`, `source_date`, `title`, `text`, `embedding vector` | Curated KB (ADR-007) |

## 5. Outcomes
| Table | Key columns | Notes |
|---|---|---|
| `detected_actions` | `id`, `member_id`, `from_upload_id`, `to_upload_id`, `type` (`regular_to_direct`, `exit_overlap`, `consolidate_folio`, …), `isins`, `linked_insight_id`, `user_confirmed`, `confirmed_at` | North Star source |
| `events` | `id`, `user_id`, `name`, `props jsonb`, `ts` | Product analytics; no PII in props |
| `audit_log` | `id`, `actor`, `action`, `object`, `meta jsonb`, `ts` | Append-only (revoke update/delete) |

## 6. Key relationships
`auth.users 1─* members 1─* uploads 1─* holdings` · `members 1─* folios 1─* transactions` · `uploads 1─* facts 1─* insights 1─1 ai_outputs` · `uploads (from,to) ─ detected_actions ─ insights`

## 7. Deletion
`delete_user(user_id)`: cascades over every user-owned table and storage objects, removes vectors, writes `audit_log(action='user_deleted', object=hash(user_id))`. Covered by an integration test asserting zero remaining rows.
