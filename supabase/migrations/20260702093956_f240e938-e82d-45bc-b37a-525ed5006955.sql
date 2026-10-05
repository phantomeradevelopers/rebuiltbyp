
-- Morning delivery mode: 'spaced' (default, 3 slots) or 'briefing' (morning only)
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS morning_delivery text
    NOT NULL DEFAULT 'spaced'
    CHECK (morning_delivery IN ('spaced','briefing'));

-- Curated motivational quotes (Playboy P voice: steady, plain, no bro-talk).
INSERT INTO public.daily_affirmations (content, category) VALUES
  ('You don''t need motivation today. You need one small action. Start there.', 'curated'),
  ('The version of you that quits is loud. The one that keeps going is quiet. Be quiet today.', 'curated'),
  ('Every rep, every meal, every prayer — it''s a vote for who you''re becoming.', 'curated'),
  ('You survived worse than today already. Do the next right thing.', 'curated'),
  ('Discipline is remembering what you actually want.', 'curated'),
  ('The comeback is built in the boring days. This is one of them. Show up anyway.', 'curated'),
  ('Grace doesn''t erase the work. It gives you the strength to do it.', 'curated'),
  ('You are not behind. You are exactly where the work meets you.', 'curated'),
  ('Small hinges swing big doors. One clean meal. One honest check-in. Enough.', 'curated'),
  ('The body follows the promise you keep to it today.', 'curated'),
  ('Nobody is coming. That''s the good news — it means you get the credit.', 'curated'),
  ('Rest is a rep. Recover on purpose, not by accident.', 'curated'),
  ('Faith without effort is a wish. Effort without faith is a grind. You need both.', 'curated'),
  ('The mirror doesn''t lie, but it also doesn''t vote. Your habits do.', 'curated'),
  ('You are one honest day away from momentum. Give today that shot.', 'curated')
ON CONFLICT DO NOTHING;
