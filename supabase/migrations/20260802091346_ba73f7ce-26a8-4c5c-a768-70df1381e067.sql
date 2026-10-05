CREATE TABLE public.web_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  site TEXT,
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  user_id UUID,
  event_type TEXT NOT NULL,
  name TEXT,
  path TEXT,
  referrer TEXT,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  device TEXT,
  screen_w INT,
  duration_ms INT,
  is_new BOOLEAN,
  href TEXT,
  dead_link BOOLEAN,
  value_cents INT,
  currency TEXT,
  meta JSONB
);

GRANT ALL ON public.web_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.web_events_id_seq TO service_role;

ALTER TABLE public.web_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX web_events_occurred_at_idx ON public.web_events (occurred_at DESC);
CREATE INDEX web_events_type_idx ON public.web_events (event_type, occurred_at DESC);
CREATE INDEX web_events_session_idx ON public.web_events (session_id);