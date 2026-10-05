CREATE TABLE IF NOT EXISTS public.outdoor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  route_id uuid REFERENCES public.outdoor_routes(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  distance_meters integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  avg_pace_seconds_per_km integer,
  track jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outdoor_sessions_user_started
  ON public.outdoor_sessions(user_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outdoor_sessions TO authenticated;
GRANT ALL ON public.outdoor_sessions TO service_role;

ALTER TABLE public.outdoor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outdoor_sessions self all"
ON public.outdoor_sessions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);