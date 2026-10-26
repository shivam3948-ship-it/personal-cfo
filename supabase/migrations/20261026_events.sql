-- Usage events and sample-data answer traces (D-057). Written only by the server with the service-role key; no one can
-- read them through the public API (RLS on, no policies). No user ids: `install` is a random id made on the phone.
-- Events from your own data carry metadata only (cleaned by apps/munim/lib/telemetryCore.ts); sample_traces holds the
-- redacted question and answer for the sample family only.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  install text not null check (install ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  name text not null,
  props jsonb not null default '{}'::jsonb
);
create index if not exists events_name_at on public.events (name, at desc);
alter table public.events enable row level security;

create table if not exists public.sample_traces (
  id text primary key,
  at timestamptz not null default now(),
  install text not null check (install ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'), -- so "turn off" deletes these too
  question text not null,
  answer text not null,
  engine text, model text, prompt text, lang text,
  ms integer, grounded boolean, unverified integer,
  calls jsonb not null default '[]'::jsonb
);
create index if not exists sample_traces_install on public.sample_traces (install);
create index if not exists events_install on public.events (install);
alter table public.sample_traces enable row level security;

-- Retention (D-057): 180 days of events, 90 days of sample traces, every night at 02:30 UTC. Uses pg_cron when the
-- project has it; otherwise this block only prints a notice and the two deletes must be run another way.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('munim-retention', '30 2 * * *',
    $q$delete from public.events where at < now() - interval '180 days';
       delete from public.sample_traces where at < now() - interval '90 days';$q$);
exception when others then
  raise notice 'pg_cron not available (%). Schedule the retention deletes another way.', sqlerrm;
end $$;
