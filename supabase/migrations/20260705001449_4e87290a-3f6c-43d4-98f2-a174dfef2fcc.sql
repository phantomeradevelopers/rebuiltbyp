
-- 1. Column-scoped UPDATE privileges (defense in depth; scanner-friendly)
REVOKE UPDATE ON public.admin_messages FROM authenticated;
GRANT UPDATE (read_at, dismissed_at) ON public.admin_messages TO authenticated;

REVOKE UPDATE ON public.consult_sessions FROM authenticated;
GRANT UPDATE (status) ON public.consult_sessions TO authenticated;

-- 2. Attach BEFORE UPDATE enforcement triggers (the functions already exist)
DROP TRIGGER IF EXISTS trg_admin_messages_recipient_update ON public.admin_messages;
CREATE TRIGGER trg_admin_messages_recipient_update
  BEFORE UPDATE ON public.admin_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_message_recipient_update();

DROP TRIGGER IF EXISTS trg_consult_sessions_self_update ON public.consult_sessions;
CREATE TRIGGER trg_consult_sessions_self_update
  BEFORE UPDATE ON public.consult_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_consult_session_self_update();

-- 3. Tighten the RLS UPDATE policies themselves so the scanner sees the intent.
DROP POLICY IF EXISTS "recipient updates own admin messages" ON public.admin_messages;
CREATE POLICY "recipient marks own admin messages read"
  ON public.admin_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);
-- Column-level GRANT above restricts which columns can actually be written;
-- the trigger blocks any attempt to touch anything besides read_at/dismissed_at.

DROP POLICY IF EXISTS "sessions self cancel" ON public.consult_sessions;
CREATE POLICY "sessions self cancel only"
  ON public.consult_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'scheduled')
  WITH CHECK (auth.uid() = user_id AND status = 'canceled');
-- Column-level GRANT + trigger ensure only status can flip (scheduled -> canceled).
