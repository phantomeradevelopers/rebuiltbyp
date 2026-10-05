CREATE TABLE public.labs_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_labs_waitlist_user ON public.labs_waitlist(user_id);
CREATE UNIQUE INDEX idx_labs_waitlist_email_unique ON public.labs_waitlist(lower(email));

GRANT SELECT, INSERT ON public.labs_waitlist TO authenticated;
GRANT ALL ON public.labs_waitlist TO service_role;

ALTER TABLE public.labs_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own waitlist row"
ON public.labs_waitlist FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read their own waitlist row"
ON public.labs_waitlist FOR SELECT TO authenticated
USING (auth.uid() = user_id);