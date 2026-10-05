
-- 1) Set search_path on the remaining email queue helpers.
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2) Revoke EXECUTE on every public SECURITY DEFINER function from PUBLIC/anon,
--    then re-grant to the roles that legitimately need it. Anon should never
--    invoke SECURITY DEFINER routines in this app.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role;', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Grant EXECUTE to authenticated for functions the app calls via supabase.rpc / triggers.
GRANT EXECUTE ON FUNCTION public.redeem_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_my_purchase() TO authenticated;
GRANT EXECUTE ON FUNCTION public.incr_coach_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_member_perk_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_perk_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_tick_streak(text, date, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tier(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_rebuilt_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_active_partner_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_rewards_for(uuid) TO authenticated;

-- 3) Tighten meal-images storage SELECT: admin-only. Regular users get signed
--    URLs from the server (supabaseAdmin) via meals-library server functions.
DROP POLICY IF EXISTS "meal-images authenticated read" ON storage.objects;
CREATE POLICY "meal-images admin read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'meal-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
