CREATE TABLE public.breathing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern text NOT NULL,
  duration_seconds integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.breathing_sessions TO authenticated;
GRANT ALL ON public.breathing_sessions TO service_role;

ALTER TABLE public.breathing_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own breathing sessions"
  ON public.breathing_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own breathing sessions"
  ON public.breathing_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own breathing sessions"
  ON public.breathing_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX breathing_sessions_user_completed_idx
  ON public.breathing_sessions (user_id, completed_at DESC);