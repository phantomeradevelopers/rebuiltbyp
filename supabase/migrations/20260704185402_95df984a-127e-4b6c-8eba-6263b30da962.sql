
-- Retention Engine — schema additions
-- 1) reminder_frequency preference on user_profile (drives win-back cadence)
-- 2) nothing else needed — xp_ledger (Reps), streak_savers (freeze tokens),
--    reengagement_log, notification_queue already exist.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS reminder_frequency text NOT NULL DEFAULT 'balanced';

-- Validate values via trigger (per project convention — no CHECK constraints on
-- mutable/user-editable enums; keep migration-safe).
CREATE OR REPLACE FUNCTION public.validate_reminder_frequency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reminder_frequency NOT IN ('off','gentle','balanced','frequent') THEN
    RAISE EXCEPTION 'reminder_frequency must be one of off|gentle|balanced|frequent';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_reminder_frequency ON public.user_profile;
CREATE TRIGGER trg_validate_reminder_frequency
  BEFORE INSERT OR UPDATE OF reminder_frequency ON public.user_profile
  FOR EACH ROW EXECUTE FUNCTION public.validate_reminder_frequency();
