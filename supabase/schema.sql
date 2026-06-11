-- PricingEngine — Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
--
-- The app stores its whole dataset as one JSON document in `app_state` (id = 'main').
-- This is durable, cross-device, and automatically backed up by Supabase.
-- (We can later normalise this into per-entity tables for SQL reporting / multi-user.)

create table if not exists app_state (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Row Level Security. This permissive policy is fine for a single-user, internal,
-- localhost tool. BEFORE exposing the app publicly, replace it with auth-based rules.
alter table app_state enable row level security;

drop policy if exists "app_state all access" on app_state;
create policy "app_state all access"
  on app_state
  for all
  using (true)
  with check (true);
