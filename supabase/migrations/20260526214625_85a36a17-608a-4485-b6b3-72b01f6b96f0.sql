
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS gender text;

CREATE TABLE public.identity_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contract_id uuid NOT NULL REFERENCES public.identity_contracts(id) ON DELETE CASCADE,
  milestone_month smallint NOT NULL CHECK (milestone_month IN (3,6,9,12)),
  due_date date NOT NULL,
  completed_at timestamptz,
  still_him text,
  evidence text,
  recommit text,
  score smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, milestone_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.identity_checkins TO authenticated;
GRANT ALL ON public.identity_checkins TO service_role;

ALTER TABLE public.identity_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins self all" ON public.identity_checkins
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins read all checkins identity" ON public.identity_checkins
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

CREATE INDEX idx_identity_checkins_user_due ON public.identity_checkins(user_id, due_date);
