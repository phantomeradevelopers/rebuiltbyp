
-- Master toggle for medication push reminders
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS notify_medications boolean NOT NULL DEFAULT true;

-- Per-medication Rx acknowledgement
ALTER TABLE public.user_medications
  ADD COLUMN IF NOT EXISTS rx_acknowledged_at timestamp with time zone;

-- Idempotency log for dose reminder pushes
CREATE TABLE IF NOT EXISTS public.medication_dose_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medication_id uuid NOT NULL REFERENCES public.user_medications(id) ON DELETE CASCADE,
  scheduled_at timestamp with time zone NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (medication_id, scheduled_at)
);

CREATE INDEX IF NOT EXISTS medication_dose_notifications_user_idx
  ON public.medication_dose_notifications(user_id, scheduled_at);

GRANT SELECT ON public.medication_dose_notifications TO authenticated;
GRANT ALL ON public.medication_dose_notifications TO service_role;

ALTER TABLE public.medication_dose_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dose notifications self read"
  ON public.medication_dose_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Shipment tracking
CREATE TABLE IF NOT EXISTS public.medication_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medication_id uuid REFERENCES public.user_medications(id) ON DELETE SET NULL,
  carrier text NOT NULL,
  tracking_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  last_event_at timestamp with time zone,
  last_event_description text,
  estimated_delivery timestamp with time zone,
  notify_on_status jsonb NOT NULL DEFAULT '{"in_transit": true, "out_for_delivery": true, "delivered": true}'::jsonb,
  provider text NOT NULL DEFAULT 'easypost',
  provider_tracker_id text,
  last_polled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, carrier, tracking_number)
);

CREATE INDEX IF NOT EXISTS medication_shipments_user_idx
  ON public.medication_shipments(user_id, status);

CREATE INDEX IF NOT EXISTS medication_shipments_poll_idx
  ON public.medication_shipments(status, last_polled_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_shipments TO authenticated;
GRANT ALL ON public.medication_shipments TO service_role;

ALTER TABLE public.medication_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipments self all"
  ON public.medication_shipments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER medication_shipments_touch_updated_at
  BEFORE UPDATE ON public.medication_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
