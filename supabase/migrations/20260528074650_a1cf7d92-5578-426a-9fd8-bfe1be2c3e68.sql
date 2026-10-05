
-- Bump default price to $3,000/mo
ALTER TABLE public.consult_subscription ALTER COLUMN plan_price_cents SET DEFAULT 300000;

-- ============= consult_applications =============
CREATE TABLE public.consult_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  want TEXT NOT NULL,
  obstacle TEXT NOT NULL,
  why_now TEXT NOT NULL,
  extra TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','waitlist')),
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consult_applications TO authenticated;
GRANT ALL ON public.consult_applications TO service_role;
ALTER TABLE public.consult_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications self read" ON public.consult_applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "applications self insert" ON public.consult_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "applications admin read" ON public.consult_applications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "applications admin update" ON public.consult_applications
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_consult_applications_status ON public.consult_applications(status, created_at DESC);
CREATE INDEX idx_consult_applications_user ON public.consult_applications(user_id);

-- ============= consult_seats =============
CREATE TABLE public.consult_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  application_id UUID REFERENCES public.consult_applications(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
  slot_dow SMALLINT CHECK (slot_dow BETWEEN 0 AND 6),
  slot_time TIME,
  zoom_link_override TEXT,
  stripe_subscription_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consult_seats TO authenticated;
GRANT ALL ON public.consult_seats TO service_role;
ALTER TABLE public.consult_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seats self read" ON public.consult_seats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "seats admin all" ON public.consult_seats
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_consult_seats_status ON public.consult_seats(status);

-- ============= consult_availability =============
CREATE TABLE public.consult_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dow SMALLINT NOT NULL CHECK (dow BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.consult_availability TO authenticated;
GRANT ALL ON public.consult_availability TO service_role;
ALTER TABLE public.consult_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability read all auth" ON public.consult_availability
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "availability admin write" ON public.consult_availability
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= consult_blackouts =============
CREATE TABLE public.consult_blackouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
GRANT SELECT ON public.consult_blackouts TO authenticated;
GRANT ALL ON public.consult_blackouts TO service_role;
ALTER TABLE public.consult_blackouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blackouts read all auth" ON public.consult_blackouts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "blackouts admin write" ON public.consult_blackouts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= consult_sessions =============
CREATE TABLE public.consult_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id UUID NOT NULL REFERENCES public.consult_seats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes SMALLINT NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','no_show','canceled','rescheduled')),
  video_link TEXT,
  brief_json JSONB,
  brief_generated_at TIMESTAMPTZ,
  p_notes TEXT,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  voice_note_url TEXT,
  joined_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consult_sessions TO authenticated;
GRANT ALL ON public.consult_sessions TO service_role;
ALTER TABLE public.consult_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions self read" ON public.consult_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sessions self cancel" ON public.consult_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status = 'scheduled')
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions admin all" ON public.consult_sessions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_consult_sessions_user ON public.consult_sessions(user_id, scheduled_at DESC);
CREATE INDEX idx_consult_sessions_scheduled ON public.consult_sessions(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_consult_sessions_seat ON public.consult_sessions(seat_id, scheduled_at DESC);

-- ============= updated_at triggers =============
CREATE TRIGGER consult_applications_touch BEFORE UPDATE ON public.consult_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER consult_seats_touch BEFORE UPDATE ON public.consult_seats
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER consult_sessions_touch BEFORE UPDATE ON public.consult_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
