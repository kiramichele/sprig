-- user_current_status feeds the home page's "do I have an upcoming session?"
-- check. Previously next_session_at used `scheduled_for > now()`, which made
-- a session that started 1 minute ago disappear — bad for latecomers, since
-- the join-call window stays open for several minutes after the scheduled
-- start time. Widen the filter to a 15-minute grace so it matches the join
-- logic and the page-level filters that were just relaxed.

create or replace view user_current_status as
select
  p.id as profile_id,
  (
    select count(*)
    from pod_members pm
    join pods pd on pd.id = pm.pod_id
    where pm.profile_id = p.id
      and pm.left_at is null
      and pd.status in ('forming', 'scheduled', 'active', 'continuing')
  ) as active_pod_count,
  (
    select count(*)
    from matching_availability ma
    where ma.profile_id = p.id
      and ma.status = 'open'
      and ma.available_until > now()
  ) as open_availability_count,
  (
    select min(ps.scheduled_for)
    from pod_sessions ps
    join pod_members pm on pm.pod_id = ps.pod_id
    where pm.profile_id = p.id
      and pm.left_at is null
      and ps.status = 'scheduled'
      and ps.scheduled_for > now() - interval '15 minutes'
  ) as next_session_at
from profiles p
where p.deleted_at is null;

alter view user_current_status set (security_invoker = true);
