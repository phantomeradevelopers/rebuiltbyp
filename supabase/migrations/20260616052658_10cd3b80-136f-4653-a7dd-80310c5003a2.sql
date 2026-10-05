
-- 1) Tier columns on user_profile
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free','pro','elite','lifetime_pro')),
  ADD COLUMN IF NOT EXISTS tier_source text,
  ADD COLUMN IF NOT EXISTS tier_granted_at timestamptz;

UPDATE public.user_profile
   SET tier = CASE
     WHEN entitlement = 'lifetime'  THEN 'lifetime_pro'
     WHEN entitlement = 'subscriber' THEN 'pro'
     ELSE 'free'
   END,
   tier_source = entitlement_source,
   tier_granted_at = entitlement_granted_at
 WHERE tier = 'free' AND entitlement IS NOT NULL AND entitlement <> 'free';

-- 2) has_tier helper
CREATE OR REPLACE FUNCTION public.has_tier(_user_id uuid, _min_tier text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT tier FROM public.user_profile WHERE user_id = _user_id
  ),
  r AS (
    SELECT
      CASE COALESCE((SELECT tier FROM t), 'free')
        WHEN 'free' THEN 0 WHEN 'pro' THEN 1
        WHEN 'lifetime_pro' THEN 1 WHEN 'elite' THEN 2
        ELSE 0 END AS cur,
      CASE _min_tier
        WHEN 'free' THEN 0 WHEN 'pro' THEN 1
        WHEN 'lifetime_pro' THEN 1 WHEN 'elite' THEN 2
        ELSE 0 END AS req
  )
  SELECT cur >= req FROM r;
$$;

-- 3) grant_tier
CREATE OR REPLACE FUNCTION public.grant_tier(p_user_id uuid, p_tier text, p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tier NOT IN ('free','pro','elite','lifetime_pro') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_tier;
  END IF;
  UPDATE public.user_profile
     SET tier = p_tier,
         tier_source = p_source,
         tier_granted_at = now(),
         entitlement = CASE
           WHEN p_tier = 'lifetime_pro' THEN 'lifetime'
           WHEN p_tier IN ('pro','elite') THEN 'subscriber'
           ELSE 'free' END,
         entitlement_source = p_source,
         entitlement_granted_at = now(),
         rebuilt_access = (p_tier <> 'free') OR rebuilt_access,
         updated_at = now()
   WHERE user_id = p_user_id;
END;
$$;

-- 4) Extend protect trigger
CREATE OR REPLACE FUNCTION public.protect_entitlement_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IN ('service_role', 'postgres') THEN
    RETURN NEW;
  END IF;
  IF NEW.entitlement IS DISTINCT FROM OLD.entitlement
     OR NEW.entitlement_source IS DISTINCT FROM OLD.entitlement_source
     OR NEW.entitlement_granted_at IS DISTINCT FROM OLD.entitlement_granted_at
     OR NEW.rebuilt_access IS DISTINCT FROM OLD.rebuilt_access
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.tier_source IS DISTINCT FROM OLD.tier_source
     OR NEW.tier_granted_at IS DISTINCT FROM OLD.tier_granted_at THEN
    RAISE EXCEPTION 'entitlement/tier columns are read-only from client';
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Free-tier daily cap on ai_coach_messages
CREATE OR REPLACE FUNCTION public.enforce_coach_free_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF NEW.role IS DISTINCT FROM 'user' THEN RETURN NEW; END IF;
  IF public.has_tier(NEW.user_id, 'pro') THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_count
    FROM public.ai_coach_messages
   WHERE user_id = NEW.user_id
     AND role = 'user'
     AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Free plan limit: 5 coach messages/day. Upgrade to Pro for unlimited.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_coach_free_limit ON public.ai_coach_messages;
CREATE TRIGGER trg_enforce_coach_free_limit
  BEFORE INSERT ON public.ai_coach_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_coach_free_limit();

-- 6) Free-tier daily cap on food_log (1/day)
CREATE OR REPLACE FUNCTION public.enforce_food_log_free_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF public.has_tier(NEW.user_id, 'pro') THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_count
    FROM public.food_log
   WHERE user_id = NEW.user_id
     AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');
  IF v_count >= 1 THEN
    RAISE EXCEPTION 'Free plan limit: 1 meal/day. Upgrade to Pro for full nutrition tracking.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_food_log_free_limit ON public.food_log;
CREATE TRIGGER trg_enforce_food_log_free_limit
  BEFORE INSERT ON public.food_log
  FOR EACH ROW EXECUTE FUNCTION public.enforce_food_log_free_limit();
