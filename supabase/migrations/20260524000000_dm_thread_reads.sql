-- Per-user, per-thread "I've read up to this point" markers. Drives the
-- unread-DM badge in the top nav: a thread is unread for me when there exists
-- a message from someone else with created_at > my last_read_at for that thread
-- (or no row exists yet).

create table if not exists public.dm_thread_reads (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (profile_id, thread_id)
);

alter table public.dm_thread_reads enable row level security;

-- RLS: a user can only see and write their own read markers
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dm_thread_reads'
      and policyname = 'dm_thread_reads_select_own'
  ) then
    create policy "dm_thread_reads_select_own"
      on public.dm_thread_reads for select
      to authenticated
      using (profile_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dm_thread_reads'
      and policyname = 'dm_thread_reads_insert_own'
  ) then
    create policy "dm_thread_reads_insert_own"
      on public.dm_thread_reads for insert
      to authenticated
      with check (profile_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dm_thread_reads'
      and policyname = 'dm_thread_reads_update_own'
  ) then
    create policy "dm_thread_reads_update_own"
      on public.dm_thread_reads for update
      to authenticated
      using (profile_id = (select auth.uid()))
      with check (profile_id = (select auth.uid()));
  end if;
end $$;
