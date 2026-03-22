-- ─────────────────────────────────────────────────────────────────────────────
-- PULSE Schema Patch v3 — Run this in Supabase SQL Editor
-- Adds admin read/delete policies so the admin panel works WITHOUT needing
-- the service role key (uses the JWT email check instead)
-- ─────────────────────────────────────────────────────────────────────────────

-- Allow admin to read ALL business profiles
create policy "Admin can view all business profiles"
  on public.business_profiles for select
  using (
    auth.jwt() ->> 'email' = 'charles060906@gmail.com'
  );

-- Allow admin to delete ANY business profile
create policy "Admin can delete any business profile"
  on public.business_profiles for delete
  using (
    auth.jwt() ->> 'email' = 'charles060906@gmail.com'
  );

-- Allow admin to read ALL analysis results
create policy "Admin can view all analyses"
  on public.analysis_results for select
  using (
    auth.jwt() ->> 'email' = 'charles060906@gmail.com'
  );

-- Allow admin to delete ANY analysis result
create policy "Admin can delete any analysis"
  on public.analysis_results for delete
  using (
    auth.jwt() ->> 'email' = 'charles060906@gmail.com'
  );

-- Allow admin to delete any activity log entry
create policy "Admin can delete activity logs"
  on public.activity_log for delete
  using (
    auth.jwt() ->> 'email' = 'charles060906@gmail.com'
  );
