
CREATE TYPE public.affiliate_partner AS ENUM ('candyrx', 'youthfullab');

CREATE TABLE public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  partner public.affiliate_partner NOT NULL,
  surface text NOT NULL,
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX affiliate_clicks_partner_created_idx ON public.affiliate_clicks (partner, created_at DESC);
CREATE INDEX affiliate_clicks_user_idx ON public.affiliate_clicks (user_id);

GRANT SELECT, INSERT ON public.affiliate_clicks TO authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own affiliate clicks"
  ON public.affiliate_clicks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all affiliate clicks"
  ON public.affiliate_clicks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own affiliate clicks"
  ON public.affiliate_clicks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
