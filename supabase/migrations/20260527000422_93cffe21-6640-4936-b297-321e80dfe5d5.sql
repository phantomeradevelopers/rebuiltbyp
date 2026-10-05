CREATE TABLE public.demo_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  source_user_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX demo_snapshots_code_idx ON public.demo_snapshots(code);

GRANT ALL ON public.demo_snapshots TO service_role;

ALTER TABLE public.demo_snapshots ENABLE ROW LEVEL SECURITY;