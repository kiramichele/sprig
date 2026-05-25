-- System messages — posted by cron / server jobs, not by a user.
--   * is_system flags rows that should render as inline notices rather than
--     bubbles in the chat UI.
--   * sender_id becomes nullable so a system message can have no author.
--   * A check constraint keeps the two columns coherent: either a real sender
--     and not system, or no sender and is_system=true.

alter table public.messages
  add column if not exists is_system boolean not null default false;

alter table public.messages
  alter column sender_id drop not null;

-- Drop and re-add the integrity check so re-runs are safe.
alter table public.messages
  drop constraint if exists messages_sender_consistency;

alter table public.messages
  add constraint messages_sender_consistency check (
    (is_system = true and sender_id is null)
    or (is_system = false and sender_id is not null)
  );

-- Tell PostgREST to reload its schema cache so the column is visible
-- immediately without a project restart.
notify pgrst, 'reload schema';
