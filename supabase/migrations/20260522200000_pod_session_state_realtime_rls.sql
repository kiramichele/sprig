-- pod_session_state powers the synchronized prompt deck during a call. Clients
-- subscribe to it via Supabase realtime, so it needs:
--   1. an RLS SELECT policy (the subscribing user must be able to read the row)
--   2. membership in the supabase_realtime publication
--
-- Writes go through the service-role key (admin client), which bypasses RLS, so
-- no INSERT/UPDATE policies are needed here.

-- 1. RLS: a pod member can read the session state for their pod's sessions.
alter table public.pod_session_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pod_session_state'
      and policyname = 'pod_session_state_select_members'
  ) then
    create policy "pod_session_state_select_members"
      on public.pod_session_state for select
      to authenticated
      using (
        exists (
          select 1 from public.pod_sessions ps
          where ps.id = pod_session_state.session_id
            and public.is_pod_member(ps.pod_id)
        )
      );
  end if;
end $$;

-- 2. Realtime: add the table to the supabase_realtime publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pod_session_state'
  ) then
    alter publication supabase_realtime add table public.pod_session_state;
  end if;
end $$;
