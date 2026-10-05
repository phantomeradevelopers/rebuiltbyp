
-- 1. Extend user_profile
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS entitlement text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS entitlement_source text,
  ADD COLUMN IF NOT EXISTS entitlement_granted_at timestamptz;

ALTER TABLE public.user_profile
  DROP CONSTRAINT IF EXISTS user_profile_entitlement_chk;
ALTER TABLE public.user_profile
  ADD CONSTRAINT user_profile_entitlement_chk
  CHECK (entitlement IN ('free','subscriber','lifetime'));

-- 2. course_purchases
CREATE TABLE IF NOT EXISTS public.course_purchases (
  email text PRIMARY KEY,
  order_id text,
  purchased_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.course_purchases TO service_role;
ALTER TABLE public.course_purchases ENABLE ROW LEVEL SECURITY;
-- No client policies: only service_role / SECURITY DEFINER functions access it.

-- 3. redemption_codes
CREATE TABLE IF NOT EXISTS public.redemption_codes (
  code text PRIMARY KEY,
  entitlement_to_grant text NOT NULL CHECK (entitlement_to_grant IN ('subscriber','lifetime')),
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.redemption_codes TO service_role;
ALTER TABLE public.redemption_codes ENABLE ROW LEVEL SECURITY;
-- No client policies: redemption goes through redeem_code() SECURITY DEFINER.

-- 4. Helper: grant entitlement (writes profile + keeps rebuilt_access in sync)
CREATE OR REPLACE FUNCTION public.grant_entitlement(
  p_user_id uuid,
  p_entitlement text,
  p_source text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_entitlement NOT IN ('free','subscriber','lifetime') THEN
    RAISE EXCEPTION 'Invalid entitlement: %', p_entitlement;
  END IF;
  UPDATE public.user_profile
     SET entitlement = p_entitlement,
         entitlement_source = p_source,
         entitlement_granted_at = now(),
         rebuilt_access = (p_entitlement IN ('subscriber','lifetime')) OR rebuilt_access,
         updated_at = now()
   WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_entitlement(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- 5. sync_entitlement_from_purchase — email-match upgrade
CREATE OR REPLACE FUNCTION public.sync_entitlement_from_purchase(p_user_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current text;
  v_found boolean;
BEGIN
  IF p_email IS NULL OR p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.course_purchases WHERE lower(email) = lower(p_email))
    INTO v_found;
  IF NOT v_found THEN RETURN NULL; END IF;

  SELECT entitlement INTO v_current FROM public.user_profile WHERE user_id = p_user_id;
  IF v_current = 'free' OR v_current IS NULL THEN
    PERFORM public.grant_entitlement(p_user_id, 'lifetime', 'course_497');
    RETURN 'lifetime';
  END IF;
  RETURN v_current;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_entitlement_from_purchase(uuid, text) TO authenticated;

-- Authenticated wrapper that uses auth.uid() — safe for clients to call.
CREATE OR REPLACE FUNCTION public.restore_my_purchase()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO v_email FROM public.user_profile WHERE user_id = v_uid;
  RETURN public.sync_entitlement_from_purchase(v_uid, v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_my_purchase() TO authenticated;

-- 6. redeem_code — atomic claim
CREATE OR REPLACE FUNCTION public.redeem_code(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_grant text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_code IS NULL OR length(v_code) < 4 THEN RAISE EXCEPTION 'Invalid code'; END IF;

  UPDATE public.redemption_codes
     SET used_by = v_uid, used_at = now()
   WHERE code = v_code AND used_by IS NULL
   RETURNING entitlement_to_grant INTO v_grant;

  IF v_grant IS NULL THEN
    RAISE EXCEPTION 'Code is invalid or already used';
  END IF;

  PERFORM public.grant_entitlement(v_uid, v_grant, 'redeem_code');
  RETURN v_grant;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_code(text) TO authenticated;

-- 7. Prevent clients from updating entitlement columns directly
CREATE OR REPLACE FUNCTION public.protect_entitlement_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Allow service_role / superuser to do anything
  IF current_setting('role', true) IN ('service_role', 'postgres') THEN
    RETURN NEW;
  END IF;
  IF NEW.entitlement IS DISTINCT FROM OLD.entitlement
     OR NEW.entitlement_source IS DISTINCT FROM OLD.entitlement_source
     OR NEW.entitlement_granted_at IS DISTINCT FROM OLD.entitlement_granted_at
     OR NEW.rebuilt_access IS DISTINCT FROM OLD.rebuilt_access THEN
    RAISE EXCEPTION 'entitlement columns are read-only from client; use grant_entitlement/redeem_code/restore_my_purchase';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_entitlement_on_user_profile ON public.user_profile;
CREATE TRIGGER protect_entitlement_on_user_profile
  BEFORE UPDATE ON public.user_profile
  FOR EACH ROW EXECUTE FUNCTION public.protect_entitlement_columns();

-- 8. Update handle_new_user to auto-sync entitlement from email match
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profile (user_id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (user_id) DO NOTHING;

  -- Auto-grant lifetime if email matches a course purchase
  PERFORM public.sync_entitlement_from_purchase(new.id, new.email);
  RETURN new;
END;
$$;

-- Ensure the auth trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Backfill: anyone already signed up whose email matches a purchase
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id, email FROM public.user_profile WHERE entitlement = 'free' LOOP
    PERFORM public.sync_entitlement_from_purchase(r.user_id, r.email);
  END LOOP;
END $$;
