
-- ============ meals library ============
CREATE TABLE public.meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL CHECK (slot IN ('breakfast','lunch','dinner','snack')),
  type text NOT NULL CHECK (type IN ('standard','fast_food')),
  brand text,
  title text NOT NULL,
  kcal int NOT NULL DEFAULT 0,
  protein_g int NOT NULL DEFAULT 0,
  carbs_g int NOT NULL DEFAULT 0,
  fat_g int NOT NULL DEFAULT 0,
  prep_minutes int NOT NULL DEFAULT 0,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  dietary_tags text[] NOT NULL DEFAULT '{}',
  image_path text,
  active boolean NOT NULL DEFAULT false,
  seed_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meals TO authenticated;
GRANT ALL ON public.meals TO service_role;

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read active meals"
  ON public.meals FOR SELECT
  TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write meals"
  ON public.meals FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_meals_slot_active ON public.meals (slot, type, active);

CREATE TRIGGER trg_meals_touch_updated
  BEFORE UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ food_log additive columns ============
ALTER TABLE public.food_log
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'meal_done'
    CHECK (source IN ('meal_done','photo_estimate','fast_food')),
  ADD COLUMN IF NOT EXISTS meal_id uuid REFERENCES public.meals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_food_log_meal ON public.food_log (meal_id);

-- ============ storage policies for meal-images bucket ============
-- Bucket is created via the storage tool; these policies gate access.
CREATE POLICY "meal-images authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'meal-images');

CREATE POLICY "meal-images admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'meal-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "meal-images admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'meal-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "meal-images admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'meal-images' AND public.has_role(auth.uid(), 'admin'));
