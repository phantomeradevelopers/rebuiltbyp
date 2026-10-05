
-- Streaks: read-own only; writes go through server code (service role / SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "streaks self all" ON public.user_streaks;
CREATE POLICY "user_streaks_select_own" ON public.user_streaks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "streak_savers_modify_own" ON public.streak_savers;
-- streak_savers_select_own already exists

-- Coach usage: drop the UPDATE loophole; incr_coach_usage() (SECURITY DEFINER) is the only writer
DROP POLICY IF EXISTS "coach_usage self update" ON public.coach_usage_daily;
DROP POLICY IF EXISTS "coach_usage self upsert" ON public.coach_usage_daily;

-- SECURITY DEFINER hardening: revoke EXECUTE from anon/public on privileged functions
REVOKE EXECUTE ON FUNCTION public.grant_tier(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_tier(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_coach_free_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_food_log_free_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_entitlement(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_entitlement_from_purchase(uuid, text) FROM PUBLIC, anon, authenticated;
