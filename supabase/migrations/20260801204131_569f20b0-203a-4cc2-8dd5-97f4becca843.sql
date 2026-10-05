CREATE TABLE public.paddle_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.paddle_webhook_events TO service_role;
ALTER TABLE public.paddle_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages paddle webhook events"
  ON public.paddle_webhook_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');