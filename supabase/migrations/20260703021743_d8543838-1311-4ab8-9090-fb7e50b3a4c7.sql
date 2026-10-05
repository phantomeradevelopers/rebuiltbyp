
CREATE TABLE public.public_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  city TEXT,
  rating SMALLINT NOT NULL,
  quote TEXT NOT NULL,
  track TEXT NOT NULL DEFAULT 'any',
  status TEXT NOT NULL DEFAULT 'pending',
  consent BOOLEAN NOT NULL DEFAULT false,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.validate_public_review()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN RAISE EXCEPTION 'rating must be 1-5'; END IF;
  IF length(NEW.quote) < 10 OR length(NEW.quote) > 500 THEN RAISE EXCEPTION 'quote must be 10-500 chars'; END IF;
  IF length(NEW.display_name) < 1 OR length(NEW.display_name) > 60 THEN RAISE EXCEPTION 'name required'; END IF;
  IF NEW.status NOT IN ('pending','approved','rejected') THEN RAISE EXCEPTION 'bad status'; END IF;
  IF NEW.track NOT IN ('men','angels','any') THEN RAISE EXCEPTION 'bad track'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_public_review
BEFORE INSERT OR UPDATE ON public.public_reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_public_review();

CREATE INDEX idx_public_reviews_approved ON public.public_reviews(status, approved_at DESC) WHERE status = 'approved';

GRANT SELECT ON public.public_reviews TO anon, authenticated;
GRANT ALL ON public.public_reviews TO service_role;

ALTER TABLE public.public_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read only approved + consented reviews
CREATE POLICY "read approved reviews"
ON public.public_reviews FOR SELECT
TO anon, authenticated
USING (status = 'approved' AND consent = true);

-- Admins can see everything
CREATE POLICY "admins read all reviews"
ON public.public_reviews FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can moderate
CREATE POLICY "admins update reviews"
ON public.public_reviews FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete reviews"
ON public.public_reviews FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
-- Inserts go through server function using service_role; no client INSERT policy.
