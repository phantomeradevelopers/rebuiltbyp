CREATE TABLE public.meal_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day integer NOT NULL,
  slot text NOT NULL,
  date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day, slot, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_completions TO authenticated;
GRANT ALL ON public.meal_completions TO service_role;

ALTER TABLE public.meal_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal completions self select"
  ON public.meal_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "meal completions self insert"
  ON public.meal_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meal completions self delete"
  ON public.meal_completions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX meal_completions_user_date_idx ON public.meal_completions (user_id, date);