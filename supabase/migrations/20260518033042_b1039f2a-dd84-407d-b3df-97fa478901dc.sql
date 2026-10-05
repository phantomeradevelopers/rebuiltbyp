
-- 1. Client error telemetry
CREATE TABLE public.client_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  stack TEXT,
  route TEXT,
  user_agent TEXT,
  app_version TEXT,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_errors_user_id ON public.client_errors(user_id);
CREATE INDEX idx_client_errors_created_at ON public.client_errors(created_at DESC);
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own errors" ON public.client_errors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users read own errors" ON public.client_errors FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Legal / disclaimer acceptances
CREATE TABLE public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document TEXT NOT NULL,
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  UNIQUE (user_id, document, version)
);
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own acceptances" ON public.legal_acceptances FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Identity contract
CREATE TABLE public.identity_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  signature_data_url TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_identity_contracts_user_id ON public.identity_contracts(user_id, signed_at DESC);
ALTER TABLE public.identity_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contracts" ON public.identity_contracts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Daily readiness check-ins
CREATE TABLE public.readiness_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  sleep_hours NUMERIC(4,2),
  sleep_quality SMALLINT,
  hrv_ms NUMERIC(6,2),
  resting_hr SMALLINT,
  soreness SMALLINT,
  mood SMALLINT,
  energy SMALLINT,
  score SMALLINT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_date)
);
CREATE INDEX idx_readiness_user_date ON public.readiness_checkins(user_id, day_date DESC);
ALTER TABLE public.readiness_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own readiness" ON public.readiness_checkins FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_readiness_touch BEFORE UPDATE ON public.readiness_checkins FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Voice journals
CREATE TABLE public.voice_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_path TEXT,
  transcript TEXT,
  summary TEXT,
  emotion_tags TEXT[],
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_voice_journals_user ON public.voice_journals(user_id, created_at DESC);
ALTER TABLE public.voice_journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own journals" ON public.voice_journals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Weekly reviews
CREATE TABLE public.weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_summary TEXT,
  one_thing TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
CREATE INDEX idx_weekly_reviews_user ON public.weekly_reviews(user_id, week_start DESC);
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reviews" ON public.weekly_reviews FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage bucket for voice journal audio (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-journals', 'voice-journals', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Users read own journal audio" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'voice-journals' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own journal audio" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'voice-journals' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own journal audio" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'voice-journals' AND auth.uid()::text = (storage.foldername(name))[1]);
