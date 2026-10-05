ALTER TABLE public.nutrition_suggestions ADD COLUMN IF NOT EXISTS category text;
UPDATE public.nutrition_suggestions SET category = CASE
  WHEN kind = 'restaurant_order' THEN 'restaurant'
  WHEN kind IN ('swap','shake','sweet_sub') THEN 'grocery'
  ELSE 'learn'
END WHERE category IS NULL;
CREATE INDEX IF NOT EXISTS idx_nutrition_suggestions_user_category ON public.nutrition_suggestions(user_id, category);