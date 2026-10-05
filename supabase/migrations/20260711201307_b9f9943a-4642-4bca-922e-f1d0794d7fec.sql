ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

-- Skip existing users: pretend they were already sent so the automation only
-- fires for future signups.
UPDATE public.user_profile
  SET welcome_email_sent_at = now()
  WHERE welcome_email_sent_at IS NULL;

-- Allow any signed-in user to read the mogul-bonuses bucket via signed URLs
-- (they still can't list; server signs individual object URLs).
DROP POLICY IF EXISTS "mogul-bonuses authenticated read" ON storage.objects;
CREATE POLICY "mogul-bonuses authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'mogul-bonuses');