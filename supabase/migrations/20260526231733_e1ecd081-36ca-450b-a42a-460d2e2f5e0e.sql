
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS vacation_reason text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS vacation_note text;

CREATE TABLE IF NOT EXISTS public.reengagement_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reengagement_log TO authenticated;
GRANT ALL ON public.reengagement_log TO service_role;

ALTER TABLE public.reengagement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reengagement self read"
  ON public.reengagement_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS reengagement_log_user_kind_sent_idx
  ON public.reengagement_log (user_id, kind, sent_at DESC);
