CREATE TABLE public.plan_refinements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('fitness','nutrition')),
  phase_number integer NOT NULL DEFAULT 1,
  week_number integer,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_refinements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refinements self all" ON public.plan_refinements
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_plan_refinements_user_created ON public.plan_refinements (user_id, created_at DESC);