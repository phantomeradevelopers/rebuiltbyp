CREATE TABLE public.meal_reminder_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  eating_pattern text NOT NULL DEFAULT 'unknown',
  typical_times jsonb NOT NULL DEFAULT '{}'::jsonb,
  missed_slots_7d jsonb NOT NULL DEFAULT '{}'::jsonb,
  reminders_enabled boolean NOT NULL DEFAULT true,
  quiet_hours jsonb NOT NULL DEFAULT '{"start":"22:00","end":"06:00"}'::jsonb,
  last_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_reminder_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal reminder self all" ON public.meal_reminder_profile
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER meal_reminder_profile_touch
BEFORE UPDATE ON public.meal_reminder_profile
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.user_profile
  ADD COLUMN meal_reminders_enabled boolean NOT NULL DEFAULT true;