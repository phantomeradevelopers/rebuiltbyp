-- Defense-in-depth: add explicit WITH CHECK to UPDATE policies so users can't
-- reassign rows to another user_id during an update.

DROP POLICY IF EXISTS "Users update their own journal replies" ON public.journal_replies;
CREATE POLICY "Users update their own journal replies"
  ON public.journal_replies
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own meal overrides" ON public.meal_overrides;
CREATE POLICY "Users update own meal overrides"
  ON public.meal_overrides
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile self update" ON public.user_profile;
CREATE POLICY "profile self update"
  ON public.user_profile
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);