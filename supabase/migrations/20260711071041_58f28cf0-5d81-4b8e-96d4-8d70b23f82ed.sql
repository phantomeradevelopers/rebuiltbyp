
CREATE TABLE IF NOT EXISTS public.email_campaign_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campaign TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  meta JSONB,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaign_sends TO authenticated;
GRANT ALL ON public.email_campaign_sends TO service_role;

ALTER TABLE public.email_campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read campaign sends"
  ON public.email_campaign_sends FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage campaign sends"
  ON public.email_campaign_sends FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON public.email_campaign_sends(campaign);
