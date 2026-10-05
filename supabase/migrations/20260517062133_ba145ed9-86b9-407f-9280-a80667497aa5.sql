CREATE TABLE public.food_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  meal text NOT NULL,
  name text NOT NULL,
  calories integer NOT NULL DEFAULT 0,
  protein_g integer NOT NULL DEFAULT 0,
  carbs_g integer NOT NULL DEFAULT 0,
  fat_g integer NOT NULL DEFAULT 0,
  notes text,
  logged_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_food_log_user_date ON public.food_log (user_id, date DESC);

ALTER TABLE public.food_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food log self all" ON public.food_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);