ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS mood_today smallint CHECK (mood_today BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS top_drain text,
  ADD COLUMN IF NOT EXISTS peptide_status text CHECK (peptide_status IN ('on','considering','no')),
  ADD COLUMN IF NOT EXISTS coach_voice text NOT NULL DEFAULT 'mentor' CHECK (coach_voice IN ('mentor','brother','drill','quiet'));