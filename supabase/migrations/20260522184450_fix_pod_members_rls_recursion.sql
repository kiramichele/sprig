-- Fix: infinite recursion in pod_members RLS policy (Postgres error 42P17).
--
-- A SELECT policy on pod_members queried pod_members itself, so every read of
-- the table re-triggered the policy forever. Postgres aborts such queries with
-- a 500. Anything that touches pod_members -- the home page pod list, the
-- pods query, the user_current_status view -- failed silently as a result.
--
-- The fix uses a SECURITY DEFINER helper function. SECURITY DEFINER functions
-- run as their owner (postgres, which bypasses RLS), so the membership lookup
-- inside the policy no longer re-enters the policy.

-- 1. Membership-check helper that does NOT trigger RLS.
create or replace function public.is_pod_member(p_pod_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.pod_members
    where pod_members.pod_id = p_pod_id
      and pod_members.profile_id = (select auth.uid())
      and pod_members.left_at is null
  );
$$;

-- 2. Drop every existing policy on pod_members -- the names are unknown and one
--    of them recurses. Write access to pod_members is intentionally not
--    recreated: pod membership is managed server-side (the matching job), not
--    written from the client.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'pod_members'
  loop
    execute format('drop policy %I on public.pod_members', pol.policyname);
  end loop;
end $$;

-- 3. Recreate non-recursive read policies.
alter table public.pod_members enable row level security;

-- You can always see your own membership rows.
create policy "pod_members_select_own"
  on public.pod_members for select
  to authenticated
  using (profile_id = (select auth.uid()));

-- You can see fellow members of pods you belong to. The check goes through the
-- SECURITY DEFINER helper, so it does not recurse.
create policy "pod_members_select_comembers"
  on public.pod_members for select
  to authenticated
  using (public.is_pod_member(pod_id));

-- 4. Make sure members can read their pods and sessions. These are additive
--    SELECT policies (multiple SELECT policies are OR-ed together), so they
--    only ever grant access -- they never remove an existing policy.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pods'
      and policyname = 'pods_select_members'
  ) then
    create policy "pods_select_members"
      on public.pods for select
      to authenticated
      using (public.is_pod_member(id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pod_sessions'
      and policyname = 'pod_sessions_select_members'
  ) then
    create policy "pod_sessions_select_members"
      on public.pod_sessions for select
      to authenticated
      using (public.is_pod_member(pod_id));
  end if;
end $$;
