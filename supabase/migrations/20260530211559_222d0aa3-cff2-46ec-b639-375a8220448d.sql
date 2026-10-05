
-- Wearable provider connections (OAuth tokens per user per provider)
CREATE TABLE public.wearable_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('fitbit','oura','whoop','apple_health')),
  provider_user_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','error')),
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wearable_connections TO authenticated;
GRANT ALL ON public.wearable_connections TO service_role;

ALTER TABLE public.wearable_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wearable connections"
  ON public.wearable_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wearable connections"
  ON public.wearable_connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own wearable connections"
  ON public.wearable_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own wearable connections"
  ON public.wearable_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER wearable_connections_updated_at
BEFORE UPDATE ON public.wearable_connections
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Short-lived OAuth state (CSRF protection during the OAuth round-trip)
CREATE TABLE public.oauth_states (
  state TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  code_verifier TEXT,
  return_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
-- No client policies: only the service role (via callback route) reads/writes this.

-- Normalized daily wearable metrics — one row per user/provider/day
CREATE TABLE public.wearable_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  metric_date DATE NOT NULL,
  steps INT,
  resting_heart_rate INT,
  hrv_ms NUMERIC,
  sleep_minutes INT,
  sleep_score INT,
  readiness_score INT,
  recovery_score INT,
  strain_score NUMERIC,
  active_calories INT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, metric_date)
);

GRANT SELECT ON public.wearable_daily_metrics TO authenticated;
GRANT ALL ON public.wearable_daily_metrics TO service_role;

ALTER TABLE public.wearable_daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wearable metrics"
  ON public.wearable_daily_metrics FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX wearable_daily_metrics_user_date_idx
  ON public.wearable_daily_metrics (user_id, metric_date DESC);

CREATE TRIGGER wearable_daily_metrics_updated_at
BEFORE UPDATE ON public.wearable_daily_metrics
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
