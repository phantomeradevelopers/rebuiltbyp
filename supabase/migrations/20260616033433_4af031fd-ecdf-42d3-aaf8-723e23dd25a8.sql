
-- 1. user_profile timezone
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

-- 2. user_streaks grace_until + unique
ALTER TABLE public.user_streaks ADD COLUMN IF NOT EXISTS grace_until date;
CREATE UNIQUE INDEX IF NOT EXISTS user_streaks_user_kind_uidx ON public.user_streaks(user_id, kind);

-- 3. unique constraints elsewhere
CREATE UNIQUE INDEX IF NOT EXISTS user_achievements_user_key_uidx ON public.user_achievements(user_id, achievement_key);
CREATE UNIQUE INDEX IF NOT EXISTS daily_checkins_user_date_uidx ON public.daily_checkins(user_id, date);

-- 4. xp_ledger
CREATE TABLE IF NOT EXISTS public.xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  delta integer NOT NULL,
  balance_after integer,
  day_local date,
  source_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_key)
);
GRANT SELECT, INSERT ON public.xp_ledger TO authenticated;
GRANT ALL ON public.xp_ledger TO service_role;
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_ledger_select_own" ON public.xp_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "xp_ledger_insert_own" ON public.xp_ledger FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS xp_ledger_user_created_idx ON public.xp_ledger(user_id, created_at DESC);

-- 5. streak_events
CREATE TABLE IF NOT EXISTS public.streak_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  from_count integer NOT NULL,
  to_count integer NOT NULL,
  reason text NOT NULL,
  day_local date NOT NULL,
  source_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_key)
);
GRANT SELECT, INSERT ON public.streak_events TO authenticated;
GRANT ALL ON public.streak_events TO service_role;
ALTER TABLE public.streak_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streak_events_select_own" ON public.streak_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "streak_events_insert_own" ON public.streak_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS streak_events_user_created_idx ON public.streak_events(user_id, created_at DESC);

-- 6. streak_savers
CREATE TABLE IF NOT EXISTS public.streak_savers (
  user_id uuid NOT NULL,
  kind text NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  earned_total integer NOT NULL DEFAULT 0,
  used_total integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);
GRANT SELECT, INSERT, UPDATE ON public.streak_savers TO authenticated;
GRANT ALL ON public.streak_savers TO service_role;
ALTER TABLE public.streak_savers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streak_savers_select_own" ON public.streak_savers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "streak_savers_modify_own" ON public.streak_savers FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. fn_tick_streak: atomic transition
CREATE OR REPLACE FUNCTION public.fn_tick_streak(
  p_user uuid,
  p_kind text,
  p_day_local date,
  p_grace_days int DEFAULT 1,
  p_source text DEFAULT NULL
) RETURNS TABLE(current_count int, longest_count int, last_date date, grace_until date, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.user_streaks%ROWTYPE;
  v_from int := 0;
  v_to int := 1;
  v_longest int := 1;
  v_grace date := NULL;
  v_reason text := 'tick';
  v_gap int;
  v_source text := COALESCE(p_source, p_kind || ':' || p_day_local::text);
BEGIN
  IF p_user IS NULL THEN RAISE EXCEPTION 'user required'; END IF;

  -- Idempotency: if an event with this source_key already exists for this user, return current state.
  IF EXISTS (SELECT 1 FROM public.streak_events WHERE user_id = p_user AND source_key = v_source) THEN
    SELECT * INTO v_existing FROM public.user_streaks WHERE user_id = p_user AND kind = p_kind;
    IF FOUND THEN
      RETURN QUERY SELECT v_existing.current_count, v_existing.longest_count, v_existing.last_date, v_existing.grace_until, 'noop'::text;
    ELSE
      RETURN QUERY SELECT 0, 0, NULL::date, NULL::date, 'noop'::text;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_existing FROM public.user_streaks WHERE user_id = p_user AND kind = p_kind FOR UPDATE;

  IF NOT FOUND THEN
    v_from := 0; v_to := 1; v_longest := 1; v_grace := NULL; v_reason := 'tick';
  ELSIF v_existing.last_date = p_day_local THEN
    -- same day no-op (but still log the event so source_key is consumed)
    v_from := v_existing.current_count; v_to := v_existing.current_count;
    v_longest := v_existing.longest_count; v_grace := v_existing.grace_until; v_reason := 'noop_same_day';
  ELSE
    v_gap := (p_day_local - v_existing.last_date);
    v_from := v_existing.current_count;
    IF v_gap = 1 THEN
      v_to := v_existing.current_count + 1;
      v_grace := NULL; v_reason := 'tick';
    ELSIF v_gap = 2 AND v_existing.grace_until IS NOT NULL AND p_day_local <= v_existing.grace_until THEN
      -- grace held: counts as consecutive
      v_to := v_existing.current_count + 1;
      v_grace := NULL; v_reason := 'grace_held';
    ELSIF v_gap >= 3 THEN
      v_to := 1; v_grace := NULL; v_reason := 'reset_comeback';
    ELSE
      -- gap = 2 with no grace, or any non-consecutive small gap: comeback-light reset
      v_to := 1; v_grace := NULL; v_reason := 'reset_break';
    END IF;
    v_longest := GREATEST(COALESCE(v_existing.longest_count, 0), v_to);
  END IF;

  -- Open a grace window for tomorrow if user ticked today (gives them one missed day before break)
  IF v_reason IN ('tick','grace_held') AND p_grace_days > 0 THEN
    v_grace := p_day_local + p_grace_days + 1; -- valid through end of grace window
  END IF;

  INSERT INTO public.user_streaks (user_id, kind, current_count, longest_count, last_date, grace_until, updated_at)
  VALUES (p_user, p_kind, v_to, v_longest, p_day_local, v_grace, now())
  ON CONFLICT (user_id, kind) DO UPDATE
    SET current_count = EXCLUDED.current_count,
        longest_count = EXCLUDED.longest_count,
        last_date = EXCLUDED.last_date,
        grace_until = EXCLUDED.grace_until,
        updated_at = now();

  INSERT INTO public.streak_events (user_id, kind, from_count, to_count, reason, day_local, source_key, metadata)
  VALUES (p_user, p_kind, v_from, v_to, v_reason, p_day_local, v_source, jsonb_build_object('grace_until', v_grace))
  ON CONFLICT (user_id, source_key) DO NOTHING;

  RETURN QUERY SELECT v_to, v_longest, p_day_local, v_grace, v_reason;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_tick_streak(uuid, text, date, int, text) TO authenticated, service_role;

-- 8. Backfill xp_ledger from existing user_achievements (one-shot)
INSERT INTO public.xp_ledger (user_id, action_type, delta, day_local, source_key, metadata, created_at)
SELECT ua.user_id,
       'achievement_unlock',
       a.xp,
       (ua.unlocked_at AT TIME ZONE 'UTC')::date,
       'achievement:' || a.key,
       jsonb_build_object('rarity', a.rarity, 'backfill', true),
       ua.unlocked_at
FROM public.user_achievements ua
JOIN public.achievements a ON a.key = ua.achievement_key
ON CONFLICT (user_id, source_key) DO NOTHING;
