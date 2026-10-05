
-- safety_events: replace ALL with SELECT-only for owner
DROP POLICY IF EXISTS "safety events self all" ON public.safety_events;
CREATE POLICY "safety_events_select_own" ON public.safety_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- streak_events: drop client INSERT, keep SELECT
DROP POLICY IF EXISTS "streak_events_insert_own" ON public.streak_events;

-- user_achievements: replace ALL with SELECT-only for owner
DROP POLICY IF EXISTS "ua self all" ON public.user_achievements;
CREATE POLICY "user_achievements_select_own" ON public.user_achievements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- xp_ledger: drop client INSERT, keep SELECT
DROP POLICY IF EXISTS "xp_ledger_insert_own" ON public.xp_ledger;

-- wearable_connections: remove all client policies (server-only via service role)
DROP POLICY IF EXISTS "Users view own wearable connections" ON public.wearable_connections;
DROP POLICY IF EXISTS "Users insert own wearable connections" ON public.wearable_connections;
DROP POLICY IF EXISTS "Users update own wearable connections" ON public.wearable_connections;
DROP POLICY IF EXISTS "Users delete own wearable connections" ON public.wearable_connections;
