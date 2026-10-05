DROP TRIGGER IF EXISTS trg_enforce_coach_free_limit ON public.ai_coach_messages;
DROP FUNCTION IF EXISTS public.enforce_coach_free_limit();