
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE POLICY "notif self update read"
ON public.notification_queue FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notification_queue_user_status
  ON public.notification_queue (user_id, status, scheduled_for DESC);
