CREATE TABLE public.billing_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  consent_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.billing_consents TO authenticated;
GRANT ALL ON public.billing_consents TO service_role;

ALTER TABLE public.billing_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own billing consents"
  ON public.billing_consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can record own billing consent"
  ON public.billing_consents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_billing_consents_user ON public.billing_consents(user_id);

DROP TABLE IF EXISTS public.paddle_webhook_events;