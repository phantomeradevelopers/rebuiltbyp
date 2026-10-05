-- 1) Extend user_profile with trial + subscription state
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_plan text,
  ADD COLUMN IF NOT EXISTS trial_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- 2) Daily coach message counter (used to enforce 5/day on free tier)
CREATE TABLE IF NOT EXISTS public.coach_usage_daily (
  user_id uuid NOT NULL,
  day date NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

GRANT SELECT, INSERT, UPDATE ON public.coach_usage_daily TO authenticated;
GRANT ALL ON public.coach_usage_daily TO service_role;

ALTER TABLE public.coach_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_usage self read"
  ON public.coach_usage_daily FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "coach_usage self upsert"
  ON public.coach_usage_daily FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coach_usage self update"
  ON public.coach_usage_daily FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) Helper RPC: increment coach usage for today, return new count
CREATE OR REPLACE FUNCTION public.incr_coach_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.coach_usage_daily (user_id, day, message_count)
  VALUES (v_uid, v_today, 1)
  ON CONFLICT (user_id, day)
  DO UPDATE SET message_count = public.coach_usage_daily.message_count + 1,
                updated_at = now()
  RETURNING message_count INTO v_count;
  RETURN v_count;
END;
$$;