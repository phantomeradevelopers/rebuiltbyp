
-- 1) Partner perk configuration (admin-controlled)
CREATE TABLE IF NOT EXISTS public.partner_perk_config (
  partner text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  discount_percent integer NOT NULL DEFAULT 10 CHECK (discount_percent >= 0 AND discount_percent <= 90),
  tier_required text NOT NULL DEFAULT 'pro' CHECK (tier_required IN ('free','pro','elite')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.partner_perk_config TO authenticated;
GRANT ALL ON public.partner_perk_config TO service_role;

ALTER TABLE public.partner_perk_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read perk config"
  ON public.partner_perk_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admins can update perk config"
  ON public.partner_perk_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins can insert perk config"
  ON public.partner_perk_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.partner_perk_config (partner, enabled, discount_percent, tier_required)
VALUES ('youthfullab', false, 15, 'pro'),
       ('candyrx', false, 10, 'pro')
ON CONFLICT (partner) DO NOTHING;

-- 2) Per-member perk codes
CREATE TABLE IF NOT EXISTS public.member_perk_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner text NOT NULL,
  code text NOT NULL UNIQUE,
  tier_required text NOT NULL,
  discount_percent integer NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, partner)
);

GRANT SELECT ON public.member_perk_codes TO authenticated;
GRANT ALL ON public.member_perk_codes TO service_role;

ALTER TABLE public.member_perk_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own codes"
  ON public.member_perk_codes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admins read all codes"
  ON public.member_perk_codes FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_member_perk_codes_user ON public.member_perk_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_member_perk_codes_code ON public.member_perk_codes (code);

-- 3) Issue-or-return code for the current user + partner
CREATE OR REPLACE FUNCTION public.issue_member_perk_code(p_partner text)
RETURNS TABLE (code text, discount_percent integer, tier_required text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cfg public.partner_perk_config%ROWTYPE;
  v_row public.member_perk_codes%ROWTYPE;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
  v_attempts int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_partner NOT IN ('youthfullab','candyrx') THEN
    RAISE EXCEPTION 'Unknown partner: %', p_partner;
  END IF;

  SELECT * INTO v_cfg FROM public.partner_perk_config WHERE partner = p_partner;
  IF NOT FOUND OR NOT v_cfg.enabled THEN
    RETURN;
  END IF;

  IF NOT public.has_tier(v_uid, v_cfg.tier_required) THEN
    RETURN;
  END IF;

  SELECT * INTO v_row FROM public.member_perk_codes
    WHERE user_id = v_uid AND partner = p_partner
    FOR UPDATE;

  IF FOUND THEN
    -- Reactivate if config changed while revoked and user re-qualifies
    IF v_row.status = 'revoked' THEN
      UPDATE public.member_perk_codes
         SET status='active',
             revoked_at=NULL,
             discount_percent = v_cfg.discount_percent,
             tier_required = v_cfg.tier_required
       WHERE id = v_row.id
      RETURNING * INTO v_row;
    ELSIF v_row.discount_percent <> v_cfg.discount_percent
       OR v_row.tier_required <> v_cfg.tier_required THEN
      UPDATE public.member_perk_codes
         SET discount_percent = v_cfg.discount_percent,
             tier_required = v_cfg.tier_required
       WHERE id = v_row.id
      RETURNING * INTO v_row;
    END IF;
    RETURN QUERY SELECT v_row.code, v_row.discount_percent, v_row.tier_required, v_row.status;
    RETURN;
  END IF;

  LOOP
    v_code := 'RB-';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.member_perk_codes WHERE code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN RAISE EXCEPTION 'Could not generate unique perk code'; END IF;
  END LOOP;

  INSERT INTO public.member_perk_codes
    (user_id, partner, code, tier_required, discount_percent, status)
  VALUES (v_uid, p_partner, v_code, v_cfg.tier_required, v_cfg.discount_percent, 'active')
  RETURNING * INTO v_row;

  RETURN QUERY SELECT v_row.code, v_row.discount_percent, v_row.tier_required, v_row.status;
END;
$$;

-- 4) Revoke all perks for a user (service role only usage)
CREATE OR REPLACE FUNCTION public.revoke_member_perks(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_n integer;
BEGIN
  UPDATE public.member_perk_codes
     SET status = 'revoked', revoked_at = now()
   WHERE user_id = p_user_id AND status = 'active';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- 5) Verify a perk code (no auth; partner sites call via signed public endpoint)
CREATE OR REPLACE FUNCTION public.verify_perk_code(p_code text, p_partner text)
RETURNS TABLE (valid boolean, discount_percent integer, tier_required text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.member_perk_codes%ROWTYPE;
  v_cfg public.partner_perk_config%ROWTYPE;
BEGIN
  SELECT * INTO v_cfg FROM public.partner_perk_config WHERE partner = p_partner;
  IF NOT FOUND OR NOT v_cfg.enabled THEN
    RETURN QUERY SELECT false, 0, ''::text; RETURN;
  END IF;

  SELECT * INTO v_row FROM public.member_perk_codes
    WHERE code = upper(trim(p_code)) AND partner = p_partner;

  IF NOT FOUND OR v_row.status <> 'active' THEN
    RETURN QUERY SELECT false, 0, ''::text; RETURN;
  END IF;

  RETURN QUERY SELECT true, v_row.discount_percent, v_row.tier_required;
END;
$$;

-- Restrict verify to service_role (called only from server route)
REVOKE ALL ON FUNCTION public.verify_perk_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_perk_code(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.revoke_member_perks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_member_perks(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.issue_member_perk_code(text) TO authenticated;
