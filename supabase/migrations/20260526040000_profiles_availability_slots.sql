-- Per-user availability picker: which weekday × time-of-day windows they're
-- usually free. Used by the matcher to schedule the first pod session at a
-- time the whole group can actually make.
--
-- Tokens shape: '<day>_<window>'
--   day:    mon | tue | wed | thu | fri | sat | sun
--   window: morning (9am-12pm) | afternoon (12pm-5pm) | evening (5pm-10pm)
-- Each window in the user's local timezone (profiles.timezone).
--
-- Stored as TEXT[] for cheap intersection queries. Validated with a check
-- constraint so junk values can't slip in.

alter table public.profiles
  add column if not exists availability_slots text[] not null default array[]::text[];

-- Allow only the 21 known tokens. The regex matches '<day>_<window>'.
alter table public.profiles
  drop constraint if exists profiles_availability_slots_valid;

alter table public.profiles
  add constraint profiles_availability_slots_valid check (
    availability_slots <@ array[
      'mon_morning','mon_afternoon','mon_evening',
      'tue_morning','tue_afternoon','tue_evening',
      'wed_morning','wed_afternoon','wed_evening',
      'thu_morning','thu_afternoon','thu_evening',
      'fri_morning','fri_afternoon','fri_evening',
      'sat_morning','sat_afternoon','sat_evening',
      'sun_morning','sun_afternoon','sun_evening'
    ]::text[]
  );

comment on column public.profiles.availability_slots is
  'Day-of-week × time-of-day buckets the user is usually free. The matcher
   intersects these across pod members to pick the first session time.
   Each window resolves to a canonical hour: morning=10am, afternoon=2pm,
   evening=7pm, in the user''s local timezone (profiles.timezone).';
