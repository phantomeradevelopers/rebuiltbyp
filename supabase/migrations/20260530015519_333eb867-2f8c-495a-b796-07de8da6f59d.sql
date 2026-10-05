-- Tighten consult_waitlist INSERT policy to enforce non-null user ownership
DROP POLICY IF EXISTS "user joins own waitlist row" ON public.consult_waitlist;

CREATE POLICY "user joins own waitlist row"
ON public.consult_waitlist
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id);