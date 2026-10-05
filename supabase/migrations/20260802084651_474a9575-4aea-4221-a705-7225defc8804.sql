
-- COURSE MODULES
CREATE TABLE public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.course_modules TO anon, authenticated;
GRANT ALL ON public.course_modules TO service_role;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published modules are readable" ON public.course_modules
  FOR SELECT USING (published);
CREATE TRIGGER trg_course_modules_updated BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.course_modules (slug, title, summary, sort_order) VALUES
  ('lifetime-pro', 'Module 1 — Lifetime Pro access', 'Full REBUILT app access for life.', 1),
  ('nutrition-academy', 'Module 2 — The Nutrition Academy', 'The full nutrition curriculum inside the app.', 2),
  ('mogul-bonuses', 'Module 3 — The Mogul Bonuses', 'The four Mogul guides plus THE CODE.', 3);

-- COURSE PROGRESS
CREATE TABLE public.course_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_slug text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_slug)
);
CREATE INDEX idx_course_progress_user ON public.course_progress(user_id);
GRANT SELECT, INSERT, UPDATE ON public.course_progress TO authenticated;
GRANT ALL ON public.course_progress TO service_role;
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage their own course progress" ON public.course_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_course_progress_updated BEFORE UPDATE ON public.course_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- COURSE PURCHASES: plan + amount + member link
ALTER TABLE public.course_purchases
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS amount_cents integer NOT NULL DEFAULT 49700,
  ADD COLUMN IF NOT EXISTS installments_paid integer NOT NULL DEFAULT 1;

-- PAYMENTS
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'paddle',
  provider_txn_id text UNIQUE,
  user_id uuid,
  email text,
  product_key text,
  price_id text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'completed',
  billing_kind text NOT NULL DEFAULT 'one_time',
  environment text NOT NULL DEFAULT 'sandbox',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_tx_occurred ON public.payment_transactions(occurred_at DESC);
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- SUPPORT
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text,
  email text,
  subject text,
  body text NOT NULL,
  source text NOT NULL DEFAULT 'contact_form',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_created ON public.support_messages(created_at DESC);
GRANT INSERT ON public.support_messages TO anon, authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can send a support message" ON public.support_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);
