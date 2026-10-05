
-- 1. Mindset intensity on user_profile
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS mindset_intensity text NOT NULL DEFAULT 'balanced';

CREATE OR REPLACE FUNCTION public.validate_mindset_intensity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.mindset_intensity NOT IN ('calm','balanced','fire') THEN
    RAISE EXCEPTION 'mindset_intensity must be one of calm|balanced|fire';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_validate_mindset_intensity ON public.user_profile;
CREATE TRIGGER trg_validate_mindset_intensity
  BEFORE INSERT OR UPDATE OF mindset_intensity ON public.user_profile
  FOR EACH ROW EXECUTE FUNCTION public.validate_mindset_intensity();

-- 2. Referral reward config (single-row, admin-managed)
CREATE TABLE IF NOT EXISTS public.referral_reward_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  activity_threshold_checkins int NOT NULL DEFAULT 3,
  reps_referrer int NOT NULL DEFAULT 50,
  reps_referred int NOT NULL DEFAULT 25,
  freeze_referrer int NOT NULL DEFAULT 1,
  freeze_referred int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.referral_reward_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.referral_reward_config TO authenticated;
GRANT ALL ON public.referral_reward_config TO service_role;

ALTER TABLE public.referral_reward_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone signed-in can read config" ON public.referral_reward_config;
CREATE POLICY "anyone signed-in can read config" ON public.referral_reward_config
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin manages config" ON public.referral_reward_config;
CREATE POLICY "admin manages config" ON public.referral_reward_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Referral rewards claims (idempotent per referred user)
CREATE TABLE IF NOT EXISTS public.referral_rewards_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  reps_referrer int NOT NULL DEFAULT 0,
  reps_referred int NOT NULL DEFAULT 0,
  freeze_referrer int NOT NULL DEFAULT 0,
  freeze_referred int NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_rewards_claims TO authenticated;
GRANT ALL ON public.referral_rewards_claims TO service_role;

ALTER TABLE public.referral_rewards_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "participants read claims" ON public.referral_rewards_claims;
CREATE POLICY "participants read claims" ON public.referral_rewards_claims
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- (INSERT/UPDATE done only via service_role in claim server fn.)

-- 4. Accountability pairs
CREATE TABLE IF NOT EXISTS public.accountability_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,           -- lexicographically smaller uuid
  user_b uuid NOT NULL,
  initiated_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'active' | 'unpaired'
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  unpaired_at timestamptz,
  last_nudge_at timestamptz,
  last_nudge_by uuid,
  CONSTRAINT accountability_pair_order CHECK (user_a < user_b),
  CONSTRAINT accountability_pair_distinct CHECK (user_a <> user_b)
);
-- Only one active/pending pair between the same two users
CREATE UNIQUE INDEX IF NOT EXISTS accountability_pairs_active_uidx
  ON public.accountability_pairs (user_a, user_b)
  WHERE status IN ('pending','active');
CREATE INDEX IF NOT EXISTS accountability_pairs_user_a_idx ON public.accountability_pairs (user_a);
CREATE INDEX IF NOT EXISTS accountability_pairs_user_b_idx ON public.accountability_pairs (user_b);

GRANT SELECT, INSERT, UPDATE ON public.accountability_pairs TO authenticated;
GRANT ALL ON public.accountability_pairs TO service_role;

ALTER TABLE public.accountability_pairs ENABLE ROW LEVEL SECURITY;

-- Read: only the two participants.
DROP POLICY IF EXISTS "participants read pair" ON public.accountability_pairs;
CREATE POLICY "participants read pair" ON public.accountability_pairs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Insert: creator must be one of the two participants and set initiated_by = self, status=pending.
DROP POLICY IF EXISTS "creator inserts pending pair" ON public.accountability_pairs;
CREATE POLICY "creator inserts pending pair" ON public.accountability_pairs
  FOR INSERT TO authenticated
  WITH CHECK (
    initiated_by = auth.uid()
    AND (auth.uid() = user_a OR auth.uid() = user_b)
    AND status = 'pending'
  );

-- Update: only participants; trigger below whitelists columns to status/timestamps only.
DROP POLICY IF EXISTS "participants update pair status" ON public.accountability_pairs;
CREATE POLICY "participants update pair status" ON public.accountability_pairs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- Column-level GRANTs: only allow writes to status + nudge timestamps.
REVOKE UPDATE ON public.accountability_pairs FROM authenticated;
GRANT UPDATE (status, activated_at, unpaired_at, last_nudge_at, last_nudge_by)
  ON public.accountability_pairs TO authenticated;

-- BEFORE UPDATE trigger enforces status transitions and immutability of identity columns
CREATE OR REPLACE FUNCTION public.enforce_accountability_pair_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('role', true) IN ('service_role','postgres') THEN
    RETURN NEW;
  END IF;
  -- Identity columns are immutable to participants
  IF NEW.user_a IS DISTINCT FROM OLD.user_a
     OR NEW.user_b IS DISTINCT FROM OLD.user_b
     OR NEW.initiated_by IS DISTINCT FROM OLD.initiated_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only status and nudge timestamps may be updated';
  END IF;
  -- Allowed status transitions:
  -- pending -> active (must be the OTHER participant, not initiator)
  -- pending -> unpaired (either participant may cancel/reject)
  -- active  -> unpaired (either participant may unpair)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'pending' AND NEW.status = 'active' THEN
      IF auth.uid() = OLD.initiated_by THEN
        RAISE EXCEPTION 'The invited partner must accept, not the initiator';
      END IF;
    ELSIF NEW.status = 'unpaired' THEN
      -- always allowed for participants
      NULL;
    ELSE
      RAISE EXCEPTION 'Illegal pair status transition % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_accountability_pair_update ON public.accountability_pairs;
CREATE TRIGGER trg_enforce_accountability_pair_update
  BEFORE UPDATE ON public.accountability_pairs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_accountability_pair_update();

-- Grant EXECUTE on has_role wrapper is already there (used elsewhere).

-- 5. Server-side helper: award referral rewards atomically (called from server fn).
--    Grants Reps via xp_ledger (idempotent by source_key), streak-freeze tokens via
--    streak_savers.balance, and inserts a claim row so it can only run once per
--    referred user.
CREATE OR REPLACE FUNCTION public.claim_referral_rewards_for(p_referred uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg public.referral_reward_config%ROWTYPE;
  v_referrer uuid;
  v_checkin_count int;
  v_existing uuid;
  v_source_key_r text;
  v_source_key_e text;
BEGIN
  SELECT * INTO v_cfg FROM public.referral_reward_config WHERE id = 1;
  IF NOT FOUND OR NOT v_cfg.enabled THEN RETURN jsonb_build_object('ok', false, 'reason','disabled'); END IF;

  SELECT referred_by INTO v_referrer FROM public.user_profile WHERE user_id = p_referred;
  IF v_referrer IS NULL OR v_referrer = p_referred THEN RETURN jsonb_build_object('ok', false, 'reason','no_referrer'); END IF;

  SELECT COUNT(*) INTO v_checkin_count FROM public.daily_checkins WHERE user_id = p_referred;
  IF v_checkin_count < v_cfg.activity_threshold_checkins THEN
    RETURN jsonb_build_object('ok', false, 'reason','threshold_not_met', 'have', v_checkin_count, 'need', v_cfg.activity_threshold_checkins);
  END IF;

  SELECT id INTO v_existing FROM public.referral_rewards_claims WHERE referred_user_id = p_referred;
  IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason','already_claimed'); END IF;

  -- Insert claim row first (unique index protects against races)
  INSERT INTO public.referral_rewards_claims (
    referrer_user_id, referred_user_id,
    reps_referrer, reps_referred, freeze_referrer, freeze_referred
  ) VALUES (
    v_referrer, p_referred,
    v_cfg.reps_referrer, v_cfg.reps_referred, v_cfg.freeze_referrer, v_cfg.freeze_referred
  );

  -- Award Reps via xp_ledger (idempotent by source_key)
  v_source_key_r := 'referral_reward:referrer:' || p_referred::text;
  v_source_key_e := 'referral_reward:referred:' || p_referred::text;
  IF v_cfg.reps_referrer > 0 THEN
    INSERT INTO public.xp_ledger (user_id, delta, source, source_key, day_local)
    VALUES (v_referrer, v_cfg.reps_referrer, 'referral', v_source_key_r, (now() AT TIME ZONE 'UTC')::date)
    ON CONFLICT (user_id, source_key) DO NOTHING;
  END IF;
  IF v_cfg.reps_referred > 0 THEN
    INSERT INTO public.xp_ledger (user_id, delta, source, source_key, day_local)
    VALUES (p_referred, v_cfg.reps_referred, 'referral', v_source_key_e, (now() AT TIME ZONE 'UTC')::date)
    ON CONFLICT (user_id, source_key) DO NOTHING;
  END IF;

  -- Award freeze tokens (checkin kind)
  IF v_cfg.freeze_referrer > 0 THEN
    INSERT INTO public.streak_savers (user_id, kind, balance)
    VALUES (v_referrer, 'checkin', v_cfg.freeze_referrer)
    ON CONFLICT (user_id, kind) DO UPDATE SET balance = public.streak_savers.balance + EXCLUDED.balance;
  END IF;
  IF v_cfg.freeze_referred > 0 THEN
    INSERT INTO public.streak_savers (user_id, kind, balance)
    VALUES (p_referred, 'checkin', v_cfg.freeze_referred)
    ON CONFLICT (user_id, kind) DO UPDATE SET balance = public.streak_savers.balance + EXCLUDED.balance;
  END IF;

  RETURN jsonb_build_object('ok', true, 'referrer', v_referrer,
    'reps_referrer', v_cfg.reps_referrer, 'reps_referred', v_cfg.reps_referred,
    'freeze_referrer', v_cfg.freeze_referrer, 'freeze_referred', v_cfg.freeze_referred);
END; $$;

REVOKE ALL ON FUNCTION public.claim_referral_rewards_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral_rewards_for(uuid) TO service_role;

-- 6. Convenience view of my active partner (readable in server fn)
CREATE OR REPLACE FUNCTION public.my_active_partner_id(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p.user_a = _uid THEN p.user_b ELSE p.user_a END
    FROM public.accountability_pairs p
   WHERE p.status = 'active'
     AND (p.user_a = _uid OR p.user_b = _uid)
   ORDER BY p.activated_at DESC NULLS LAST
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.my_active_partner_id(uuid) TO authenticated, service_role;
