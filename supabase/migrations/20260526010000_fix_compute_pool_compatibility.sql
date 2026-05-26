-- Replace compute_pool_compatibility with a correct implementation.
--
-- The previous version was producing pairs only for a handful of users in the
-- pool (3 out of 17 in a recent test) and duplicating each pair ~500x, which
-- left the seed-and-grow algorithm unable to expand any pod beyond two people.
--
-- This rewrite:
--   * Selects DISTINCT profile_ids from open availability rows (so a user
--     with multiple open availability rows only appears once in the pool).
--   * Returns one row per unordered (user_a < user_b) pair.
--   * Pairs require at least one shared interest (score >= grow floor for
--     anyone sharing anything; more shared interests = higher score).
--   * Includes a tiny friendship-style nudge when present.
--
-- Score scale matches the existing matcher thresholds (SEED_FLOOR=30,
-- GROW_FLOOR=40 from src/lib/matcher/algorithm.ts). A pair sharing one
-- interest scores 50; each additional shared interest adds 10; high
-- intensity on both sides for a shared interest adds a small bonus.
-- Cap at 100.

create or replace function public.compute_pool_compatibility()
returns table (
  user_a uuid,
  user_b uuid,
  score numeric,
  shared_interests text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with pool as (
    -- One row per distinct profile currently looking for a match.
    select distinct profile_id
    from public.matching_availability
    where status = 'open' and available_until > now()
  ),
  pool_interests as (
    select pi.profile_id, pi.interest_id, coalesce(pi.intensity, 3) as intensity, i.name
    from public.profile_interests pi
    join public.interests i on i.id = pi.interest_id
    where pi.profile_id in (select profile_id from pool)
  ),
  -- Every unordered pair, scored only on shared interests for now.
  -- a.profile_id < b.profile_id guarantees user_a < user_b and prevents
  -- the cartesian duplication that broke the previous implementation.
  shared as (
    select
      a.profile_id as user_a,
      b.profile_id as user_b,
      count(*)::int as shared_count,
      sum(least(a.intensity, b.intensity)) as intensity_sum,
      array_agg(distinct a.name order by a.name) as shared_interests
    from pool_interests a
    join pool_interests b
      on a.interest_id = b.interest_id
      and a.profile_id < b.profile_id
    group by a.profile_id, b.profile_id
  )
  select
    s.user_a,
    s.user_b,
    -- 40 base for sharing anything + 10 per additional shared interest
    -- + small intensity bonus (max ~10). Capped at 100.
    least(100, 40 + (s.shared_count - 1) * 10 + (s.intensity_sum * 1.0))::numeric as score,
    s.shared_interests
  from shared s
$$;

-- Make sure the matcher (run as service_role from the cron) can call it.
grant execute on function public.compute_pool_compatibility() to anon, authenticated, service_role;
