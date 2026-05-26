-- Two additions to the catalog:
--   1. A new 'sports' category with the most common team + individual sports.
--      Distinct from 'movement' (which is wellness/fitness-flavored).
--   2. A starter set of themed prompt_cards keyed on interest_id, so a pod
--      formed around a particular interest gets prompts that lean into it.
--      The advance route prefers interest-matching cards when available and
--      falls back to the existing interest-agnostic cards otherwise.
--
-- All inserts are idempotent via ON CONFLICT DO NOTHING / NOT EXISTS guards
-- so re-running the migration is safe.

-- 1) sports interests --------------------------------------------------------

insert into public.interests (name, emoji, category, is_active)
values
  ('Basketball',         '🏀', 'sports', true),
  ('Soccer',             '⚽', 'sports', true),
  ('Football',           '🏈', 'sports', true),
  ('Baseball',           '⚾', 'sports', true),
  ('Tennis',             '🎾', 'sports', true),
  ('Golf',               '⛳', 'sports', true),
  ('Hockey',             '🏒', 'sports', true),
  ('Volleyball',         '🏐', 'sports', true),
  ('Martial Arts & Boxing', '🥊', 'sports', true),
  ('Climbing',           '🧗', 'sports', true),
  ('Swimming',           '🏊', 'sports', true),
  ('Cycling',            '🚴', 'sports', true),
  ('Skating',            '🛹', 'sports', true),
  ('Watching Sports',    '📺', 'sports', true)
on conflict (name) do nothing;

-- 2) themed prompt cards -----------------------------------------------------
--
-- One small set per interest, distributed across rounds. Mostly warmup +
-- know-you cards so the conversational arc still feels balanced. Generic
-- cards still load — these just bubble to the top when the pod's primary
-- interest matches.
--
-- Uses with-CTEs to resolve round_id and interest_id without hard-coded
-- UUIDs (which would break in any other environment). The NOT EXISTS guard
-- on the final insert keeps this idempotent.

with rounds as (
  select id, slug from public.prompt_rounds
),
ints as (
  select id, name from public.interests
),
new_cards (round_slug, interest_name, body) as (
  values
  -- Reading & Book Talk
  ('warmup',     'Reading & Book Talk', 'what''s a book you''ve recommended more than once?'),
  ('know-you',   'Reading & Book Talk', 'a book that genuinely changed something about how you think?'),
  ('playful',    'Reading & Book Talk', 'if a movie of your favorite book got made tomorrow, who plays the lead?'),
  ('reflection', 'Reading & Book Talk', 'a book you keep meaning to finish but haven''t — what''s holding you back?'),

  -- Cooking
  ('warmup',     'Cooking',             'what did you cook (or order) for dinner last night?'),
  ('know-you',   'Cooking',             'what dish do you make when you want to impress someone?'),
  ('playful',    'Cooking',             'if you had to eat one cuisine for the next month, which one?'),
  ('reflection', 'Cooking',             'what''s a kitchen mistake you keep making, even though you know better?'),

  -- Hiking
  ('warmup',     'Hiking',              'a trail or park you''ve been to more than three times — what keeps you going back?'),
  ('know-you',   'Hiking',              'what''s the longest hike (or walk) you''ve ever done?'),
  ('playful',    'Hiking',              'one item you''d add to a friend''s pack if they were going hiking for the first time?'),

  -- Movies & TV
  ('warmup',     'Movies & TV',         'what''s the last thing you watched that you couldn''t stop thinking about?'),
  ('know-you',   'Movies & TV',         'a show you''d rewatch start-to-finish without skipping anything?'),
  ('playful',    'Movies & TV',         'pick a movie character you''d trust with a secret. why them?'),

  -- Coffee & Cafés
  ('warmup',     'Coffee & Cafés',      'order at your usual café — what is it?'),
  ('know-you',   'Coffee & Cafés',      'a café that feels like home — what makes it that way?'),
  ('playful',    'Coffee & Cafés',      'if you opened a café, what would you put on the menu that you wouldn''t see anywhere else?'),

  -- Photography
  ('warmup',     'Photography',         'a photo on your phone you''re weirdly proud of?'),
  ('know-you',   'Photography',         'what kind of moments do you most love capturing?'),

  -- Ceramics & Pottery
  ('warmup',     'Ceramics & Pottery',  'a piece you''ve made (or seen) that made you go "oh"?'),
  ('know-you',   'Ceramics & Pottery',  'centering on the wheel — what does it feel like for you when it clicks?'),

  -- Gardening
  ('warmup',     'Gardening',           'what''s growing (or trying to grow) in your space right now?'),
  ('know-you',   'Gardening',           'a plant you''ve killed more than once — and one you can''t stop loving anyway?'),

  -- Board Games
  ('warmup',     'Board Games',         'a game you''d pull out for a chill night with friends?'),
  ('playful',    'Board Games',         'who in your life is the most competitive at games — and is it a good thing?'),

  -- Video Games
  ('warmup',     'Video Games',         'what''s the last game that pulled you in?'),
  ('playful',    'Video Games',         'a game you''d pick to play co-op with this pod?'),

  -- Watching Sports
  ('warmup',     'Watching Sports',     'what team (or athlete) do you actually root for?'),
  ('know-you',   'Watching Sports',     'a sports moment that''s stuck with you — what was happening?'),
  ('playful',    'Watching Sports',     'best snack to have on hand for the big game?'),

  -- Basketball
  ('warmup',     'Basketball',          'do you play, watch, or both? and how often?'),
  ('know-you',   'Basketball',          'first game you remember being really into — what was the story?'),
  ('playful',    'Basketball',          'pickup game tomorrow — what position are you playing?'),

  -- Soccer
  ('warmup',     'Soccer',              'do you have a team or a player you follow closely?'),
  ('playful',    'Soccer',              'pickup game with this pod — who''s in goal?'),

  -- Running
  ('warmup',     'Running',             'what kind of runner are you — morning, evening, or "whenever I can"?'),
  ('know-you',   'Running',             'a route you love. what makes it the one?'),
  ('reflection', 'Running',             'a run that didn''t go to plan — what did you take away from it?'),

  -- Yoga
  ('warmup',     'Yoga',                'how did you find your way into yoga?'),
  ('know-you',   'Yoga',                'a pose (or kind of practice) that''s changed for you over time?'),

  -- Creative Writing
  ('warmup',     'Creative Writing',    'what are you working on lately — or wishing you were?'),
  ('know-you',   'Creative Writing',    'a writer (any medium) you keep returning to. why?'),

  -- Animals & Pets
  ('warmup',     'Animals & Pets',      'who lives with you — pet count, names, and one quirk each?'),
  ('know-you',   'Animals & Pets',      'first pet you ever had — what do you remember?'),
  ('playful',    'Animals & Pets',      'if your pet (or a fantasy one) could text, what would their first message be?')
)
insert into public.prompt_cards (round_id, interest_id, body, is_active)
select r.id, i.id, nc.body, true
from new_cards nc
join rounds r on r.slug = nc.round_slug
join ints i on i.name = nc.interest_name
where not exists (
  select 1 from public.prompt_cards existing
  where existing.round_id = r.id
    and existing.interest_id = i.id
    and existing.body = nc.body
);
