-- The owner's turn log (D-089). One row per Ask answer from a browser marked as the owner's (MUNIM_OWNER_KEY): the
-- redacted question and answer, stage timings, tokens, estimated cost and the cut-in listener's levels, plus flags for
-- the turns that need a look. Written and read only by the server's service-role key; RLS on, no policies, so the public
-- API gets nothing. No user accounts exist: the owner clears it from /owner, and rows older than 90 days are deleted.
create table if not exists public.owner_turns (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{6,64}$'),
  at timestamptz not null default now(),
  rec jsonb not null,
  flags text[] not null default '{}'
);
create index if not exists owner_turns_at on public.owner_turns (at desc);
alter table public.owner_turns enable row level security;
revoke all on public.owner_turns from anon, authenticated;
grant select, insert, update, delete on public.owner_turns to service_role;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('munim-owner-turns-retention', '40 2 * * *', $q$delete from public.owner_turns where at < now() - interval '90 days';$q$);
exception when others then
  raise notice 'pg_cron not available (%). Delete owner_turns older than 90 days another way.', sqlerrm;
end $$;
