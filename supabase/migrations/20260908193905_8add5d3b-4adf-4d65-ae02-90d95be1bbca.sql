DROP POLICY IF EXISTS "participants update pair status" ON public.accountability_pairs;

CREATE POLICY "participants update pair status"
ON public.accountability_pairs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b)
WITH CHECK (
  (auth.uid() = user_a OR auth.uid() = user_b)
  AND status IN ('pending','active','unpaired')
  AND (initiated_by = user_a OR initiated_by = user_b)
);