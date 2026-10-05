CREATE TABLE public.admin_pin (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pin_hash text,
  salt text,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_pin TO service_role;

ALTER TABLE public.admin_pin ENABLE ROW LEVEL SECURITY;

-- Deliberately no policies: anon/authenticated have no grants and no policies,
-- so the PIN hash is only reachable by trusted server-side code (service role).

CREATE TRIGGER admin_pin_touch_updated_at
BEFORE UPDATE ON public.admin_pin
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.admin_pin (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reset_admin_pin()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.admin_pin
     SET pin_hash = NULL,
         salt = NULL,
         failed_attempts = 0,
         locked_until = NULL,
         updated_at = now()
   WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public.reset_admin_pin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_admin_pin() TO service_role;