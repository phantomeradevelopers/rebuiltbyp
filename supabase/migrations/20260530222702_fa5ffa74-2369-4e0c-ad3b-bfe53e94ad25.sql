CREATE TABLE public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'custom' CHECK (kind IN ('upsell_1m','upsell_2m','check_in','custom')),
  subject text NOT NULL,
  body text NOT NULL,
  cta_label text,
  cta_url text,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_messages_recipient ON public.admin_messages(recipient_user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.admin_messages TO authenticated;
GRANT ALL ON public.admin_messages TO service_role;

ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipient reads own admin messages"
  ON public.admin_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "recipient updates own admin messages"
  ON public.admin_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);
