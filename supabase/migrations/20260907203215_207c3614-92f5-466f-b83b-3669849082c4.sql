CREATE TABLE public.consult_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  help TEXT NOT NULL,
  budget TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.consult_leads TO service_role;
ALTER TABLE public.consult_leads ENABLE ROW LEVEL SECURITY;