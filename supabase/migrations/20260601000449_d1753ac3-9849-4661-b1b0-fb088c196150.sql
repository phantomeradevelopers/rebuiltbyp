-- Audit table for coach-initiated changes the user confirmed in chat.
CREATE TABLE public.coach_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID,
  message_id UUID,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'applied',
  undone_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.coach_actions TO authenticated;
GRANT ALL ON public.coach_actions TO service_role;

ALTER TABLE public.coach_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own coach_actions"
  ON public.coach_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own coach_actions"
  ON public.coach_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own coach_actions"
  ON public.coach_actions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_coach_actions_user_created ON public.coach_actions (user_id, created_at DESC);
CREATE INDEX idx_coach_actions_message ON public.coach_actions (message_id);