-- ─────────────────────────────────────────────────────────────────────────────
-- PULSE Schema Patch v2 — Run this in Supabase SQL Editor
-- Adds: multiple business profiles per user, activity logging
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the unique constraint that prevented multiple profiles per user
alter table public.business_profiles drop constraint if exists business_profiles_user_id_key;

-- 2. Activity log table
create table if not exists public.activity_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  event_type text not null,  -- 'login', 'logout', 'signup', 'analysis_created', 'profile_created'
  metadata jsonb default '{}',
  ip_address text,
  user_agent text,
  created_at timestamp with time zone default now()
);

-- 3. RLS for activity_log — only the admin can read all rows
alter table public.activity_log enable row level security;

-- Admin can read everything (admin identified by email stored in metadata)
create policy "Admin can view all activity"
  on public.activity_log for select
  using (
    auth.jwt() ->> 'email' = 'charles060906@gmail.com'
  );

-- Anyone (including service role) can insert activity logs
create policy "Anyone can insert activity"
  on public.activity_log for insert
  with check (true);

-- 4. Index for performance
create index if not exists idx_activity_log_created_at on public.activity_log(created_at desc);
create index if not exists idx_activity_log_user_id on public.activity_log(user_id);
create index if not exists idx_activity_log_event_type on public.activity_log(event_type);
