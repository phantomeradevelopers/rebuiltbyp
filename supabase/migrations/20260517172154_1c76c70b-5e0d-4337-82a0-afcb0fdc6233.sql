
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS physique_focus jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS success_metric jsonb,
  ADD COLUMN IF NOT EXISTS goal_progress_summary jsonb;

CREATE TABLE IF NOT EXISTS public.weekly_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_number integer NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  focus_feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  measurements jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight_kg numeric,
  week_rating integer CHECK (week_rating BETWEEN 1 AND 10),
  notes text,
  photo_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_checkins_user_week_idx
  ON public.weekly_checkins (user_id, week_number DESC);

ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly checkins self all" ON public.weekly_checkins;
CREATE POLICY "weekly checkins self all"
  ON public.weekly_checkins
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
