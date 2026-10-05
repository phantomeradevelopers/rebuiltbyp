
REVOKE EXECUTE ON FUNCTION public.enforce_accountability_pair_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_admin_message_recipient_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_consult_session_self_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_coach_free_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_food_log_free_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_referral_rewards_for(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_active_partner_id(uuid) FROM PUBLIC, anon;
