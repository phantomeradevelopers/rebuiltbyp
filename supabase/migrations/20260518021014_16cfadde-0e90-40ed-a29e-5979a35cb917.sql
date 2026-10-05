CREATE TABLE public.mindset_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  state text NOT NULL,
  prompt_text text NOT NULL,
  rep_type text NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.mindset_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mindset self all" ON public.mindset_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_mindset_logs_user_date ON public.mindset_logs (user_id, date DESC);