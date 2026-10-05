-- Add tier gate to achievements and ensure Free starter set exists
ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS min_tier text NOT NULL DEFAULT 'pro'
    CHECK (min_tier IN ('free','pro'));

-- Insert starter trophies if missing (criteria types already understood by the awarding loop)
INSERT INTO public.achievements (key, title, description, category, rarity, xp, criteria, icon, hidden, sort_order, min_tier)
VALUES
  ('first_checkin', 'Day One', 'Logged your first daily check-in.', 'foundation', 'bronze', 10, '{"type":"checkin_count","threshold":1}'::jsonb, 'checkin', false, 1, 'free'),
  ('first_mission', 'First Mission', 'Completed your first daily mission.', 'foundation', 'bronze', 10, '{"type":"workout_count","threshold":1}'::jsonb, 'mission', false, 2, 'free'),
  ('first_plate_snap', 'First Plate', 'Logged your first meal.', 'foundation', 'bronze', 10, '{"type":"meal_count","threshold":1}'::jsonb, 'plate', false, 3, 'free')
ON CONFLICT (key) DO NOTHING;

-- Mark starter trophies as Free-tier
UPDATE public.achievements
   SET min_tier = 'free'
 WHERE key IN ('first_checkin','first_mission','first_plate_snap','streak_3','streak_7','anchor_first');