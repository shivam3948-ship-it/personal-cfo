-- Usage events and sample-data answer traces (D-057). Written only by the server with the service-role key; no one can
-- read them through the public API (RLS on, no policies). No user ids: `install` is a random id made on the phone.
-- Events from your own data carry metadata only (cleaned by apps/munim/lib/telemetryCore.ts); sample_traces holds the
-- redacted question and answer for the sample family only.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  install text not null check (install ~ '^[a-z0-9-]{8,40}$'),
  name text not null,
  props jsonb not null default '{}'::jsonb
);
create index if not exists events_name_at on public.events (name, at desc);
alter table public.events enable row level security;

create table if not exists public.sample_traces (
  id text primary key,
  at timestamptz not null default now(),
  question text not null,
  answer text not null,
  engine text, model text, prompt text, lang text,
  ms integer, grounded boolean, unverified integer,
  calls jsonb not null default '[]'::jsonb
);
alter table public.sample_traces enable row level security;

-- Retention: keep 180 days of events and 90 days of traces (run daily, e.g. with pg_cron).
-- delete from public.events where at < now() - interval '180 days';
-- delete from public.sample_traces where at < now() - interval '90 days';
