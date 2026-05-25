-- email_log.recipient_id used to reference public.profiles(id). That blocked
-- logging the welcome email because the profile row doesn't exist yet at
-- email-confirm time (onboarding is what creates the profile).
--
-- An email is sent to an account, not a profile — the auth user is the
-- source-of-truth for "this person exists and has an email." profiles.id
-- equals auth.users.id by convention, so already-logged rows still resolve
-- one-to-one with profiles when there is one.

alter table public.email_log
  drop constraint if exists email_log_recipient_id_fkey;

alter table public.email_log
  add constraint email_log_recipient_id_fkey
    foreign key (recipient_id)
    references auth.users(id)
    on delete cascade;
