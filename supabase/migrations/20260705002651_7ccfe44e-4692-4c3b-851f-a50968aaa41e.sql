
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

  INSERT INTO public.referral_rewards_claims (
    referrer_user_id, referred_user_id,
    reps_referrer, reps_referred, freeze_referrer, freeze_referred
  ) VALUES (
    v_referrer, p_referred,
    v_cfg.reps_referrer, v_cfg.reps_referred, v_cfg.freeze_referrer, v_cfg.freeze_referred
  );

  v_source_key_r := 'referral_reward:referrer:' || p_referred::text;
  v_source_key_e := 'referral_reward:referred:' || p_referred::text;
  IF v_cfg.reps_referrer > 0 THEN
    INSERT INTO public.xp_ledger (user_id, delta, action_type, source_key, day_local)
    VALUES (v_referrer, v_cfg.reps_referrer, 'referral_bonus', v_source_key_r, (now() AT TIME ZONE 'UTC')::date)
    ON CONFLICT (user_id, source_key) DO NOTHING;
  END IF;
  IF v_cfg.reps_referred > 0 THEN
    INSERT INTO public.xp_ledger (user_id, delta, action_type, source_key, day_local)
    VALUES (p_referred, v_cfg.reps_referred, 'referral_bonus', v_source_key_e, (now() AT TIME ZONE 'UTC')::date)
    ON CONFLICT (user_id, source_key) DO NOTHING;
  END IF;

  IF v_cfg.freeze_referrer > 0 THEN
    INSERT INTO public.streak_savers (user_id, kind, balance, earned_total)
    VALUES (v_referrer, 'checkin', v_cfg.freeze_referrer, v_cfg.freeze_referrer)
    ON CONFLICT (user_id, kind) DO UPDATE
      SET balance = public.streak_savers.balance + EXCLUDED.balance,
          earned_total = COALESCE(public.streak_savers.earned_total, 0) + EXCLUDED.balance;
  END IF;
  IF v_cfg.freeze_referred > 0 THEN
    INSERT INTO public.streak_savers (user_id, kind, balance, earned_total)
    VALUES (p_referred, 'checkin', v_cfg.freeze_referred, v_cfg.freeze_referred)
    ON CONFLICT (user_id, kind) DO UPDATE
      SET balance = public.streak_savers.balance + EXCLUDED.balance,
          earned_total = COALESCE(public.streak_savers.earned_total, 0) + EXCLUDED.balance;
  END IF;

  RETURN jsonb_build_object('ok', true, 'referrer', v_referrer,
    'reps_referrer', v_cfg.reps_referrer, 'reps_referred', v_cfg.reps_referred,
    'freeze_referrer', v_cfg.freeze_referrer, 'freeze_referred', v_cfg.freeze_referred);
END; $$;

REVOKE ALL ON FUNCTION public.claim_referral_rewards_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral_rewards_for(uuid) TO service_role;
