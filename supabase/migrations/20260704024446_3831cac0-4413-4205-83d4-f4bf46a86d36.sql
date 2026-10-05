
-- Admin messages: recipients may only touch read_at/dismissed_at
CREATE OR REPLACE FUNCTION public.enforce_admin_message_recipient_update()
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
  IF NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
     OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.subject IS DISTINCT FROM OLD.subject
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.cta_label IS DISTINCT FROM OLD.cta_label
     OR NEW.cta_url IS DISTINCT FROM OLD.cta_url
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Recipients may only update read_at and dismissed_at';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_messages_recipient_update ON public.admin_messages;
CREATE TRIGGER trg_admin_messages_recipient_update
BEFORE UPDATE ON public.admin_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_message_recipient_update();

-- Consult sessions: user self-update may only cancel; coach-authored fields locked
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
  -- Owner: only allowed change is status scheduled -> cancelled
  IF NEW.status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'Owners may only cancel their session';
  END IF;
  IF OLD.status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled sessions can be cancelled';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     OR NEW.brief_json IS DISTINCT FROM OLD.brief_json
     OR NEW.p_notes IS DISTINCT FROM OLD.p_notes
     OR NEW.action_items IS DISTINCT FROM OLD.action_items
     OR NEW.video_link IS DISTINCT FROM OLD.video_link THEN
    RAISE EXCEPTION 'Owners may only change status to cancelled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consult_sessions_self_update ON public.consult_sessions;
CREATE TRIGGER trg_consult_sessions_self_update
BEFORE UPDATE ON public.consult_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_consult_session_self_update();
