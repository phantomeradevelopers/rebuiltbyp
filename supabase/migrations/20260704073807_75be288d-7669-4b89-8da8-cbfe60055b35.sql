-- Lock down SECURITY DEFINER functions that should never be called directly
-- by end users. Trigger-only helpers and privileged grant helpers keep working
-- because triggers fire under the table owner and privileged helpers are only
-- called from other SECURITY DEFINER wrappers or from server code using the
-- service role.

-- Trigger-only helpers: revoke EXECUTE from everyone; triggers still fire.
REVOKE EXECUTE ON FUNCTION public.protect_entitlement_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_coach_free_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_food_log_free_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_public_review() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_consult_session_self_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_admin_message_recipient_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;

-- Privileged grant helpers: only service_role / other SECURITY DEFINER
-- wrappers (redeem_code, sync_entitlement_from_purchase → grant_entitlement)
-- may call these.
REVOKE EXECUTE ON FUNCTION public.grant_entitlement(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_tier(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_entitlement_from_purchase(uuid, text) FROM PUBLIC, anon, authenticated;

-- Note: has_role / has_tier stay EXECUTE-able by authenticated because
-- they're referenced inside RLS policies (auth.uid()-scoped, safe).
-- redeem_code / restore_my_purchase / incr_coach_usage / fn_tick_streak
-- all check auth.uid() internally and remain user-callable.