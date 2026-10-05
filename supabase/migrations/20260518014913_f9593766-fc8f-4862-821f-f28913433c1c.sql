
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS phase_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS phase_start_date date,
  ADD COLUMN IF NOT EXISTS phase_end_date date;

CREATE INDEX IF NOT EXISTS user_plans_user_active_idx
  ON public.user_plans (user_id, plan_type, active);
