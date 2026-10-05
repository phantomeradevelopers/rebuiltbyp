DROP POLICY "anyone can join waitlist" ON public.consult_waitlist;

CREATE POLICY "user joins own waitlist row"
  ON public.consult_waitlist FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);