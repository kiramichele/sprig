-- Fix: compute_pool_compatibility() raised 42702 "column reference profile_id
-- is ambiguous". The pool_styles / pool_sensory CTEs selected `p.profile_id,
-- fs.*` (and `sp.*`) — and friendship_styles / sensory_preferences each also
-- have a profile_id column, so the CTE ended up with two columns named
-- profile_id. Listing explicit columns (without the joined table's profile_id)
-- removes the duplicate.

create or replace function compute_pool_compatibility()
returns table (
  user_a uuid,
  user_b uuid,
  score numeric,
  shared_interests text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with pool as (
    select
      ma.profile_id,
      ma.preferred_interests,
      ma.preferred_pod_size,
      ma.id as availability_id
    from matching_availability ma
    where ma.status = 'open'
      and ma.available_until > now()
  ),
  pool_interests as (
    select
      p.profile_id,
      pi.interest_id,
      pi.intensity,
      i.name as interest_name
    from pool p
    join profile_interests pi on pi.profile_id = p.profile_id
    join interests i on i.id = pi.interest_id
    where
      cardinality(coalesce(p.preferred_interests, '{}'::uuid[])) = 0
      or pi.interest_id = any(p.preferred_interests)
  ),
  pool_styles as (
    -- FIX: explicit columns instead of fs.* to avoid duplicating profile_id
    select
      p.profile_id,
      fs.energy_level,
      fs.communication_pref,
      fs.hangout_frequency,
      fs.seeking
    from pool p
    left join friendship_styles fs on fs.profile_id = p.profile_id
  ),
  pool_sensory as (
    -- FIX: same — explicit columns instead of sp.*
    select
      p.profile_id,
      sp.hide_alcohol_present,
      sp.hide_alcohol_centered,
      sp.prefers_quiet,
      sp.needs_low_mobility,
      sp.prefers_smaller_groups,
      sp.prefers_video_off_ok
    from pool p
    left join sensory_preferences sp on sp.profile_id = p.profile_id
  ),
  pairs as (
    select
      a.profile_id as ua,
      b.profile_id as ub
    from pool a
    cross join pool b
    where a.profile_id < b.profile_id
      and not exists (
        select 1 from user_blocks ub_check
        where (ub_check.blocker_id = a.profile_id and ub_check.blocked_id = b.profile_id)
           or (ub_check.blocker_id = b.profile_id and ub_check.blocked_id = a.profile_id)
      )
      and not exists (
        select 1
        from pod_members pm1
        join pod_members pm2 on pm1.pod_id = pm2.pod_id
        join pods pd on pd.id = pm1.pod_id
        where pm1.profile_id = a.profile_id
          and pm2.profile_id = b.profile_id
          and pd.status = 'dissolved'
          and pd.dissolved_at > now() - interval '90 days'
      )
  ),
  pair_interest_scores as (
    select
      p.ua, p.ub,
      coalesce(
        least(
          40,
          sum(8 - (abs(a_int.intensity - b_int.intensity) * 2))
        ),
        0
      ) as interest_score,
      coalesce(
        array_agg(distinct a_int.interest_name)
          filter (where a_int.interest_id is not null),
        '{}'::text[]
      ) as shared_names
    from pairs p
    left join pool_interests a_int on a_int.profile_id = p.ua
    left join pool_interests b_int on b_int.profile_id = p.ub
      and b_int.interest_id = a_int.interest_id
    where b_int.interest_id is not null
    group by p.ua, p.ub
  ),
  pair_style_scores as (
    select
      p.ua, p.ub,
      greatest(0,
        30
        - (coalesce(abs(a.energy_level - b.energy_level), 2) * 3)
        - (coalesce(abs(a.communication_pref - b.communication_pref), 2) * 3)
        - case
            when a.hangout_frequency is null or b.hangout_frequency is null then 5
            when abs(
              array_position(array['rarely','occasionally','regularly','frequently'], a.hangout_frequency)
              - array_position(array['rarely','occasionally','regularly','frequently'], b.hangout_frequency)
            ) >= 2 then 10
            else 0
          end
      ) as style_score
    from pairs p
    left join pool_styles a on a.profile_id = p.ua
    left join pool_styles b on b.profile_id = p.ub
  ),
  pair_seeking_scores as (
    select
      p.ua, p.ub,
      case
        when coalesce(array_length(a.seeking, 1), 0) = 0
          or coalesce(array_length(b.seeking, 1), 0) = 0 then 0
        when cardinality(
          (select array_agg(x) from (
            select unnest(a.seeking) intersect select unnest(b.seeking)
          ) t(x))
        ) = 0 then 0
        else (
          20.0 * cardinality(
            (select array_agg(x) from (
              select unnest(a.seeking) intersect select unnest(b.seeking)
            ) t(x))
          ) / cardinality(
            (select array_agg(distinct x) from (
              select unnest(a.seeking) union select unnest(b.seeking)
            ) t(x))
          )
        )
      end as seeking_score
    from pairs p
    left join pool_styles a on a.profile_id = p.ua
    left join pool_styles b on b.profile_id = p.ub
  ),
  pair_sensory_scores as (
    select
      p.ua, p.ub,
      least(10,
        (case when a.hide_alcohol_present = b.hide_alcohol_present then 1.5 else 0 end) +
        (case when a.hide_alcohol_centered = b.hide_alcohol_centered then 1.5 else 0 end) +
        (case when a.prefers_quiet = b.prefers_quiet then 1.5 else 0 end) +
        (case when a.needs_low_mobility = b.needs_low_mobility then 1.5 else 0 end) +
        (case when a.prefers_smaller_groups = b.prefers_smaller_groups then 1.5 else 0 end) +
        (case when a.prefers_video_off_ok = b.prefers_video_off_ok then 1.5 else 0 end)
      ) as sensory_score
    from pairs p
    left join pool_sensory a on a.profile_id = p.ua
    left join pool_sensory b on b.profile_id = p.ub
  )
  select
    p.ua,
    p.ub,
    coalesce(pi.interest_score, 0)
      + coalesce(ps.style_score, 0)
      + coalesce(pse.seeking_score, 0)
      + coalesce(pss.sensory_score, 0) as total_score,
    coalesce(pi.shared_names, '{}'::text[]) as shared_interests
  from pairs p
  left join pair_interest_scores pi on pi.ua = p.ua and pi.ub = p.ub
  left join pair_style_scores ps on ps.ua = p.ua and ps.ub = p.ub
  left join pair_seeking_scores pse on pse.ua = p.ua and pse.ub = p.ub
  left join pair_sensory_scores pss on pss.ua = p.ua and pss.ub = p.ub
  where coalesce(pi.interest_score, 0) > 0
  order by total_score desc;
end;
$$;

grant execute on function compute_pool_compatibility to service_role;
