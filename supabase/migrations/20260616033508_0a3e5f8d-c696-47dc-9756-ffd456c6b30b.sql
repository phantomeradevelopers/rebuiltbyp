
DROP FUNCTION IF EXISTS public.fn_tick_streak(uuid, text, date, int, text);

CREATE OR REPLACE FUNCTION public.fn_tick_streak(
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
  p_user uuid := auth.uid();
  v_existing public.user_streaks%ROWTYPE;
  v_from int := 0;
  v_to int := 1;
  v_longest int := 1;
  v_grace date := NULL;
  v_reason text := 'tick';
  v_gap int;
  v_source text := COALESCE(p_source, p_kind || ':' || p_day_local::text);
BEGIN
  IF p_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_kind NOT IN ('checkin','journal','anchor','workout','mindset','meal') THEN
    RAISE EXCEPTION 'Invalid kind: %', p_kind;
  END IF;

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
    v_from := v_existing.current_count; v_to := v_existing.current_count;
    v_longest := v_existing.longest_count; v_grace := v_existing.grace_until; v_reason := 'noop_same_day';
  ELSE
    v_gap := (p_day_local - v_existing.last_date);
    v_from := v_existing.current_count;
    IF v_gap = 1 THEN
      v_to := v_existing.current_count + 1;
      v_grace := NULL; v_reason := 'tick';
    ELSIF v_gap = 2 AND v_existing.grace_until IS NOT NULL AND p_day_local <= v_existing.grace_until THEN
      v_to := v_existing.current_count + 1;
      v_grace := NULL; v_reason := 'grace_held';
    ELSIF v_gap >= 3 THEN
      v_to := 1; v_grace := NULL; v_reason := 'reset_comeback';
    ELSE
      v_to := 1; v_grace := NULL; v_reason := 'reset_break';
    END IF;
    v_longest := GREATEST(COALESCE(v_existing.longest_count, 0), v_to);
  END IF;

  IF v_reason IN ('tick','grace_held') AND p_grace_days > 0 THEN
    v_grace := p_day_local + p_grace_days + 1;
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

REVOKE ALL ON FUNCTION public.fn_tick_streak(text, date, int, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_tick_streak(text, date, int, text) TO authenticated, service_role;
