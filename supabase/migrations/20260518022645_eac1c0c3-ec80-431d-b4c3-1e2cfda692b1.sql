
-- Achievements catalog
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  rarity text NOT NULL DEFAULT 'bronze',
  xp integer NOT NULL DEFAULT 10,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  icon text,
  hidden boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements read all auth" ON public.achievements FOR SELECT TO authenticated USING (true);

-- User achievements
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, achievement_key)
);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ua self all" ON public.user_achievements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ua_user_idx ON public.user_achievements (user_id, unlocked_at DESC);

-- Nutrition foods
CREATE TABLE public.nutrition_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  kcal_per_100g integer NOT NULL,
  protein_g numeric NOT NULL,
  carbs_g numeric NOT NULL,
  fat_g numeric NOT NULL,
  fiber_g numeric NOT NULL DEFAULT 0,
  why_it_matters text NOT NULL,
  best_use text NOT NULL,
  swaps text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrition_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "foods read all auth" ON public.nutrition_foods FOR SELECT TO authenticated USING (true);

-- Nutrition lessons
CREATE TABLE public.nutrition_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL,
  body text NOT NULL,
  read_minutes integer NOT NULL DEFAULT 2,
  category text NOT NULL DEFAULT 'general',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrition_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons read all auth nutr" ON public.nutrition_lessons FOR SELECT TO authenticated USING (true);

-- Food bookmarks
CREATE TABLE public.user_food_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, food_id)
);
ALTER TABLE public.user_food_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookmarks self all" ON public.user_food_bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Seed achievements
INSERT INTO public.achievements (key, title, description, category, rarity, xp, criteria, icon, hidden, sort_order) VALUES
-- Streaks
('streak_3', 'Momentum', 'Hit a 3-day perfect streak.', 'streak', 'bronze', 10, '{"type":"combined_streak","threshold":3}', 'flame', false, 10),
('streak_7', 'Perfect Week', '7 days. Training + nutrition + mindset.', 'streak', 'silver', 25, '{"type":"combined_streak","threshold":7}', 'flame', false, 20),
('streak_14', 'Locked In', '14-day perfect streak. The chain holds.', 'streak', 'silver', 40, '{"type":"combined_streak","threshold":14}', 'flame', false, 30),
('streak_30', 'Different Man', '30 perfect days. You did not flinch.', 'streak', 'gold', 100, '{"type":"combined_streak","threshold":30}', 'flame', false, 40),
('streak_60', 'Unstoppable', '60 days of consistent execution.', 'streak', 'gold', 200, '{"type":"combined_streak","threshold":60}', 'flame', false, 50),
('streak_100', 'Legend', '100 perfect days. Few will ever do this.', 'streak', 'platinum', 500, '{"type":"combined_streak","threshold":100}', 'crown', false, 60),
('mindset_streak_7', 'Mental Reps', '7 days of mindset work.', 'streak', 'bronze', 15, '{"type":"mindset_streak","threshold":7}', 'brain', false, 70),
('mindset_streak_30', 'Sharp Mind', '30 days of mindset work.', 'streak', 'gold', 100, '{"type":"mindset_streak","threshold":30}', 'brain', false, 80),
('checkin_streak_7', 'Self-Aware', 'Checked in 7 days straight.', 'streak', 'bronze', 15, '{"type":"checkin_streak","threshold":7}', 'heart', false, 90),
-- Commitment
('workouts_10', 'First Ten', 'Logged 10 workouts.', 'commitment', 'bronze', 10, '{"type":"workout_count","threshold":10}', 'dumbbell', false, 100),
('workouts_50', 'Half-Century', '50 workouts in the bank.', 'commitment', 'silver', 50, '{"type":"workout_count","threshold":50}', 'dumbbell', false, 110),
('workouts_100', 'Centurion', '100 workouts logged.', 'commitment', 'gold', 150, '{"type":"workout_count","threshold":100}', 'dumbbell', false, 120),
('workouts_250', 'Built', '250 workouts. Different physiology.', 'commitment', 'platinum', 400, '{"type":"workout_count","threshold":250}', 'dumbbell', false, 130),
('meals_100', 'Fed', 'Logged 100 meals.', 'commitment', 'bronze', 15, '{"type":"meal_count","threshold":100}', 'utensils', false, 140),
('meals_500', 'Dialed In', '500 meals tracked.', 'commitment', 'gold', 150, '{"type":"meal_count","threshold":500}', 'utensils', false, 150),
('mindset_25', 'Quiet Strength', '25 mindset reps completed.', 'commitment', 'silver', 40, '{"type":"mindset_count","threshold":25}', 'brain', false, 160),
('mindset_100', 'Master of Self', '100 mindset reps.', 'commitment', 'gold', 150, '{"type":"mindset_count","threshold":100}', 'brain', false, 170),
('weekly_1', 'Honest Mirror', 'First weekly check-in submitted.', 'commitment', 'bronze', 10, '{"type":"weekly_count","threshold":1}', 'camera', false, 180),
('weekly_12', 'Quarterly Audit', '12 weekly check-ins. Full picture.', 'commitment', 'gold', 120, '{"type":"weekly_count","threshold":12}', 'camera', false, 190),
-- Milestones
('macro_hit_1', 'Bullseye', 'Hit calories + protein on the same day.', 'milestone', 'bronze', 15, '{"type":"macro_perfect","threshold":1}', 'target', false, 200),
('macro_hit_30', 'Surgical', '30 days of hitting macros perfectly.', 'milestone', 'gold', 150, '{"type":"macro_perfect","threshold":30}', 'target', false, 210),
('weight_50', 'Halfway Home', '50% of the way to your goal weight.', 'milestone', 'silver', 60, '{"type":"weight_progress","threshold":50}', 'gauge', false, 220),
('weight_100', 'Mission Accomplished', 'Hit your goal weight.', 'milestone', 'platinum', 300, '{"type":"weight_progress","threshold":100}', 'trophy', false, 230),
-- Hidden
('night_owl', 'Night Owl', 'Logged a meal after 10pm. We see you.', 'hidden', 'bronze', 10, '{"type":"meal_late"}', 'moon', true, 300),
('early_bird', 'Early Bird', 'Checked in before 6am.', 'hidden', 'bronze', 10, '{"type":"checkin_early"}', 'sunrise', true, 310),
('comeback', 'Comeback', 'Showed up after a 3+ day gap. Welcome back.', 'hidden', 'silver', 30, '{"type":"comeback"}', 'rotate', true, 320);

-- Seed foods
INSERT INTO public.nutrition_foods (slug, name, category, kcal_per_100g, protein_g, carbs_g, fat_g, fiber_g, why_it_matters, best_use, swaps, tags) VALUES
('chicken-breast', 'Chicken Breast', 'protein', 165, 31, 0, 3.6, 0, 'The default high-protein, low-fat option. Cheap per gram of protein, easy to batch cook, and neutral enough to season a hundred ways.', 'Cut, recovery, meal prep.', 'Turkey breast, white fish.', ARRAY['high-protein','cut','lean']),
('ground-beef-93', 'Ground Beef (93/7)', 'protein', 152, 21, 0, 7, 0, 'Heme iron, B12, creatine, and zinc — things most cuts miss. Lean enough to fit a cut, rich enough to taste like food.', 'Most goals. Pre or post training.', 'Ground turkey 93/7, bison.', ARRAY['high-protein','iron']),
('eggs', 'Whole Eggs', 'protein', 155, 13, 1.1, 11, 0, 'Most complete protein you can buy. Yolk has choline, vitamin D, and the fat-soluble vitamins. Don''t throw them out.', 'Breakfast, snacks.', 'Egg whites (lower fat), Greek yogurt.', ARRAY['breakfast','complete-protein']),
('greek-yogurt', 'Greek Yogurt (0%)', 'protein', 59, 10, 3.6, 0.4, 0, '~2x the protein of regular yogurt and live cultures for gut health. Excellent late-night option.', 'Snack, breakfast, casein hit before bed.', 'Cottage cheese, skyr.', ARRAY['high-protein','snack','gut']),
('cottage-cheese', 'Cottage Cheese (low-fat)', 'protein', 84, 11, 3.4, 2.3, 0, 'Slow-digesting casein. Great pre-bed if you''re serious about recovery.', 'Pre-bed, snack.', 'Greek yogurt, ricotta.', ARRAY['high-protein','casein']),
('salmon', 'Salmon (Atlantic)', 'protein', 208, 20, 0, 13, 0, 'Omega-3s lower inflammation, improve insulin sensitivity, and protect long-term cardiovascular health. Eat it 2x/week minimum.', 'Recovery days, dinners.', 'Sardines, mackerel.', ARRAY['omega-3','high-protein','anti-inflammatory']),
('tuna-canned', 'Tuna (canned in water)', 'protein', 116, 26, 0, 1, 0, 'Highest protein-to-calorie ratio of any common food. Cheap, shelf-stable, ready in seconds.', 'Cut, on-the-go.', 'Canned salmon, chicken.', ARRAY['high-protein','cut','convenient']),
('whey-protein', 'Whey Protein (1 scoop, ~30g)', 'protein', 120, 24, 3, 1, 0, 'Fast-absorbing protein. Use to fill gaps, not replace meals. Around 25g post-training is plenty.', 'Post-workout, between meals.', 'Casein, plant blend.', ARRAY['supplement','post-workout']),
('oats', 'Rolled Oats (dry)', 'carb', 389, 17, 66, 7, 11, 'Beta-glucan fiber for cholesterol and satiety, steady-release carbs. Best breakfast carb if you train later.', 'Pre-training, breakfast.', 'Quinoa, sweet potato.', ARRAY['fiber','complex-carb','heart']),
('white-rice', 'White Rice (cooked)', 'carb', 130, 2.7, 28, 0.3, 0.4, 'Easy to digest, restores muscle glycogen fast, doesn''t fight you in the gym. Underrated.', 'Around training, large appetites.', 'Jasmine rice, potatoes.', ARRAY['carb','recovery','easy-digest']),
('sweet-potato', 'Sweet Potato', 'carb', 86, 1.6, 20, 0.1, 3, 'Beta-carotene, potassium, fiber. Lower glycemic load than white potato — good for non-training meals.', 'Recovery, off-day meals.', 'Butternut squash, white potato.', ARRAY['fiber','vitamin-a']),
('quinoa', 'Quinoa (cooked)', 'carb', 120, 4.4, 21, 1.9, 2.8, 'Complete plant protein, more fiber than rice. Useful if you want a single base that does both jobs.', 'Bowls, salads.', 'Brown rice, farro.', ARRAY['complete-protein','fiber']),
('avocado', 'Avocado', 'fat', 160, 2, 9, 15, 7, 'Monounsaturated fat (good for hormones and HDL), potassium higher than a banana, lots of fiber.', 'Add to any meal needing fat.', 'Olive oil, nuts.', ARRAY['healthy-fat','potassium','fiber']),
('olive-oil', 'Extra Virgin Olive Oil', 'fat', 884, 0, 0, 100, 0, 'Mediterranean-diet staple. Polyphenols reduce inflammation. Use as your default cooking + finishing oil.', 'Cooking, dressing.', 'Avocado oil.', ARRAY['healthy-fat','anti-inflammatory']),
('almonds', 'Almonds', 'fat', 579, 21, 22, 50, 12, 'Vitamin E, magnesium, satiating fats. Easy to overeat — stick to a measured 28g portion.', 'Snack.', 'Walnuts, pistachios.', ARRAY['healthy-fat','satiating','snack']),
('broccoli', 'Broccoli', 'veg', 34, 2.8, 7, 0.4, 2.6, 'Sulforaphane (cancer protection), vitamin C, K, fiber. Crunchy, filling, almost free calorically.', 'Every meal you can.', 'Cauliflower, brussels sprouts.', ARRAY['fiber','vitamin','low-cal']),
('spinach', 'Spinach', 'veg', 23, 2.9, 3.6, 0.4, 2.2, 'Iron, folate, nitrates that improve blood flow and training output. Cooks down to almost nothing.', 'Smoothies, side, omelets.', 'Kale, arugula.', ARRAY['iron','nitrates','low-cal']),
('berries-mixed', 'Mixed Berries', 'fruit', 57, 1, 14, 0.3, 2.4, 'Highest antioxidant density of any fruit. Low sugar, brain-protective, easy to add to oats or yogurt.', 'Breakfast, dessert.', 'Cherries, pomegranate.', ARRAY['antioxidant','low-gi','brain']),
('banana', 'Banana', 'fruit', 89, 1.1, 23, 0.3, 2.6, 'Potassium, fast carbs, fits in a pocket. Great pre or post-training without sitting heavy.', 'Pre/post-training.', 'Dates, apple.', ARRAY['carb','potassium','convenient']),
('dark-chocolate', 'Dark Chocolate (85%)', 'treat', 540, 8, 30, 43, 12, 'Flavonoids for blood vessel health, magnesium, real satisfaction in small doses. 1-2 squares is the move.', 'Evening, post-dinner.', 'Cocoa nibs.', ARRAY['flavonoid','treat']);

-- Seed lessons
INSERT INTO public.nutrition_lessons (slug, title, summary, body, read_minutes, category, sort_order) VALUES
('protein-timing', 'Does protein timing actually matter?', 'Spoiler: total daily intake matters more than the 30-minute window.', 'The "anabolic window" was overstated. What matters is hitting your total daily protein target (about 1.6-2.2g per kg of bodyweight if you train hard) and spreading it across 3-5 meals of 25-50g each.

Why spread it? Muscle protein synthesis maxes out at roughly 0.4g per kg of bodyweight per meal. Anything beyond that gets oxidized or stored. Four 35g hits do more than one 140g hit.

Post-training, the window is several hours wide, not 30 minutes. If you trained fasted, eating sooner makes sense. If you ate within 2-3 hours of training, you have all the runway you need.

Practical: anchor protein at every meal. Don''t stress the clock.', 3, 'protein', 10),
('fiber-101', 'What fiber actually does', 'It''s not just for digestion — fiber controls hunger, blood sugar, and cholesterol.', 'Fiber is the part of plants your body can''t digest, and that''s the whole point. There are two kinds and they do different jobs.

Soluble fiber (oats, beans, apples, psyllium) absorbs water and turns gel-like. It slows digestion, blunts blood sugar spikes, and feeds the bacteria in your gut that produce short-chain fatty acids — these reduce inflammation systemwide.

Insoluble fiber (vegetables, whole grains, nuts) adds bulk and keeps things moving. Less glamorous, equally important.

Target: 30-40g a day. Most adults eat 12-15g. The gap is one of the biggest hidden levers in your diet. Add a serving of vegetables to every meal and you''re most of the way there.', 3, 'fiber', 20),
('calories-not-equal', 'Why calories aren''t all equal', 'A calorie is a calorie thermodynamically. But the food it''s in changes everything else.', 'Yes, energy balance is the master switch for weight change. No, 200 calories of chicken and 200 calories of soda are not interchangeable.

Three reasons they differ:

1. Thermic effect. Protein costs ~25% of its calories to digest. Carbs cost 5-10%. Fat costs 0-3%. A high-protein meal burns more just sitting in your stomach.

2. Satiety. Whole foods rich in protein and fiber keep you full for hours. Liquid calories and refined carbs leave you hungry within an hour, making total intake creep up.

3. Body composition. In a calorie surplus, protein partitions toward muscle. Excess carbs and fat partition toward fat. Same calories, different bodies.

Hit your calorie target with mostly whole, protein-anchored food. The math takes care of itself.', 3, 'fundamentals', 30),
('reading-labels', 'How to read a nutrition label in 10 seconds', 'You don''t need to read the whole thing. Three numbers matter.', 'Skip the marketing on the front. Flip it over and look at three things in this order:

1. Serving size. Everything else on the label is per serving, and the serving listed is almost always smaller than what you''ll actually eat. A "100-calorie" bag of chips is often 2.5 servings.

2. Protein per serving. Anything above 10g per 100 calories is a real protein source. Anything below 5g is not, no matter what the front of the box says.

3. Fiber and added sugar. High fiber, low added sugar = real food. Low fiber, high added sugar = engineered to make you eat more of it.

Ingredients list is the tiebreaker. If it''s long, contains words you don''t recognize, or lists sugar in the first three slots, put it back.', 2, 'fundamentals', 40),
('alcohol-recovery', 'Alcohol and recovery: the honest math', 'You can drink and still progress. But know the cost.', 'Alcohol isn''t a moral issue, it''s a physiology issue. Here''s what it actually does:

- Suppresses muscle protein synthesis by ~24% for up to 24 hours after a heavy session (4+ drinks).
- Disrupts deep sleep and REM, which is when recovery actually happens. Even 1-2 drinks shortens deep sleep.
- Adds 7 calories per gram with no satiety, on top of whatever you''re eating with it.
- Dehydrates you, which tanks training output the next day.

What works in practice: keep it to 1-2 drinks, ideally not within 3 hours of bed, and not on training days if you can help it. Hydrate before, during, after. Don''t use it as your reward for training — the two don''t mix well.', 3, 'recovery', 50),
('hydration-math', 'How much water you actually need', 'The 8 glasses a day rule is invented. Here''s the real target.', 'Your real target is roughly 30-40 ml per kg of bodyweight per day, more if you''re training hard or it''s hot. For an 80 kg person training 4x/week, that''s about 3 liters.

Signs you''re underhydrated: dark urine (should be pale yellow), headaches, low training output, "false hunger" between meals.

Practical:
- 500 ml when you wake up. You''re always dehydrated overnight.
- 500-1000 ml around training.
- A glass with every meal.
- Caffeine and alcohol don''t count negative, but they don''t replace water either.

Electrolytes matter when you sweat a lot. A pinch of salt and a squeeze of lemon in water beats most expensive sports drinks.', 2, 'fundamentals', 60);
