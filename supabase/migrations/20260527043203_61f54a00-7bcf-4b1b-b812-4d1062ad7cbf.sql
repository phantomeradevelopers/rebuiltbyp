-- 1. Profile additions
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS home_lat numeric,
  ADD COLUMN IF NOT EXISTS home_lng numeric,
  ADD COLUMN IF NOT EXISTS home_geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS unit_system text NOT NULL DEFAULT 'imperial';

-- 2. outdoor_routes: cached generated loops
CREATE TABLE IF NOT EXISTS public.outdoor_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  generated_for_date date NOT NULL,
  target_distance_m integer NOT NULL,
  distance_m integer NOT NULL,
  duration_s integer NOT NULL,
  elevation_gain_m integer NOT NULL DEFAULT 0,
  polyline text NOT NULL,
  waypoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  origin_lat numeric NOT NULL,
  origin_lng numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outdoor_routes_user_date
  ON public.outdoor_routes(user_id, generated_for_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outdoor_routes TO authenticated;
GRANT ALL ON public.outdoor_routes TO service_role;

ALTER TABLE public.outdoor_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outdoor_routes self all"
ON public.outdoor_routes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. saved_hikes
CREATE TABLE IF NOT EXISTS public.saved_hikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  place_id text NOT NULL,
  name text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_hikes_user
  ON public.saved_hikes(user_id, saved_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_hikes TO authenticated;
GRANT ALL ON public.saved_hikes TO service_role;

ALTER TABLE public.saved_hikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_hikes self all"
ON public.saved_hikes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);