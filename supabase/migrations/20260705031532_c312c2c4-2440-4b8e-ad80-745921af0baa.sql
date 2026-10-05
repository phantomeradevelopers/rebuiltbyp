
-- (1) public_reviews: column-level protection for submitted_ip / submitted_by
REVOKE SELECT ON public.public_reviews FROM anon, authenticated;
GRANT SELECT (id, display_name, city, rating, quote, track, status, consent, created_at, approved_at)
  ON public.public_reviews TO anon, authenticated;
-- admins retain full-column read via service role / has_role SELECT policy; ensure admin role gets all columns:
GRANT SELECT ON public.public_reviews TO service_role;

-- (2) Lock down SECURITY DEFINER functions added in the retention/referral/partner pass
REVOKE EXECUTE ON FUNCTION public.claim_referral_rewards_for(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.claim_referral_rewards_for(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.my_active_partner_id(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_active_partner_id(uuid) TO authenticated, service_role;
