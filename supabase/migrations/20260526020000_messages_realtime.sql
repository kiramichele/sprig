-- Add the `messages` table to the supabase_realtime publication so the
-- DM and pod chat components actually receive INSERT events. Without this,
-- their .channel(...).on('postgres_changes', ...) subscriptions stay silent
-- and the chat only updates on a manual refresh.
--
-- Mirrors the same wiring we did for pod_session_state.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- REPLICA IDENTITY FULL means UPDATE and DELETE events include the previous
-- row data — handy if we ever soft-delete messages and want subscribers to
-- see the body that was hidden. Cheap for a small table like messages.
alter table public.messages replica identity full;
