-- Prevent anonymous visitors from reading reviewer IPs / internal user IDs on approved reviews.
-- Anon can still read display-safe columns (display_name, city, rating, quote, track, approved_at, status, consent, id, created_at).
-- Authenticated admins retain full access via the "admins read all reviews" policy.
REVOKE SELECT (submitted_ip, submitted_by) ON public.public_reviews FROM anon;
REVOKE SELECT (submitted_ip, submitted_by) ON public.public_reviews FROM PUBLIC;