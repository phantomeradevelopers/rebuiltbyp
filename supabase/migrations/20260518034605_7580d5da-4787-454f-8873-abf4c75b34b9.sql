
-- Spirit / tradition
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS tradition text NOT NULL DEFAULT 'secular';

CREATE TABLE IF NOT EXISTS public.daily_anchors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_date date NOT NULL,
  tradition text NOT NULL DEFAULT 'secular',
  theme text NOT NULL,
  verse_ref text,
  verse_text text NOT NULL,
  reflection_prompt text NOT NULL,
  breath_protocol text NOT NULL DEFAULT '4-7-8',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anchor_date, tradition)
);
ALTER TABLE public.daily_anchors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anchors read all auth" ON public.daily_anchors
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.anchor_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  anchor_date date NOT NULL,
  response text,
  mood_before smallint,
  mood_after smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, anchor_date)
);
ALTER TABLE public.anchor_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anchor reflections self all" ON public.anchor_reflections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Health samples (HealthKit / Health Connect)
CREATE TABLE IF NOT EXISTS public.health_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL, -- 'healthkit' | 'health_connect' | 'manual' | 'mock'
  metric text NOT NULL, -- 'sleep_hours' | 'resting_hr' | 'hrv_ms' | 'steps' | 'workout_minutes'
  value numeric NOT NULL,
  unit text,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS health_samples_user_metric_idx
  ON public.health_samples (user_id, metric, recorded_at DESC);
ALTER TABLE public.health_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health samples self all" ON public.health_samples
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Streaks
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL, -- 'checkin' | 'journal' | 'anchor' | 'workout'
  current_count integer NOT NULL DEFAULT 0,
  longest_count integer NOT NULL DEFAULT 0,
  last_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streaks self all" ON public.user_streaks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Safety events
CREATE TABLE IF NOT EXISTS public.safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL, -- 'journal' | 'coach' | 'checkin'
  matched_terms text[] NOT NULL DEFAULT '{}',
  excerpt text,
  severity text NOT NULL DEFAULT 'low', -- 'low' | 'medium' | 'high'
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "safety events self all" ON public.safety_events
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
