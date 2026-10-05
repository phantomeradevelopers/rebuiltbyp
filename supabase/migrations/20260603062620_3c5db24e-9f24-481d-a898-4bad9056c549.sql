-- Fix 1: Revoke EXECUTE from anon/public on SECURITY DEFINER functions.
-- These are only meant for authenticated users, triggers, or service_role.
REVOKE EXECUTE ON FUNCTION public.grant_entitlement(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.redeem_code(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.restore_my_purchase() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_entitlement_from_purchase(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.incr_coach_usage() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;

-- Ensure authenticated users can still call the user-facing ones
GRANT EXECUTE ON FUNCTION public.redeem_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_my_purchase() TO authenticated;
GRANT EXECUTE ON FUNCTION public.incr_coach_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Fix 2: Remove broad SELECT policy on food-images bucket that allows listing.
-- Public bucket files remain accessible via their direct public URLs (the storage
-- CDN bypasses RLS for public buckets), but anonymous clients can no longer
-- enumerate the bucket contents through the storage API.
DROP POLICY IF EXISTS "Food images public read" ON storage.objects;