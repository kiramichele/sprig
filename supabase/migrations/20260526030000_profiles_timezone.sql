-- Per-user timezone preference, used to format times in transactional emails
-- (pod_matched, session reminders, etc.) so a PST user doesn't get an EST
-- timestamp they have to mentally convert.
--
-- Nullable on purpose — auto-populated by the client the first time a user
-- visits any authenticated page, and editable in settings. Server-side
-- consumers should fall back to 'America/New_York' if null.

alter table public.profiles add column if not exists timezone text;

comment on column public.profiles.timezone is
  'IANA timezone identifier (e.g. America/Los_Angeles). Auto-detected from the
   browser on first authenticated visit; user-editable in settings. Null means
   use the system default (America/New_York).';
