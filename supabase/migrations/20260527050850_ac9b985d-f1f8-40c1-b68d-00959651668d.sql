ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS training_experience text
    CHECK (training_experience IN ('new','returning','intermediate','advanced')),
  ADD COLUMN IF NOT EXISTS training_years numeric(4,1),
  ADD COLUMN IF NOT EXISTS preferred_activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS activity_notes text,
  ADD COLUMN IF NOT EXISTS workout_style_preference text
    CHECK (workout_style_preference IN ('short_intense','long_steady','varied','fun_first'));