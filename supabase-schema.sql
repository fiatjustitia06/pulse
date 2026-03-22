-- ─────────────────────────────────────────────────────────────────────────────
-- PULSE Platform — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Business Profiles ────────────────────────────────────────────────────────
create table if not exists public.business_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  owner_name text not null,
  category text not null,
  description text not null,
  budget text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id)
);

-- ─── Analysis Results ─────────────────────────────────────────────────────────
create table if not exists public.analysis_results (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  location_lat double precision not null,
  location_lng double precision not null,
  location_address text not null,
  location_suburb text,
  location_postcode text,
  scores jsonb not null default '{}',
  insights jsonb not null default '{}',
  projections jsonb not null default '{}',
  ai_summary text,
  created_at timestamp with time zone default now()
);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
alter table public.business_profiles enable row level security;
alter table public.analysis_results enable row level security;

-- Business profiles: users can only see and manage their own
create policy "Users can view own profile"
  on public.business_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.business_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.business_profiles for update
  using (auth.uid() = user_id);

-- Analysis results: users can only see and manage their own
create policy "Users can view own analyses"
  on public.analysis_results for select
  using (auth.uid() = user_id);

create policy "Users can insert own analyses"
  on public.analysis_results for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own analyses"
  on public.analysis_results for delete
  using (auth.uid() = user_id);

-- ─── Trigger: update updated_at ───────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_business_profiles_updated
  before update on public.business_profiles
  for each row execute procedure public.handle_updated_at();

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_business_profiles_user_id on public.business_profiles(user_id);
create index if not exists idx_analysis_results_user_id on public.analysis_results(user_id);
create index if not exists idx_analysis_results_business_id on public.analysis_results(business_id);
create index if not exists idx_analysis_results_created_at on public.analysis_results(created_at desc);
