-- Waitlist for the $1000/mo Weekly Reset call
CREATE TABLE public.consult_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consult_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can join waitlist"
  ON public.consult_waitlist FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "owner reads own waitlist row"
  ON public.consult_waitlist FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Subscription state (mirrored from Stripe webhooks)
CREATE TABLE public.consult_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'inactive',
  plan_price_cents integer NOT NULL DEFAULT 100000,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consult_subscription ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own subscription"
  ON public.consult_subscription FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies — only service role writes via webhook.

CREATE TRIGGER consult_subscription_touch
  BEFORE UPDATE ON public.consult_subscription
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_consult_sub_user ON public.consult_subscription(user_id);
CREATE INDEX idx_consult_sub_stripe_sub ON public.consult_subscription(stripe_subscription_id);