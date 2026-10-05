
-- Meal image cache (shared across users)
CREATE TABLE public.meal_image_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  meal_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meal_image_cache TO anon, authenticated;
GRANT ALL ON public.meal_image_cache TO service_role;
ALTER TABLE public.meal_image_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read meal images" ON public.meal_image_cache FOR SELECT USING (true);
CREATE INDEX idx_meal_image_cache_slug ON public.meal_image_cache(slug);

-- Per-user meal overrides (when user regenerates a meal)
CREATE TABLE public.meal_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  day INTEGER NOT NULL,
  slot TEXT NOT NULL,
  meal JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, day, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_overrides TO authenticated;
GRANT ALL ON public.meal_overrides TO service_role;
ALTER TABLE public.meal_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own meal overrides" ON public.meal_overrides FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own meal overrides" ON public.meal_overrides FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own meal overrides" ON public.meal_overrides FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own meal overrides" ON public.meal_overrides FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- New profile fields
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS staple_seasonings JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cooking_skill TEXT,
  ADD COLUMN IF NOT EXISTS faith_mode_enabled BOOLEAN NOT NULL DEFAULT true;

-- Public storage bucket for food images
INSERT INTO storage.buckets (id, name, public)
VALUES ('food-images', 'food-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Food images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'food-images');
CREATE POLICY "Service role writes food images" ON storage.objects
  FOR INSERT TO service_role WITH CHECK (bucket_id = 'food-images');
