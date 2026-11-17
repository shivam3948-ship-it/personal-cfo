-- Munim v1 schema. Run once in the Supabase SQL editor (or `supabase db push`).
-- Every table has row-level security: a user can only see and change their own rows (D-027).
-- Nothing here stores PAN, names from statements, folio numbers or CAS passwords (AGENTS.md rule 4/5).

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  relation text not null default 'self' check (relation in ('self','parent','spouse','child','sibling','other')),
  consent_attested_at timestamptz, -- "I have their permission" for family members (J8)
  created_at timestamptz not null default now()
);
create index if not exists members_user on public.members(user_id);

create table if not exists public.consents (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('analyse','ai','voice')),
  granted boolean not null,
  version text not null default 'v1',
  updated_at timestamptz not null default now(),
  primary key (user_id, purpose)
);

-- One row per member: parsed, pseudonymised data (transactions, loans, policies, credit, portfolio holdings) as JSON.
create table if not exists public.datasets (
  member_id uuid primary key references public.members(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.actions (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  key text not null, -- content key: makes actions idempotent (a double "haan" never creates two)
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, member_id, key)
);

alter table public.members enable row level security;
alter table public.consents enable row level security;
alter table public.datasets enable row level security;
alter table public.actions enable row level security;

drop policy if exists own_members on public.members;
create policy own_members on public.members for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_consents on public.consents;
create policy own_consents on public.consents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_datasets on public.datasets;
create policy own_datasets on public.datasets for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()));
drop policy if exists own_actions on public.actions;
create policy own_actions on public.actions for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()));

-- "Delete all my data" (J14): removes every row the caller owns. The auth account itself is removed by the server
-- only if SUPABASE_SERVICE_ROLE_KEY is configured; otherwise on request.
create or replace function public.delete_my_data() returns void language sql security invoker set search_path = public as $$
  delete from public.actions where user_id = auth.uid();
  delete from public.datasets where user_id = auth.uid();
  delete from public.members where user_id = auth.uid();
  delete from public.consents where user_id = auth.uid();
$$;
grant execute on function public.delete_my_data() to authenticated;
