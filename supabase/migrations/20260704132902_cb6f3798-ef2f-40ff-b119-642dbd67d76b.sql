
-- 1) Lock down SECURITY DEFINER functions from PUBLIC/anon
REVOKE ALL ON FUNCTION public.issue_member_perk_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_perk_code(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_perk_code(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.revoke_member_perks(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_member_perks(uuid) TO service_role;
-- Re-affirm the intended grant for issue_member_perk_code (auth users only)
GRANT EXECUTE ON FUNCTION public.issue_member_perk_code(text) TO authenticated;

-- 2) Tighten consult_sessions "self cancel" RLS: WITH CHECK now requires
--    status transitions to 'canceled' and preserves coach-authored fields.
--    Belt-and-suspenders alongside the existing BEFORE UPDATE trigger.
DROP POLICY IF EXISTS "sessions self cancel" ON public.consult_sessions;
CREATE POLICY "sessions self cancel" ON public.consult_sessions
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND status = 'scheduled'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'canceled'
  );

-- 3) Align cancellation trigger with the CHECK constraint spelling ('canceled')
CREATE OR REPLACE FUNCTION public.enforce_consult_session_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IN ('service_role','postgres') THEN
    RETURN NEW;
  END IF;
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coach'::app_role) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;
  -- Owner: only allowed change is status scheduled -> canceled
  IF NEW.status IS DISTINCT FROM 'canceled' THEN
    RAISE EXCEPTION 'Owners may only cancel their session';
  END IF;
  IF OLD.status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled sessions can be cancelled';
  END IF;
  IF NEW.seat_id IS DISTINCT FROM OLD.seat_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
     OR NEW.video_link IS DISTINCT FROM OLD.video_link
     OR NEW.brief_json IS DISTINCT FROM OLD.brief_json
     OR NEW.brief_generated_at IS DISTINCT FROM OLD.brief_generated_at
     OR NEW.p_notes IS DISTINCT FROM OLD.p_notes
     OR NEW.action_items IS DISTINCT FROM OLD.action_items
     OR NEW.voice_note_url IS DISTINCT FROM OLD.voice_note_url
     OR NEW.joined_at IS DISTINCT FROM OLD.joined_at
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Owners may only change status to canceled';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_consult_session_self_update() FROM PUBLIC, anon, authenticated;
