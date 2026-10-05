-- Catalog of gyms (shared, deduped on Google Place ID)
CREATE TABLE public.gyms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  google_place_id text NOT NULL UNIQUE,
  name text NOT NULL,
  formatted_address text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gyms_lat_lng_idx ON public.gyms (lat, lng);

GRANT SELECT ON public.gyms TO authenticated;
GRANT ALL ON public.gyms TO service_role;

ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gyms read all auth"
  ON public.gyms FOR SELECT
  TO authenticated
  USING (true);

-- User's saved gyms
CREATE TABLE public.user_gyms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  nickname text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, gym_id)
);
CREATE INDEX user_gyms_user_idx ON public.user_gyms (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_gyms TO authenticated;
GRANT ALL ON public.user_gyms TO service_role;

ALTER TABLE public.user_gyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_gyms self all"
  ON public.user_gyms FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Gym visits / check-ins
CREATE TABLE public.gym_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  gym_id uuid REFERENCES public.gyms(id) ON DELETE SET NULL,
  lat double precision,
  lng double precision,
  source text NOT NULL DEFAULT 'geofence',
  entered_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  verified boolean NOT NULL DEFAULT false,
  notification_sent jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source IN ('geofence','manual','background'))
);
CREATE INDEX gym_visits_user_entered_idx ON public.gym_visits (user_id, entered_at DESC);
CREATE INDEX gym_visits_open_idx ON public.gym_visits (user_id) WHERE left_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.gym_visits TO authenticated;
GRANT ALL ON public.gym_visits TO service_role;

ALTER TABLE public.gym_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym_visits self select"
  ON public.gym_visits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "gym_visits self insert"
  ON public.gym_visits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gym_visits self update"
  ON public.gym_visits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Lookup cache (server only; no anon/authenticated grants)
CREATE TABLE public.gym_lookup_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  result jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gym_lookup_cache_fetched_idx ON public.gym_lookup_cache (fetched_at);

GRANT ALL ON public.gym_lookup_cache TO service_role;

ALTER TABLE public.gym_lookup_cache ENABLE ROW LEVEL SECURITY;
-- No policies = no client access; service_role bypasses RLS.

-- updated_at triggers
CREATE TRIGGER gyms_touch_updated_at
  BEFORE UPDATE ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER gym_visits_touch_updated_at
  BEFORE UPDATE ON public.gym_visits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();